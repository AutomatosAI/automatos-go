// The colour guard in eslint.config.js (D-TOKENS, docs/app-standard.md rule 1.1): no colour
// literal in src/** or app/** outside src/styles/tokens/**.
import { beforeAll, describe, expect, it } from 'vitest';

import { rules, warm, WARM_TIMEOUT } from './eslint-rules-helpers';

beforeAll(warm, WARM_TIMEOUT);

describe('no colour literals outside the tokens (D-TOKENS)', () => {
  it.each([
    "export const c = '#fff';\n",
    "export const c = '#1A2b3C';\n",
    "export const c = '#1a2b3c80';\n",
    "export const c = 'rgb(0, 0, 0)';\n",
    "export const c = 'rgba(0,0,0,0.5)';\n",
    "export const c = 'hsl(10 20% 30%)';\n",
    "export const c = 'hsla(10, 20%, 30%, 0.5)';\n",
    "export const c = { borderColor: '1px solid #abcdef' };\n",
    'export const c = (a: number) => `rgba(0, 0, 0, ${a})`;\n',
  ])('refuses %s in app/', async (code) => {
    expect(await rules(code, 'app/(app)/index.tsx')).toContain('no-restricted-syntax');
  });

  it('refuses a colour in src/ui and in src/styles outside the tokens', async () => {
    const code = "export const c = '#ff6b35';\n";
    expect(await rules(code, 'src/ui/button.tsx')).toContain('no-restricted-syntax');
    expect(await rules(code, 'src/styles/theme.ts')).toContain('no-restricted-syntax');
  });

  it('allows a colour only in src/styles/tokens/**', async () => {
    const code = "export const c = '#ff6b35';\nexport const d = 'rgba(0,0,0,0.5)';\n";
    expect(await rules(code, 'src/styles/tokens/colors.ts')).toEqual([]);
    expect(await rules(code, 'src/styles/tokens/studio/dark.ts')).toEqual([]);
    expect(await rules(code, 'src/styles/ai-label.tsx')).toContain('no-restricted-syntax');
  });

  it('allows what is not a colour: ticket numbers, anchors, words, scripts/', async () => {
    const code = [
      "export const ticket = '#0422';",
      "export const big = '#1234567';",
      "export const anchor = '/docs#defaults';",
      "export const word = 'a hsl value, rgb or #hash';",
    ].join('\n');
    expect(await rules(`${code}\n`, 'src/cc/board.ts')).toEqual([]);
    expect(await rules("export const c = '#fff';\n", 'scripts/x.ts')).toEqual([]);
  });
});
