// Module specifiers: the source's tsconfig path aliases ('@/x', '@automatos/theme-sdk'),
// relative imports resolved against the source tree, and the relative specifiers written into
// src/core/web in place of an alias or a shimmed package (K1).
import { posix } from 'node:path';
import ts from 'typescript';

import { declaredNames, hasExportModifier } from './ast';

export type Alias = { readonly key: string; readonly target: string; readonly wildcard: boolean };

/** A read-only view of the source's root (frontend/); paths are root-relative, posix. */
export type SourceTree = { readonly read: (path: string) => string | undefined };

export type Resolved =
  | { readonly kind: 'local'; readonly path: string | undefined; readonly base: string }
  | { readonly kind: 'package'; readonly name: string };

const EXTENSIONS = ['.ts', '.tsx', '.d.ts', '/index.ts', '/index.tsx'];

/** tsconfig compilerOptions.paths → aliases; './*' style targets become root-relative. */
export function aliasesFromPaths(paths: Readonly<Record<string, readonly string[]>>): Alias[] {
  return Object.entries(paths).flatMap(([key, targets]) => {
    const [first] = targets;
    if (first === undefined) return [];
    const wildcard = key.endsWith('/*');
    const target = first.replace(/\*$/, '').replace(/^\.\//, '');
    return [{ key: wildcard ? key.slice(0, -1) : key, target, wildcard }];
  });
}

/** The root-relative (unresolved) path an alias names, or undefined when none matches. */
export function applyAlias(spec: string, aliases: readonly Alias[]): string | undefined {
  const exact = aliases.find((alias) => !alias.wildcard && alias.key === spec);
  if (exact) return exact.target;
  const prefixes = aliases
    .filter((alias) => alias.wildcard && spec.startsWith(alias.key))
    .sort((a, b) => b.key.length - a.key.length);
  const [best] = prefixes;
  return best ? `${best.target}${spec.slice(best.key.length)}` : undefined;
}

export function packageName(spec: string): string {
  const segments = spec.split('/');
  return spec.startsWith('@') ? segments.slice(0, 2).join('/') : (segments[0] ?? spec);
}

function resolveFile(base: string, tree: SourceTree): string | undefined {
  if (base.startsWith('..')) return undefined;
  const candidates = /\.(tsx?|json)$/.test(base) ? [base] : EXTENSIONS.map((ext) => base + ext);
  return candidates.find((candidate) => tree.read(candidate) !== undefined);
}

export function resolveSpec(
  importer: string,
  spec: string,
  aliases: readonly Alias[],
  tree: SourceTree,
): Resolved {
  const aliased = applyAlias(spec, aliases);
  if (aliased === undefined && !spec.startsWith('.')) {
    return { kind: 'package', name: packageName(spec) };
  }
  const base = aliased ?? posix.normalize(posix.join(posix.dirname(importer), spec));
  return { kind: 'local', path: resolveFile(base, tree), base };
}

/** A relative specifier from one file to a path, without a .ts/.tsx extension. */
export function relativeSpecifier(fromFile: string, toPath: string): string {
  const relative = posix.relative(posix.dirname(fromFile), toPath.replace(/\.tsx?$/, ''));
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function exportedByStatement(statement: ts.Statement): string[] {
  if (ts.isExportDeclaration(statement)) {
    const clause = statement.exportClause;
    if (clause && ts.isNamedExports(clause)) return clause.elements.map((el) => el.name.text);
    return clause && ts.isNamespaceExport(clause) ? [clause.name.text] : [];
  }
  if (ts.isExportAssignment(statement)) return ['default'];
  return hasExportModifier(statement) ? declaredNames(statement) : [];
}

/** Every name a module exports, following `export * from` (for narrowing a barrel). */
export function exportedNames(
  path: string,
  aliases: readonly Alias[],
  tree: SourceTree,
  seen: ReadonlySet<string> = new Set(),
): Set<string> {
  const text = tree.read(path);
  if (text === undefined || seen.has(path)) return new Set();
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false);
  const names = new Set(sf.statements.flatMap(exportedByStatement));
  for (const statement of sf.statements) {
    const spec = starSpecifier(statement);
    if (spec === undefined) continue;
    const target = resolveSpec(path, spec, aliases, tree);
    if (target.kind !== 'local' || target.path === undefined) continue;
    const nested = exportedNames(target.path, aliases, tree, new Set([...seen, path]));
    nested.forEach((name) => names.add(name));
  }
  return names;
}

function starSpecifier(statement: ts.Statement): string | undefined {
  if (!ts.isExportDeclaration(statement) || statement.exportClause) return undefined;
  const literal = statement.moduleSpecifier;
  return literal && ts.isStringLiteralLike(literal) ? literal.text : undefined;
}
