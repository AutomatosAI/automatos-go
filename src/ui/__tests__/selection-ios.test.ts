// A text field's caret and selection on iOS (selection.ts): one colour, the accent that reads.
// iOS washes the selected words with it by itself.

import { describe, expect, it } from 'vitest';

import { tokensFor } from '../../styles/tokens';
import { selectionProps } from '../selection';

describe("a text field's caret and selection on iOS", () => {
  it('is the accent that reads, and nothing else is set', () => {
    const candy = tokensFor('candy', 'light').colours;
    const studio = tokensFor('studio', 'light').colours;
    expect(selectionProps(candy)).toEqual({ selectionColor: candy.primary });
    expect(selectionProps(studio)).toEqual({ selectionColor: studio.accent });
  });
});
