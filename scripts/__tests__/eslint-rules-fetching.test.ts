// What fetches or sends by address on its own, outside the one API client (docs/app-standard.md
// rule 13.2), refused by eslint.config.js: react-native-svg's pictures loaded by address.
import { beforeAll, describe, expect, it } from 'vitest';

import { rules, said, warm, WARM_TIMEOUT } from './eslint-rules-helpers';

const SVG_MESSAGE =
  'A picture is fetched through src/api/ (D-ONE-CLIENT): fetch its text with the API client and draw it with SvgXml.';

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
