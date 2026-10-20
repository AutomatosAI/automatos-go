// The filesystem and git side of sync-core: the source checkout must be a git work tree at the
// manifest's pin with nothing modified under its root (K2), its tsconfig gives the aliases, and
// this repo's package.json gives the packages a vendored file may import as written.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { z } from 'zod';

import { aliasesFromPaths, type Alias, type SourceTree } from './resolve';

function git(checkout: string, args: readonly string[]): string {
  // --no-optional-locks: a status never refreshes the checkout's index (it is read only)
  return execFileSync('git', ['--no-optional-locks', '-C', checkout, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function topLevel(checkout: string): { top: string } | { error: string } {
  try {
    return { top: git(checkout, ['rev-parse', '--show-toplevel']) };
  } catch (error) {
    return { error: error instanceof Error ? error.message.trim() : String(error) };
  }
}

/** Why the checkout cannot be vendored from; empty when it is at the pin and unmodified. */
export function checkoutProblems(checkout: string, sha: string, root: string): string[] {
  const found = topLevel(checkout);
  if ('error' in found) return [`${checkout} is not a git work tree: ${found.error}`];
  if (fs.realpathSync(found.top) !== fs.realpathSync(checkout)) {
    return [`${checkout} is inside the work tree ${found.top}: pass the top of the checkout`];
  }
  const head = git(checkout, ['rev-parse', 'HEAD']);
  if (head !== sha) {
    return [
      `${checkout} is at ${head} but scripts/core-manifest.json pins ${sha}: vendor from the ` +
        'pin, or change the pin in the same commit as the re-sync',
    ];
  }
  const changes = git(checkout, ['status', '--porcelain', '--', root]);
  return changes === ''
    ? []
    : [`${checkout}/${root} has local changes; vendor only from an unmodified tree:\n${changes}`];
}

const tsconfigSchema = z.object({
  compilerOptions: z.object({ paths: z.record(z.array(z.string())).default({}) }).default({}),
});

export function readAliases(sourceRoot: string): Alias[] {
  const file = path.join(sourceRoot, 'tsconfig.json');
  const { config, error } = ts.readConfigFile(file, ts.sys.readFile);
  if (error) {
    throw new Error(
      `cannot read ${file}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`,
    );
  }
  return aliasesFromPaths(tsconfigSchema.parse(config).compilerOptions.paths);
}

const packageJsonSchema = z.object({ dependencies: z.record(z.string()).default({}) });

export function readPackages(repo: string): Set<string> {
  const text = fs.readFileSync(path.join(repo, 'package.json'), 'utf8');
  return new Set(Object.keys(packageJsonSchema.parse(JSON.parse(text)).dependencies));
}

/** Reads files under `root` only; a path that climbs out of it reads as missing. */
export function fsTree(root: string): SourceTree {
  return {
    read: (relative) => {
      const normal = path.posix.normalize(relative);
      if (path.posix.isAbsolute(normal) || normal.startsWith('..')) return undefined;
      const file = path.join(root, normal);
      return fs.existsSync(file) && fs.statSync(file).isFile()
        ? fs.readFileSync(file, 'utf8')
        : undefined;
    },
  };
}

/** Every file under `dir`, as posix paths relative to `repo`. */
export function listFiles(repo: string, dir: string): string[] {
  const absolute = path.join(repo, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.posix.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(repo, child) : [child];
  });
}
