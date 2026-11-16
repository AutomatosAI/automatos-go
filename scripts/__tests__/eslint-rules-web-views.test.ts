// No web view in any form (D-NO-WEBVIEW, docs/app-standard.md rule 13.8), as eslint.config.js
// refuses it beside react-native-webview (eslint-rules.test.ts): Expo's DOM components, which run
// in a web view, by their 'use dom' directive in any file and by expo/dom or @expo/dom-webview
// however they are loaded. src/release/__tests__/dependency-audit.test.ts keeps the packages out.
import { beforeAll, describe, expect, it } from 'vitest';

import { rules, said, warm, WARM_TIMEOUT } from './eslint-rules-helpers';

const DOM_MESSAGE =
  "No DOM components (D-NO-WEBVIEW): a 'use dom' component runs in a web view. Draw it with React Native.";
const EVERY_KIND_OF_FILE = [
  'src/ui/chart.tsx',
  'app/(app)/index.tsx',
  'src/api/client.ts',
  'src/styles/tokens/studio.ts',
  'src/core/turn-reducer.ts',
  'src/ui/__tests__/chart.test.ts',
  'scripts/x.ts',
];

beforeAll(warm, WARM_TIMEOUT);

describe("the 'use dom' directive (rule 13.8)", () => {
  it.each(EVERY_KIND_OF_FILE)('is refused in %s', async (file) => {
    const code = "'use dom';\n\nexport default function Chart() {\n  return null;\n}\n";
    expect(await said(code, file, 'no-restricted-syntax')).toEqual([DOM_MESSAGE]);
  });

  it('is refused in double quotes and inside a function', async () => {
    const quoted = '"use dom";\nexport default function Chart() {\n  return null;\n}\n';
    expect(await said(quoted, 'src/ui/chart.tsx', 'no-restricted-syntax')).toEqual([DOM_MESSAGE]);
    const inner = "export function chart() {\n  'use dom';\n  return null;\n}\n";
    expect(await said(inner, 'src/ui/chart.tsx', 'no-restricted-syntax')).toEqual([DOM_MESSAGE]);
  });

  it('allows the words as a string and the other directives', async () => {
    const code = [
      "'use client';",
      "export const words = 'use dom';",
      "export function f() {\n  'use strict';\n  return words;\n}",
    ].join('\n');
    expect(await rules(`${code}\n`, 'src/ui/chart.tsx')).not.toContain('no-restricted-syntax');
  });
});

describe('expo/dom and @expo/dom-webview, however they are loaded (rule 13.8)', () => {
  it.each([
    "import 'expo/dom';\n",
    "import { useDOMImperativeHandle } from 'expo/dom';\nexport const h = useDOMImperativeHandle;\n",
    "export { emitDomEvent } from 'expo/dom/global';\n",
    "import 'expo/dom/internal';\n",
    "import 'expo/src/dom/webview-wrapper';\n",
    "import { WebView } from '@expo/dom-webview';\nexport const w = WebView;\n",
    "import '@expo/dom-webview/build/index';\n",
  ])('refuses %s everywhere, src/api and the tokens included', async (code) => {
    for (const file of EVERY_KIND_OF_FILE) {
      const found = await said(code, file, 'no-restricted-imports');
      expect(found.some((message) => message.includes(DOM_MESSAGE))).toBe(true);
    }
  });

  it.each([
    ["require('@expo/dom-webview')", "export const w = require('@expo/dom-webview');\n"],
    ["import('expo/dom')", "export const d = () => import('expo/dom');\n"],
    ["import('expo/dom/internal')", "export const d = () => import('expo/dom/internal');\n"],
    ["require('expo/src/dom/dom')", "export const d = require('expo/src/dom/dom');\n"],
  ])('refuses %s everywhere', async (_name, code) => {
    for (const file of EVERY_KIND_OF_FILE) {
      expect(await rules(code, file)).toContain('no-restricted-syntax');
    }
  });

  it("allows expo's other entry points and a name that only starts like one", async () => {
    const code = [
      "import { registerRootComponent } from 'expo';",
      "import Constants from 'expo-constants';",
      "export const later = () => import('expo-domain-like');",
      'export const parts = [registerRootComponent, Constants];',
    ].join('\n');
    const found = await rules(`${code}\n`, 'src/ui/chart.tsx');
    expect(found).not.toContain('no-restricted-imports');
    expect(found).not.toContain('no-restricted-syntax');
  });
});
