// PRD-268 §6.12.2's colour roles for its states (read from STATE_WORDS through STATUS_STATES, not
// copied): every state has a role, the role is the table's, a light ground swaps the two roles that
// fail there for their stand-ins, the word is a Text tone, muted except Needs you's (warning, in
// warn-ink), and olive and navy are never a status's colour (US-T01's choice). Measured, as §6.12.2
// asks, on background and card in every Studio, theme and Play style: each glyph at least 3:1 (a
// mark), each word 4.5:1 (text).

import { describe, expect, it } from 'vitest';

import { AA_NON_TEXT, AA_TEXT, contrastRatio } from '../../core/web/lib/look-kit/contrast';
import { STATUS_STATES, statusGlyph } from '../../styles/dress/status-glyphs';
import { PLAY_STYLES, STUDIO_STYLES } from '../../styles/dress/__tests__/fixtures';
import {
  LIGHT_STAND_INS,
  STATE_TOKENS,
  STATE_WORD_TONE,
  glyphToken,
  stateGlyphMark,
  statePaint,
  stateWordTone,
} from '../state-tokens';
import { toneColour } from '../tone-colour';
import { TEXT_TONES } from '../variants';

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
    expect(statePaint('needs_you', 'dark')).toEqual({ glyph: 'warning', word: 'warning' });
    expect(statePaint('needs_you', 'light')).toEqual({ glyph: 'warnInk', word: 'warning' });
    expect(statePaint('working', 'dark').glyph).toBe('running');
    expect(statePaint('working', 'light').glyph).toBe('mutedForeground');
    for (const state of STATUS_STATES) {
      const role = STATE_TOKENS[state];
      expect(statePaint(state, 'light').glyph, state).toBe(LIGHT_STAND_INS[role] ?? role);
    }
  });

  it('say every word in the muted tone but Needs you’s, in warning (warn-ink)', () => {
    expect(STATE_WORD_TONE).toBe('muted');
    for (const state of STATUS_STATES) {
      const word = statePaint(state, 'light').word;
      expect(word, state).toBe(state === 'needs_you' ? 'warning' : STATE_WORD_TONE);
      expect(TEXT_TONES[word], state).toBe(state === 'needs_you' ? 'warnInk' : 'mutedForeground');
    }
  });

  it('never paint a state in olive, navy or the accent', () => {
    for (const state of STATUS_STATES) {
      for (const scheme of ['light', 'dark'] as const) {
        const { glyph, word } = statePaint(state, scheme);
        for (const token of [glyph, TEXT_TONES[word]]) {
          expect(['olive', 'navy', 'accent'], `${state} ${scheme}`).not.toContain(token);
        }
      }
    }
  });
});

describe('the mark StateGlyph draws (stateGlyphMark), from these tables only', () => {
  const studio = (scheme: 'light' | 'dark') =>
    ({ glyphs: false, glyphPaint: 'state-role', scheme }) as const;

  it("outside glyphs: the state's colour role for the ground, the vocabulary's glyph", () => {
    for (const state of STATUS_STATES) {
      for (const scheme of ['light', 'dark'] as const) {
        expect(stateGlyphMark(state, studio(scheme)), `${state} ${scheme}`).toEqual({
          glyph: statusGlyph(state).glyph,
          token: statePaint(state, scheme).glyph,
        });
      }
    }
  });

  it("under glyphs: glyphToken's, by the dress's paint", () => {
    for (const state of STATUS_STATES) {
      for (const glyphPaint of ['glyph-role', 'state-role'] as const) {
        const look = { glyphs: true, glyphPaint, scheme: 'dark' } as const;
        expect(stateGlyphMark(state, look).token).toBe(glyphToken(state, glyphPaint));
      }
    }
  });

  it("says a state's word in the tone statePaint gives it", () => {
    for (const state of STATUS_STATES) {
      expect(stateWordTone(state), state).toBe(statePaint(state, 'dark').word);
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
          const ink = colours[toneColour(colours, word)];
          expect(contrastRatio(ink, ground), `${state} word`).toBeGreaterThanOrEqual(AA_TEXT);
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
