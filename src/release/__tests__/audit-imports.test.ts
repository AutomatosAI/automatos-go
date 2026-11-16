// Rule 14.2 (docs/app-standard.md): the release audits travel with every app made from the template,
// so they import only what every such app has. Each file under the audits' folders is read from its
// syntax tree, and each package it imports, type-only imports included, is one of
// settings/audit-imports.ts's, each with its reason. An import an app may not have fails here, in
// the template, and not in the app that takes the audits. Node's own modules are no package; what
// the product's own files import is the product's.

import { describe, expect, it } from 'vitest';

import { ALLOWED_PACKAGES } from './settings/audit-imports';
import { packageOf, packagesImportedBy } from './support/imports';
import { readRepoFile, walkFiles } from './support/tree';

/** The audits' folders: the release audits, their settings and support; app config's; scripts'. */
const AUDIT_FOLDERS: readonly string[] = [
  'src/release/__tests__',
  'src/config/__tests__',
  'scripts/__tests__',
];
const CODE = /\.(?:[cm]?js|tsx?)$/;

const files = AUDIT_FOLDERS.flatMap((folder) => walkFiles(folder)).filter((file) =>
  CODE.test(file),
);
const found = files.flatMap((file) =>
  packagesImportedBy(file, readRepoFile(file)).map((each) => ({ file, ...each })),
);
const allowed = new Set(ALLOWED_PACKAGES.map((entry) => entry.name));
const at = (each: (typeof found)[number]) => `${each.file}:${each.line} '${each.specifier}'`;

describe('the files the audit reads', () => {
  it("reads every file under the audits' folders, settings and support included", () => {
    expect(files.length).toBeGreaterThan(80);
    [
      'src/release/__tests__/a11y-audit.test.ts',
      'src/release/__tests__/support/phone.ts',
      'src/release/__tests__/settings/index.ts',
      'src/config/__tests__/app-json.ts',
      'scripts/__tests__/release-licences.test.ts',
    ].forEach((file) => expect(files).toContain(file));
    expect(found).toContainEqual(
      expect.objectContaining({
        file: 'src/release/__tests__/audit-imports.test.ts',
        name: 'vitest',
      }),
    );
  });
});

describe('the audits import only what every app has (rule 14.2)', () => {
  it('imports no package outside settings/audit-imports.ts', () => {
    expect(found.filter((each) => !allowed.has(each.name)).map(at)).toEqual([]);
  });

  it('lists only what an audit imports (no stale entry)', () => {
    const imported = new Set(found.map((each) => each.name));
    expect(ALLOWED_PACKAGES.filter((entry) => !imported.has(entry.name))).toEqual([]);
  });

  it('lists each package once, by its own name', () => {
    const names = ALLOWED_PACKAGES.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    names.forEach((name) => expect(packageOf(name), name).toBe(name));
  });
});

describe('the reader, on made-up sources', () => {
  it('finds every way a file can import a package, type-only ones included', () => {
    const source = [
      "import Menu from 'icons-a/icons/menu';",
      "import type { Shape } from 'types-b';",
      "import { type C, d } from '@scope/c/sub';",
      "import 'side-effect-d';",
      "export { e } from 'e-pkg';",
      "export type * from 'f-pkg';",
      "import g = require('g-pkg');",
      "type H = import('h-pkg').H;",
      "const i = await import('i-pkg');",
      "const j = require('j-pkg');",
      "const k = requireFromRoot.resolve('k-pkg/app.plugin.js');",
      "const l = requireFromRoot('l-pkg/data.json');",
      "const m = await vi.importActual('m-pkg');",
      'const n = require.resolve(`n-pkg/cli`);',
    ].join('\n');
    expect(packagesImportedBy('a.ts', source).map((each) => `${each.line} ${each.name}`)).toEqual([
      '1 icons-a',
      '2 types-b',
      '3 @scope/c',
      '4 side-effect-d',
      '5 e-pkg',
      '6 f-pkg',
      '7 g-pkg',
      '8 h-pkg',
      '9 i-pkg',
      '10 j-pkg',
      '11 k-pkg',
      '12 l-pkg',
      '13 m-pkg',
      '14 n-pkg',
    ]);
  });

  it("reads no package out of a path, the '@/' alias, Node's own, a string, a comment or a mock", () => {
    const source = [
      "import { a } from './a';",
      "import { b } from '../../b';",
      "import { c } from '@/lib/c';",
      "import path from 'node:path';",
      "import { readFileSync } from 'fs';",
      'const sample = "import Menu from \'icons-a/icons/menu\';";',
      "// import { x } from 'in-a-comment';",
      "vi.mock('mocked-pkg', () => ({}));",
      'const named = require(name);',
      'const built = requireFromRoot.resolve(`${name}/app.plugin.js`);',
    ].join('\n');
    expect(packagesImportedBy('a.ts', source)).toEqual([]);
  });
});
