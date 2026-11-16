// What fetches or sends by address on its own, outside the one API client (docs/app-standard.md
// rule 13.2), refused by eslint.config.js: react-native-svg's pictures loaded by address, and the
// file system's own downloads and uploads, which only src/api/ (src/api/transfer.ts) may name.
import { beforeAll, describe, expect, it } from 'vitest';

import { rules, said, warm, WARM_TIMEOUT } from './eslint-rules-helpers';

const SVG_MESSAGE =
  'A picture is fetched through src/api/ (D-ONE-CLIENT): fetch its text with the API client and draw it with SvgXml.';
const TRANSFER_MESSAGE =
  'Fetch or send a file through src/api/transfer.ts (rule 13.2): the file system never fetches or sends by address on its own.';
const FILE_SYSTEM_LOADED = `Import expo-file-system statically (File, Paths, Directory), so the guard reads the names. ${TRANSFER_MESSAGE}`;

beforeAll(warm, WARM_TIMEOUT);

describe('no picture fetched by address by react-native-svg (rule 13.2)', () => {
  const PLACES = ['src/ui/picture.tsx', 'app/(app)/index.tsx', 'src/api/client.ts', 'scripts/x.ts'];

  it.each([
    ['SvgUri', 'react-native-svg'],
    ['SvgFromUri', 'react-native-svg'],
    ['fetchText', 'react-native-svg'],
    ['SvgCssUri', 'react-native-svg'],
    ['SvgCssUri', 'react-native-svg/css'],
    ['SvgWithCssUri', 'react-native-svg/css'],
    ['LocalSvg', 'react-native-svg/css'],
    ['WithLocalSvg', 'react-native-svg/css'],
    ['loadLocalRawResource', 'react-native-svg/css'],
  ])('refuses %s from %s everywhere, src/api included', async (name, from) => {
    const code = `import { ${name} as Picture } from '${from}';\nexport const p = Picture;\n`;
    for (const file of PLACES) {
      const found = await said(code, file, 'no-restricted-imports');
      expect(found.map((message) => message.includes(SVG_MESSAGE))).toEqual([true]);
    }
  });

  it('refuses a re-export, a namespace import (it carries every name) and an export *', async () => {
    const reExport = "export { SvgUri } from 'react-native-svg';\n";
    expect(await rules(reExport, 'src/ui/picture.tsx')).toContain('no-restricted-imports');
    const namespace = [
      "import * as Svg from 'react-native-svg';",
      "export const P = () => <Svg.SvgUri uri='/a.svg' />;",
    ].join('\n');
    expect(await rules(`${namespace}\n`, 'src/ui/picture.tsx')).toContain('no-restricted-imports');
    const everything = "export * from 'react-native-svg/css';\n";
    expect(await rules(everything, 'src/ui/picture.tsx')).toContain('no-restricted-imports');
  });

  it("refuses the package's own files, where the same names sit out of the guard's sight", async () => {
    for (const from of ['react-native-svg/src/xml', 'react-native-svg/lib/module/xml']) {
      const code = `import { SvgUri } from '${from}';\nexport const p = SvgUri;\n`;
      expect(await rules(code, 'src/ui/picture.tsx')).toContain('no-restricted-imports');
    }
  });

  it.each([
    ["require('react-native-svg')", "export const s = require('react-native-svg').SvgUri;\n"],
    ["import('react-native-svg')", "export const s = () => import('react-native-svg');\n"],
    ["import('react-native-svg/css')", "export const s = () => import('react-native-svg/css');\n"],
  ])('refuses %s: the guard reads names from a static import only', async (_name, code) => {
    for (const file of PLACES) {
      const found = await said(code, file, 'no-restricted-syntax');
      expect(found.some((message) => message.includes(SVG_MESSAGE))).toBe(true);
    }
  });

  it('allows the shapes, SvgXml, SvgCss and the public entry points', async () => {
    const code = [
      "import Svg, { Circle, Path, SvgXml } from 'react-native-svg';",
      "import { SvgCss, inlineStyles } from 'react-native-svg/css';",
      "import { FilterImage } from 'react-native-svg/filter-image';",
      "import type { UriProps } from 'react-native-svg';",
      'export const parts = [Svg, Circle, Path, SvgXml, SvgCss, inlineStyles, FilterImage];',
      'export type Props = UriProps;',
    ].join('\n');
    expect(await rules(`${code}\n`, 'src/ui/picture.tsx')).toEqual([]);
  });
});

