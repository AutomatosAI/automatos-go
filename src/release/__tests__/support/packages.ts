// package.json and package-lock.json as the release audits read them: every declared dependency
// and every installed package, nested ones included, by the name npm installs it under and the name
// it really is (an alias such as "x": "npm:firebase@…" is still firebase). Test-only.

import { z } from 'zod';

import { deniedBy, type DenylistEntry } from './denylist';
import { readRepoFile } from './tree';

const depMap = z.record(z.string(), z.string()).optional();

const packageJsonSchema = z.object({
  name: z.string(),
  dependencies: depMap,
  devDependencies: depMap,
});

const lockEntrySchema = z.object({
  name: z.string().optional(),
  // true for a package npm may skip (another platform's binary): absent from node_modules is fine
  optional: z.boolean().optional(),
  dependencies: depMap,
  optionalDependencies: depMap,
});

const lockSchema = z.object({
  lockfileVersion: z.number(),
  packages: z.record(z.string(), lockEntrySchema),
});

export type PackageJson = z.infer<typeof packageJsonSchema>;
export type Lock = z.infer<typeof lockSchema>;
export type LockEntry = z.infer<typeof lockEntrySchema>;

/** One package by where it came from (a package.json field or a lock key) and its names. */
export type InstalledPackage = Readonly<{ where: string; names: readonly string[] }>;

export type Offender = Readonly<{ where: string; name: string; reason: string }>;

const NODE_MODULES = 'node_modules/';
const NPM_ALIAS = /^npm:((?:@[^/@]+\/)?[^@]+)@/;

export function readPackageJson(): PackageJson {
  return packageJsonSchema.parse(JSON.parse(readRepoFile('package.json')));
}

export function readLock(): Lock {
  return lockSchema.parse(JSON.parse(readRepoFile('package-lock.json')));
}

/** The installed name of a lock key: what follows its last node_modules/ ('' for the root). */
export function lockKeyName(key: string): string {
  const at = key.lastIndexOf(NODE_MODULES);
  return at === -1 ? '' : key.slice(at + NODE_MODULES.length);
}

function namesOf(declared: string, spec: string | undefined): string[] {
  const real = spec === undefined ? undefined : NPM_ALIAS.exec(spec)?.[1];
  return real === undefined || real === declared ? [declared] : [declared, real];
}

/** Every dependency and devDependency package.json declares. */
export function declaredPackages(pkg: PackageJson): InstalledPackage[] {
  const fields = { dependencies: pkg.dependencies, devDependencies: pkg.devDependencies };
  return Object.entries(fields).flatMap(([field, deps]) =>
    Object.entries(deps ?? {}).map(([name, spec]) => ({
      where: `package.json ${field}`,
      names: namesOf(name, spec),
    })),
  );
}

/** Every package the lock installs (node_modules/<name>, nested included); the root is skipped. */
export function lockPackages(lock: Lock): InstalledPackage[] {
  return Object.entries(lock.packages)
    .filter(([key]) => key.includes(NODE_MODULES))
    .map(([key, entry]) => {
      const installed = lockKeyName(key);
      const names = entry.name && entry.name !== installed ? [installed, entry.name] : [installed];
      return { where: `package-lock.json ${key}`, names };
    });
}

/** Each package whose name matches an entry, with the entry's reason. */
export function offenders(
  packages: readonly InstalledPackage[],
  entries: readonly DenylistEntry[],
): Offender[] {
  return packages.flatMap(({ where, names }) =>
    names.flatMap((name) => {
      const entry = deniedBy(name, entries);
      return entry === undefined ? [] : [{ where, name, reason: entry.reason }];
    }),
  );
}

/** One line per offender, so a failing audit names the package, where it is and why. */
export function describeOffenders(found: readonly Offender[]): string[] {
  return found.map(({ where, name, reason }) => `${name} (${where}): ${reason}`);
}

/** Every package name reachable from root through the lock's dependencies, by name. */
export function dependencyClosure(lock: Lock, root: string): Set<string> {
  const byName = new Map<string, LockEntry[]>();
  for (const [key, entry] of Object.entries(lock.packages)) {
    const name = lockKeyName(key);
    byName.set(name, [...(byName.get(name) ?? []), entry]);
  }
  const reached = new Set<string>();
  const visit = (name: string): void => {
    if (reached.has(name)) return;
    reached.add(name);
    for (const entry of byName.get(name) ?? []) {
      const deps = { ...entry.dependencies, ...entry.optionalDependencies };
      Object.keys(deps).forEach(visit);
    }
  };
  visit(root);
  return reached;
}
