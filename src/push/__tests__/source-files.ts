// Reading the wave's own source in a test (no module is imported): every .ts and .tsx file under a
// folder, and the module names a text imports, so a test can prove which file imports what.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export type SourceFile = Readonly<{ file: string; text: string }>;

/** Every .ts and .tsx file under dir, recursively. */
export function sources(dir: string): SourceFile[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry.name) ? [{ file: full, text: readFileSync(full, 'utf8') }] : [];
  });
}

/** The module names text imports (import … from, a bare import, require) that match module. */
export function importsOf(text: string, module: RegExp): string[] {
  return [...text.matchAll(/(?:from|import|require\()\s*['"]([^'"]+)['"]/g)]
    .map((match) => match[1] ?? '')
    .filter((name) => module.test(name));
}
