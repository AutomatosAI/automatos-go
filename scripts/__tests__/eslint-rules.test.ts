// The guards in eslint.config.js (US-004c, PRD-001 §4.11), proved on snippets linted with
// ESLint's Node API under the repo's real config: each rule fires where it should and stays
// silent where it is allowed. The snippets never touch disk; filePath only places them.
import path from 'node:path';

import { ESLint, type Linter } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO = path.resolve(__dirname, '../..');
const eslint = new ESLint({ cwd: REPO });

async function messages(code: string, file: string): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(REPO, file) });
  return result?.messages ?? [];
}

async function rules(code: string, file: string): Promise<string[]> {
  return (await messages(code, file)).map((m) => m.ruleId ?? 'parse-error');
}

const lines = (count: number, line: (n: number) => string) =>
  Array.from({ length: count }, (_, n) => line(n)).join('\n');

/** A function spanning exactly `total` counted lines (header, body, closing brace). */
const functionOf = (total: number, name = 'f') =>
  `export function ${name}(): number {\n  let x = 0;\n` +
  `${lines(total - 4, () => '  x += 1;')}\n  return x;\n}\n`;

/** A function whose cyclomatic complexity is exactly `score`. */
const complexityOf = (score: number) =>
  `export function f(a: number): number {\n` +
  `${lines(score - 1, (n) => `  if (a === ${n}) return ${n};`)}\n  return -1;\n}\n`;

/** `levels` nested blocks inside one function. */
const depthOf = (levels: number) =>
  `export function f(a: number): number {\n` +
  `${lines(levels, (n) => `${'  '.repeat(n + 1)}if (a > ${n}) {`)}\n` +
  `${'  '.repeat(levels + 1)}return a;\n` +
  `${lines(levels, (n) => `${'  '.repeat(levels - n)}}`)}\n  return 0;\n}\n`;

beforeAll(async () => {
  await rules('export const warm = 1;\n', 'src/warm.ts'); // loads the expo config's plugins
}, 60_000);

describe('one way in: HTTP only through src/api (D-ONE-CLIENT)', () => {
  const call = "export const go = () => fetch('https://example.org');\n";

  it.each(['src/chat/send.ts', 'app/(app)/index.tsx', 'src/core/parity/replay.ts', 'scripts/x.ts'])(
    'refuses fetch() in %s',
    async (file) => {
      expect(await rules(call, file)).toContain('no-restricted-globals');
    },
  );

  it('allows fetch() in src/api/**', async () => {
    expect(await rules(call, 'src/api/transport.ts')).not.toContain('no-restricted-globals');
    expect(await rules(call, 'src/api/__tests__/x.test.ts')).not.toContain('no-restricted-globals');
  });

  it.each([
    ['XMLHttpRequest', 'export const xhr = new XMLHttpRequest();\n', 'no-restricted-globals'],
    ['globalThis.fetch', 'export const f = globalThis.fetch;\n', 'no-restricted-properties'],
    ['window.XMLHttpRequest', 'export const x = window.XMLHttpRequest;\n', 'no-restricted-properties'],
  ])('refuses %s outside src/api and allows it inside', async (_name, code, rule) => {
    expect(await rules(code, 'src/cc/board.ts')).toContain(rule);
    expect(await rules(code, 'src/api/client.ts')).not.toContain(rule);
  });

  it('a local binding named fetch is not the global', async () => {
    const code = 'export const load = (fetch: () => void) => fetch();\n';
    expect(await rules(code, 'src/chat/send.ts')).not.toContain('no-restricted-globals');
  });
});

