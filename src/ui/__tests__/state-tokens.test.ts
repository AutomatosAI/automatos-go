// PRD-268 §6.12.2's colour roles for its states (read from STATE_WORDS through STATUS_STATES, not
// copied): every state has a role, the role is the table's, a light ground swaps the two roles that
// fail there for their stand-ins, the word is muted except Needs you's, and olive and navy are
// never a status's colour (US-T01's choice). Measured, as §6.12.2 asks, on background and card in
// every Studio, theme and Play style: each glyph at least 3:1 (a mark), each word 4.5:1 (text).

import { describe, expect, it } from 'vitest';

import { AA_NON_TEXT, AA_TEXT, contrastRatio } from '../../core/web/lib/look-kit/contrast';
import { STATUS_STATES } from '../../styles/dress/status-glyphs';
import { PLAY_STYLES, STUDIO_STYLES } from '../../styles/dress/__tests__/fixtures';
import { LIGHT_STAND_INS, STATE_TOKENS, STATE_WORD_TOKEN, statePaint } from '../state-tokens';

const PAINTED = [...STUDIO_STYLES, ...PLAY_STYLES];

describe('the states’ colour roles', () => {
  it('give every state a role, and only the states', () => {
    expect(Object.keys(STATE_TOKENS)).toEqual([...STATUS_STATES]);
  });

  it("are §6.12.2's table", () => {
    expect(STATE_TOKENS).toEqual({
      needs_you: 'warning',
      working: 'running',
      ready: 'success',
      done: 'success',
      failed: 'destructive',
      needs_setup: 'info',
      not_checked: 'mutedForeground',
    });
  });

  it('paint the role on a dark ground and its stand-in on a light one', () => {
    expect(statePaint('needs_you', 'dark')).toEqual({ glyph: 'warning', word: 'warnInk' });
    expect(statePaint('needs_you', 'light')).toEqual({ glyph: 'warnInk', word: 'warnInk' });
    expect(statePaint('working', 'dark').glyph).toBe('running');
    expect(statePaint('working', 'light').glyph).toBe('mutedForeground');
    for (const state of STATUS_STATES) {
      const role = STATE_TOKENS[state];
      expect(statePaint(state, 'light').glyph, state).toBe(LIGHT_STAND_INS[role] ?? role);
    }
  });

  it('say every word muted but Needs you’s', () => {
    for (const state of STATUS_STATES) {
      const word = statePaint(state, 'light').word;
      expect(word, state).toBe(state === 'needs_you' ? 'warnInk' : STATE_WORD_TOKEN);
    }
  });

  it('never paint a state in olive, navy or the accent', () => {
    for (const state of STATUS_STATES) {
      for (const scheme of ['light', 'dark'] as const) {
        const { glyph, word } = statePaint(state, scheme);
        for (const token of [glyph, word]) {
          expect(['olive', 'navy', 'accent'], `${state} ${scheme}`).not.toContain(token);
        }
      }
    }
  });
});

describe('the states’ contrast, on background and card', () => {
  it.each(PAINTED.map((style) => [`${style.tokens.style} ${style.tokens.scheme}`, style]))(
    '%s: every glyph is a 3:1 mark and every word 4.5:1 text',
    (_name, style) => {
      const { colours, scheme } = style.tokens;
      for (const state of STATUS_STATES) {
        const { glyph, word } = statePaint(state, scheme);
        for (const ground of [colours.background, colours.card]) {
          expect(contrastRatio(colours[glyph], ground), `${state} glyph`).toBeGreaterThanOrEqual(
            AA_NON_TEXT,
          );
          expect(contrastRatio(colours[word], ground), `${state} word`).toBeGreaterThanOrEqual(
            AA_TEXT,
          );
        }
      }
    },
  );

  it('would fail on a light ground without the stand-ins', () => {
    const light = STUDIO_STYLES.find((style) => style.tokens.scheme === 'light');
    const colours = light?.tokens.colours;
    expect(colours).toBeDefined();
    if (!colours) return;
    for (const role of Object.keys(LIGHT_STAND_INS) as (keyof typeof colours)[]) {
      expect(contrastRatio(colours[role], colours.background), role).toBeLessThan(AA_NON_TEXT);
    }
  });
});
