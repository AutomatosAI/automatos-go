// Rules 2.1 and 1.4 (docs/app-standard.md) as a test that keeps running in CI: across every product
// file of every feature and style, no Text outside src/ui/ is handed a colour. A word takes a tone
// (src/ui/variants.ts TEXT_TONES, read through src/ui/tone-colour.ts and measured in every palette by
// src/styles/__tests__/contrast.test.ts), and a state's glyph is StateGlyph's. The scan reads a
// `color` prop, and a `color` in a Text's style: written in place, in a style object the file
// declares, or in an entry of its StyleSheet. A true negative is an ALLOWED entry in
// support/text-tones-allowed.ts, with the file, the exact colours and the reason.

import { describe, expect, it } from 'vitest';

import { textColoursOf, type FoundColour } from './support/text-colour';
import { ALLOWED } from './support/text-tones-allowed';
import { productFiles, readRepoFile } from './support/tree';

/** The one home of a colour handed to Text: the primitives, which read it from a lookup. */
const PRIMITIVES = 'src/ui/';
// The scan reads every product file, as a11y-audit.test.ts's whole-tree scans do.
const WHOLE_TREE_MS = 30_000;

const files = productFiles();
const found = files.flatMap((file) => textColoursOf(file, readRepoFile(file)));
const outside = found.filter((each) => !each.file.startsWith(PRIMITIVES));
const key = (file: string, text: string) => `${file}\n${text}`;
const allowed = new Set(ALLOWED.flatMap((entry) => entry.texts.map((t) => key(entry.file, t))));
const shown = new Set(outside.map((each) => key(each.file, each.text)));
const at = (each: FoundColour) => `${each.file}:${each.line} ${each.text}`;

describe('the tree the scan reads', () => {
  it('reads every feature and style, and the primitives that may colour text', () => {
    expect(files.length).toBeGreaterThan(300);
    const where = new Set(found.map((each) => each.file));
    ['src/ui/StatusPip.tsx', 'src/ui/StateGlyph.tsx', 'src/ui/Pill.tsx']
      .concat(['src/styles/arcade/parts/StatusBar.tsx', 'src/suggestions/HudNext.tsx'])
      .forEach((file) => expect(where).toContain(file));
  });

  it('finds a colour as a prop, in place, in a named style, a branch, a spread or a sheet entry', () => {
    const source = [
      "import { StyleSheet } from 'react-native';",
      "import { Text as Words } from '../../ui';",
      'const styles = StyleSheet.create({ ink: { color: tokens.ink }, gap: { gap: 4 } });',
      'export function A({ on }) {',
      '  const ink = { color: on ? a : b };',
      '  const face = [type.label, { ...shade }];',
      '  return (',
      '    <>',
      '      <Words color={x}>a</Words>',
      '      <Words style={[face, { color }]}>b</Words>',
      '      <Words style={on ? ink : styles.gap}>c</Words>',
      '      <Words style={[styles.ink, { ...{ color: d } }]}>d</Words>',
      '      <Words tone="muted" style={styles.gap}>e</Words>',
      '      <Words style={faceOf(on)}>f</Words>',
      '      <View style={{ color: e }} />',
      '    </>',
      '  );',
      '}',
    ].join('\n');
    expect(textColoursOf('a.tsx', source).map((each) => `${each.through} ${each.text}`)).toEqual([
      'prop color={x}',
      'style color',
      'style color: on ? a : b',
      'style color: tokens.ink',
      'style color: d',
    ]);
  });

  it('reads React Native’s own Text too, and nothing in a file that draws no Text', () => {
    const native =
      "import { Text } from 'react-native';\nconst A = () => <Text style={{ color: c }} />;";
    expect(textColoursOf('n.tsx', native).map((each) => each.text)).toEqual(['color: c']);
    const none = 'const A = () => <Label style={{ color: c }} />;';
    expect(textColoursOf('l.tsx', none)).toEqual([]);
  });
});

describe('no colour is handed to Text outside src/ui/ (rules 2.1, 1.4)', () => {
  it(
    'names a tone, or the colour is ALLOWED',
    () => {
      const refused = outside.filter((each) => !allowed.has(key(each.file, each.text)));
      expect(refused.map(at)).toEqual([]);
    },
    WHOLE_TREE_MS,
  );
});

describe('the ALLOWED list', () => {
  it('allows only what is there and is still handed to Text (no stale entry)', () => {
    const stale = ALLOWED.flatMap((entry) =>
      entry.texts
        .filter((text) => !shown.has(key(entry.file, text)))
        .map((t) => `${entry.file}: ${t}`),
    );
    expect(stale).toEqual([]);
  });

  it('lists each file once, never a primitive, each colour once', () => {
    const named = ALLOWED.map((entry) => entry.file);
    expect(new Set(named).size).toBe(named.length);
    expect(named.filter((file) => file.startsWith(PRIMITIVES))).toEqual([]);
    ALLOWED.forEach((entry) =>
      expect(new Set(entry.texts).size, entry.file).toBe(entry.texts.length),
    );
  });

  it('gives every entry a reviewed reason that names where its colours come from', () => {
    ALLOWED.forEach((entry) => {
      expect(entry.reason.length, entry.file).toBeGreaterThan(120);
      expect(entry.reason, entry.file).toMatch(
        /src\/(?:styles|ui)\/[\w/-]+\.tsx?|src\/styles\/\w+/,
      );
    });
  });
});