describe('restricted imports', () => {
  const expoFetch = "export { fetch } from 'expo/fetch';\nimport 'expo/fetch';\n";

  it('expo/fetch is imported by src/api/transport.ts only', async () => {
    expect(await rules(expoFetch, 'src/api/transport.ts')).not.toContain('no-restricted-imports');
    expect(await rules(expoFetch, 'src/api/client.ts')).toContain('no-restricted-imports');
    expect(await rules(expoFetch, 'app/_layout.tsx')).toContain('no-restricted-imports');
  });

  it.each([
    ['src/api/transport.ts', "import 'react-native-webview';\n"],
    ['app/(app)/index.tsx', "export { WebView } from 'react-native-webview';\n"],
    ['src/ui/viewer.tsx', "import 'react-native-webview/lib/WebView';\n"],
    ['src/core/turn-reducer.ts', "import 'react-native-webview';\n"],
  ])('refuses react-native-webview everywhere (%s)', async (file, code) => {
    expect(await rules(code, file)).toContain('no-restricted-imports');
  });

  it.each([
    ['src/core/turn-reducer.ts', "import 'react';\n"],
    ['src/core/ai-sdk-stream.ts', "import 'react-native';\n"],
    ['src/core/ai-sdk-stream.ts', "import 'react-native-mmkv';\n"],
    ['src/core/turn-reducer.ts', "import 'expo';\n"],
    ['src/core/turn-reducer.ts', "import 'expo-crypto';\n"],
    ['src/core/parity/replay.ts', "import 'expo-file-system/legacy';\n"],
    ['src/core/parity/corpus.ts', "import '@expo/vector-icons';\n"],
  ])('the hand-written core is pure: %s may not import %s', async (file, code) => {
    expect(await rules(code, file)).toContain('no-restricted-imports');
  });

  it('the core may import zod and its own modules; src/api may import react-native', async () => {
    const pure = "import 'zod';\nimport './web/lib/chat/errors';\n";
    expect(await rules(pure, 'src/core/turn-reducer.ts')).not.toContain('no-restricted-imports');
    const native = "import 'react-native';\nimport 'expo-crypto';\n";
    expect(await rules(native, 'src/api/transport.ts')).not.toContain('no-restricted-imports');
  });
});

describe('size limits (D-SHAPE)', () => {
  const fileOf = (count: number) => `${lines(count, (n) => `export const a${n} = ${n};`)}\n`;

  it('a file over 400 lines warns, over 800 fails, 400 is silent', async () => {
    expect(await rules(fileOf(400), 'src/x.ts')).toEqual([]);
    const target = await messages(fileOf(401), 'src/x.ts');
    expect(target.map((m) => [m.ruleId, m.severity])).toEqual([['shape/target-file-lines', 1]]);
    const max = await messages(fileOf(801), 'src/x.ts');
    expect(max.map((m) => [m.ruleId, m.severity])).toContainEqual(['max-lines', 2]);
  });

  it('a .ts function may have 50 lines, not 51; blank lines and comments do not count', async () => {
    expect(await rules(functionOf(50), 'src/x.ts')).not.toContain('max-lines-per-function');
    expect(await rules(functionOf(51), 'src/x.ts')).toContain('max-lines-per-function');
    const padded = functionOf(50).replace('  return x;', '\n  // why\n\n  return x;');
    expect(await rules(padded, 'src/x.ts')).not.toContain('max-lines-per-function');
  });

  it('a .tsx function (a component) may have 150 lines, not 151', async () => {
    const component = (total: number) => functionOf(total, 'Board');
    expect(await rules(component(150), 'src/cc/board.tsx')).not.toContain('max-lines-per-function');
    expect(await rules(component(151), 'src/cc/board.tsx')).toContain('max-lines-per-function');
  });

  it('a test callback may be long (as in the web), a test file still has the file limits', async () => {
    const suite = `import { it } from 'vitest';\nit('x', () => {\n${lines(80, () => '  void 0;')}\n});\n`;
    expect(await rules(suite, 'src/api/__tests__/x.test.ts')).toEqual([]);
    expect(await rules(fileOf(801), 'src/api/__tests__/x.test.ts')).toContain('max-lines');
  });

  it('nesting: depth 4 passes, depth 5 fails', async () => {
    expect(await rules(depthOf(4), 'src/x.ts')).not.toContain('max-depth');
    expect(await rules(depthOf(5), 'src/x.ts')).toContain('max-depth');
  });

  it('complexity: 10 passes, 11 fails', async () => {
    expect(await rules(complexityOf(10), 'src/x.ts')).not.toContain('complexity');
    expect(await rules(complexityOf(11), 'src/x.ts')).toContain('complexity');
  });
});

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

  it('allows a colour in src/styles/tokens/** and the AI label', async () => {
    const code = "export const c = '#ff6b35';\nexport const d = 'rgba(0,0,0,0.5)';\n";
    expect(await rules(code, 'src/styles/tokens/colors.ts')).toEqual([]);
    expect(await rules(code, 'src/styles/tokens/studio/dark.ts')).toEqual([]);
    expect(await rules(code, 'src/styles/ai-label.tsx')).toEqual([]);
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

describe('console stays in the logger', () => {
  it('refuses console outside src/lib/logger.ts', async () => {
    const code = "console.warn('x');\n";
    expect(await rules(code, 'src/api/client.ts')).toContain('no-console');
    expect(await rules(code, 'src/lib/logger.ts')).toEqual([]);
  });
});