describe("the file system's own transfers only in src/api (rule 13.2)", () => {
  it.each([
    ['File.downloadFileAsync', 'export const d = (t: never) => File.downloadFileAsync("/a", t);'],
    ['FileSystem.downloadAsync', 'export const d = () => FileSystem.downloadAsync("/a", "b");'],
    ['FileSystem.uploadAsync', 'export const u = () => FileSystem.uploadAsync("/a", "b");'],
    [
      'FileSystem.createDownloadResumable',
      'export const r = () => FileSystem.createDownloadResumable("/a", "b");',
    ],
    ['FileSystem.createUploadTask', 'export const t = () => FileSystem.createUploadTask("/a", "b");'],
    ['new FileSystem.DownloadResumable', 'export const r = () => new FileSystem.DownloadResumable();'],
    ['new FileSystem.UploadTask', 'export const t = () => new FileSystem.UploadTask("/a", "b");'],
    ['a resumable, resumed', 'export const r = (task: { downloadAsync(): void }) => task.downloadAsync();'],
    ['a computed member', "export const d = () => File['downloadFileAsync'];"],
    ['a destructured name', 'export const { uploadAsync } = FileSystem;'],
    // since 16 Nov: the name written as text
    ['a string key in a destructuring', "export const { 'downloadAsync': d } = FileSystem;"],
    ['a computed string key', "export const { ['uploadAsync']: u } = FileSystem;"],
    ['a template member', 'export const d = () => File[`downloadFileAsync`];'],
    ['a template key', 'export const { [`createUploadTask`]: c } = FileSystem;'],
  ])('refuses %s outside src/api and allows it inside', async (_name, line) => {
    const code = `declare const File: any;\ndeclare const FileSystem: any;\n${line}\n`;
    for (const file of ['src/styles/themes/files.ts', 'app/(app)/index.tsx', 'scripts/x.ts']) {
      expect(await said(code, file, 'no-restricted-syntax')).toEqual([TRANSFER_MESSAGE]);
    }
    expect(await rules(code, 'src/api/transfer.ts')).not.toContain('no-restricted-syntax');
  });

  it.each([
    ['expo-file-system', 'downloadAsync'],
    ['expo-file-system', 'createUploadTask'],
    ['expo-file-system/legacy', 'downloadAsync'],
    ['expo-file-system/legacy', 'uploadAsync'],
    ['expo-file-system/legacy', 'createDownloadResumable'],
    ['expo-file-system/legacy', 'createUploadTask'],
    ['expo-file-system/legacy', 'DownloadResumable'],
    ['expo-file-system/legacy', 'UploadTask'],
    ['expo-file-system/next', 'uploadAsync'],
    ['expo-file-system/src/legacy', 'downloadAsync'],
  ])('refuses importing %s %s outside src/api and allows it inside', async (from, name) => {
    const code = `import { ${name} as transfer } from '${from}';\nexport const t = transfer;\n`;
    for (const file of ['src/cc/deliverables/open-file.ts', 'src/core/turn-reducer.ts']) {
      const found = await said(code, file, 'no-restricted-imports');
      expect(found.some((message) => message.includes(TRANSFER_MESSAGE))).toBe(true);
    }
    expect(await rules(code, 'src/api/transfer.ts')).not.toContain('no-restricted-imports');
    expect(await rules(code, 'src/api/__tests__/transfer.test.ts')).not.toContain(
      'no-restricted-imports',
    );
  });

  // since 16 Nov: the package's members cannot be followed from a require() or an import()
  it.each([
    ["require('expo-file-system')", "export const fs = require('expo-file-system');\n"],
    ["require('expo-file-system/legacy')", "export const fs = require('expo-file-system/legacy');\n"],
    ["import('expo-file-system')", "export const fs = () => import('expo-file-system');\n"],
    ["import('expo-file-system/next')", "export const fs = () => import('expo-file-system/next');\n"],
  ])('refuses %s outside src/api and allows it inside', async (_name, code) => {
    for (const file of ['src/voice/server/speech-files.ts', 'app/(app)/index.tsx', 'scripts/x.ts']) {
      expect(await said(code, file, 'no-restricted-syntax')).toEqual([FILE_SYSTEM_LOADED]);
    }
    expect(await rules(code, 'src/api/transfer.ts')).not.toContain('no-restricted-syntax');
  });

  it('refuses a namespace import of the file system outside src/api, as it carries them all', async () => {
    const code = "import * as FileSystem from 'expo-file-system/legacy';\nexport const f = FileSystem;\n";
    expect(await rules(code, 'src/voice/server/speech-files.ts')).toContain('no-restricted-imports');
    expect(await rules(code, 'src/api/transfer.ts')).not.toContain('no-restricted-imports');
  });

  it("allows the file system's local work everywhere, and a test's fake of a transfer", async () => {
    const local = [
      "import { Directory, File, Paths } from 'expo-file-system';",
      "import { readAsStringAsync, deleteAsync } from 'expo-file-system/legacy';",
      "export const read = () => new File(new Directory(Paths.cache), 'a.txt').text();",
      'export const old = [readAsStringAsync, deleteAsync];',
    ].join('\n');
    expect(await rules(`${local}\n`, 'src/voice/server/speech-files.ts')).toEqual([]);
    const lookAlike = "export const x = () => import('expo-file-systems');\n";
    expect(await rules(lookAlike, 'src/voice/server/speech-files.ts')).not.toContain(
      'no-restricted-syntax',
    );
    const otherKeys = "declare const FileSystem: any;\nexport const { 'readAsStringAsync': r } = FileSystem;\n";
    expect(await rules(otherKeys, 'src/voice/server/speech-files.ts')).toEqual([]);
    const fake = 'export class FakeFile {\n  static async downloadFileAsync() {\n    return 1;\n  }\n}\n';
    expect(await rules(fake, 'src/cc/__tests__/open-file.test.ts')).toEqual([]);
  });

  it('src/api/ still refuses a colour and a picture fetched by address', async () => {
    const code = "import { SvgUri } from 'react-native-svg';\nexport const c = [SvgUri, '#fff'];\n";
    const found = await rules(code, 'src/api/transfer.ts');
    expect(found).toContain('no-restricted-imports');
    expect(found).toContain('no-restricted-syntax');
  });
});
