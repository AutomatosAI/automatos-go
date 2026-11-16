// The colour guard in eslint.config.js (D-TOKENS, docs/app-standard.md rule 1.1): no colour
// written in src/** or app/** outside src/styles/tokens/**, in any form React Native reads one:
// #rgb, #rgba, #rrggbb, #rrggbbaa, the rgb(), rgba(), hsl(), hsla() and hwb() functions, and, where
// a colour goes, a colour's name. Four decimal digits are the board's ticket number (#0422)
// except where a colour goes.
import { beforeAll, describe, expect, it } from 'vitest';

import { rules, said, warm, WARM_TIMEOUT } from './eslint-rules-helpers';

const COLOUR_MESSAGE = 'Colour literal (D-TOKENS): read the colour from src/styles/tokens.';

beforeAll(warm, WARM_TIMEOUT);

describe('no colour literals outside the tokens (D-TOKENS)', () => {
  it.each([
    "export const c = '#fff';\n",
    "export const c = '#fff8';\n",
    "export const c = '#000a';\n",
    "export const c = '#1A2b3C';\n",
    "export const c = '#1a2b3c80';\n",
    "export const c = 'rgb(0, 0, 0)';\n",
    "export const c = 'rgba(0,0,0,0.5)';\n",
    "export const c = 'hsl(10 20% 30%)';\n",
    "export const c = 'hsla(10, 20%, 30%, 0.5)';\n",
    "export const c = 'hwb(10 20% 30%)';\n",
    "export const c = { borderColor: '1px solid #abcdef' };\n",
    "export const c = { shadow: '0 1px #0f0a' };\n",
    'export const c = (a: number) => `rgba(0, 0, 0, ${a})`;\n',
    'export const c = (a: string) => `${a} #abcd`;\n',
  ])('refuses %s in app/', async (code) => {
    expect(await said(code, 'app/(app)/index.tsx', 'no-restricted-syntax')).toEqual([
      COLOUR_MESSAGE,
    ]);
  });

  it('refuses a colour in src/ui, in src/api and in src/styles outside the tokens', async () => {
    const code = "export const c = '#ff6b35';\nexport const d = '#f63a';\n";
    for (const file of ['src/ui/button.tsx', 'src/api/client.ts', 'src/styles/theme.ts']) {
      expect(await said(code, file, 'no-restricted-syntax')).toEqual([
        COLOUR_MESSAGE,
        COLOUR_MESSAGE,
      ]);
    }
  });

  it('allows a colour only in src/styles/tokens/**', async () => {
    const code = [
      "export const c = '#ff6b35';",
      "export const d = 'rgba(0,0,0,0.5)';",
      "export const e = '#f63a';",
      "export const f = { color: 'white', backgroundColor: '#0008' };",
    ].join('\n');
    expect(await rules(`${code}\n`, 'src/styles/tokens/colors.ts')).toEqual([]);
    expect(await rules(`${code}\n`, 'src/styles/tokens/studio/dark.ts')).toEqual([]);
    expect(await rules(`${code}\n`, 'src/styles/ai-label.tsx')).toContain('no-restricted-syntax');
  });

  it('allows what is not a colour: ticket numbers, anchors, words, scripts/', async () => {
    const code = [
      "export const ticket = '#0422';",
      "export const moved = 'I moved #0422 to Done.';",
      "export const longer = '#10422';",
      "export const big = '#1234567';",
      "export const anchor = '/docs#defaults';",
      "export const word = 'a hsl value, rgb or #hash, hwb too';",
      'export const named = (n: number) => `#${n}`;',
    ].join('\n');
    expect(await rules(`${code}\n`, 'src/cc/board.ts')).toEqual([]);
    expect(await rules("export const c = '#fff';\n", 'scripts/x.ts')).toEqual([]);
  });
});

describe('where a colour goes, four digits and a name are colours too (rule 1.1)', () => {
  it.each([
    "export const s = { color: 'white' };\n",
    "export const s = { backgroundColor: 'black' };\n",
    "export const s = { borderTopColor: 'red' };\n",
    "export const s = (on: boolean) => ({ tintColor: on ? 'rebeccapurple' : 'transparent' });\n",
    "export const s = { placeholderTextColor: 'gray' };\n",
    "export const s = { backgroundColor: '#0008' };\n",
    "export const s = (on: boolean) => ({ shadowColor: on ? '#0422' : 'transparent' });\n",
  ])('refuses %s', async (code) => {
    expect(await said(code, 'src/ui/button.tsx', 'no-restricted-syntax')).toEqual([
      COLOUR_MESSAGE,
    ]);
  });

  it("refuses one in a component's colour props, a ternary's branches included", async () => {
    const code = [
      'const Icon = (_: { color?: string; fill?: string; colors?: string[] }) => null;',
      'export const A = () => <Icon color="white" />;',
      "export const B = (on: boolean) => <Icon fill={on ? 'black' : 'transparent'} />;",
      "export const C = () => <Icon colors={['red', '#0008']} />;",
    ].join('\n');
    expect(await said(`${code}\n`, 'src/ui/icon.tsx', 'no-restricted-syntax')).toEqual([
      COLOUR_MESSAGE,
      COLOUR_MESSAGE,
      COLOUR_MESSAGE,
      COLOUR_MESSAGE,
    ]);
  });

  it("allows 'transparent', a token, and a token's name that is also a colour's", async () => {
    const code = [
      'const tokens = { colours: { foreground: 0 } };',
      "export const s = { backgroundColor: 'transparent', color: tokens.colours.foreground };",
      "export const tone = { ink: 'olive', fill: 'olive', alpha: 0.15 };",
      "export const look = { colours: { ink: 'navy' }, colour: 'red' };",
      "export const t = { tone: 'red', label: 'white', colorScheme: 'dark', number: '#0422' };",
      "export const u = (kind: string) => (kind === 'white' ? 1 : 2);",
    ].join('\n');
    expect(await rules(`${code}\n`, 'src/ui/button.tsx')).toEqual([]);
  });
});
