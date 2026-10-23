// US-007a, KC12: the role is the bootstrap's (GET /api/workspaces/current, through the foundation's
// workspace query), never one this wave derives from the auth mode, the edition or the server. A
// paired local operator is an owner because the server answers so. Read from the source: no file
// of this wave's folders names a role as a string, except the matrix test (roles.test.ts); the
// pattern is built from WORKSPACE_ROLES, so this file names none either.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { WORKSPACE_ROLES } from '../../api/workspace';

const ROOT = path.resolve(__dirname, '../../..');
const WAVE_FOLDERS = ['src/connect', 'src/consent', 'src/session'];
const MATRIX_TEST = 'src/session/__tests__/roles.test.ts';
const SOURCE = /\.(ts|tsx)$/;

/** A role as a quoted literal, in single, double or back quotes. */
const ROLE_LITERAL = new RegExp(`(['"\`])(${WORKSPACE_ROLES.join('|')})\\1`);

function sourcesUnder(folder: string): readonly string[] {
  const absolute = path.join(ROOT, folder);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(folder, entry.name);
    if (entry.isDirectory()) return sourcesUnder(relative);
    return SOURCE.test(entry.name) ? [relative] : [];
  });
}

const FILES = WAVE_FOLDERS.flatMap(sourcesUnder).filter((file) => file !== MATRIX_TEST);

function roleLiterals(file: string): readonly string[] {
  return readFileSync(path.join(ROOT, file), 'utf8')
    .split('\n')
    .flatMap((line, index) =>
      ROLE_LITERAL.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : [],
    );
}

describe('the role is the server’s (KC12)', () => {
  it("reads this wave's folders (src/consent counts once it exists)", () => {
    expect(FILES.some((file) => file.startsWith('src/connect/'))).toBe(true);
    expect(FILES.some((file) => file.startsWith('src/session/'))).toBe(true);
    expect(FILES).not.toContain(MATRIX_TEST);
  });

  it('finds a quoted role where one is written (the pattern works)', () => {
    for (const role of WORKSPACE_ROLES) {
      expect(ROLE_LITERAL.test(`role: '${role}'`)).toBe(true);
      expect(ROLE_LITERAL.test(`ask your workspace ${role}`)).toBe(false);
    }
  });

  it('names no role as a string in src/connect, src/consent or src/session', () => {
    expect(FILES.flatMap(roleLiterals)).toEqual([]);
  });
});
