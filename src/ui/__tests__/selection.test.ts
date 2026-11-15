// A text field's caret and selection on Android (selection.android.ts): the caret and handles in
// the accent that reads, and a highlight that keeps the selected words readable in every built-in
// palette. iOS's one colour is checked in selection-ios.test.ts: one platform's file per test file.

import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../../core/web/lib/look-kit/contrast';
import { solidOver } from '../../styles/contrast';
import { STYLE_IDS, tokensFor, type Tokens } from '../../styles/tokens';
import { accentInk } from '../accent';
import { tint } from '../paint';
import { SELECTION_WASH, selectionProps } from '../selection.android';

const AA_TEXT = 4.5;
const SCHEMES = ['light', 'dark'] as const;
const PALETTES: readonly Tokens[] = [
  ...new Set(STYLE_IDS.flatMap((style) => SCHEMES.map((scheme) => tokensFor(style, scheme)))),
];
const CANDY = tokensFor('candy', 'light');

describe("a text field's caret and selection on Android", () => {
  it('the caret and handles are the accent that reads, the highlight a wash of it', () => {
    const ink = accentInk(CANDY.colours);
    expect(ink).toBe(CANDY.colours.primary);
    expect(selectionProps(CANDY.colours)).toEqual({
      selectionColor: tint(ink, SELECTION_WASH),
      cursorColor: ink,
      selectionHandleColor: ink,
    });
  });

  it.each(PALETTES.map((tokens) => [`${tokens.style} ${tokens.scheme}`, tokens] as const))(
    '%s: selected words stay readable over the highlight',
    (_name, tokens) => {
      const { colours } = tokens;
      const highlight = selectionProps(colours).selectionColor;
      for (const ground of [colours.card, colours.background]) {
        const behind = solidOver(highlight, ground);
        expect(contrastRatio(colours.foreground, behind), ground).toBeGreaterThanOrEqual(AA_TEXT);
      }
    },
  );
});
