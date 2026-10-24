// HUD's statuses as a glyph plus a WORD (US-016f, D-A11Y: never colour alone): every status the
// foundation's StatusPip knows (read from src/ui/variants.ts, not copied) has a glyph and a word;
// each glyph and role is the README's table; an unknown status is '—' in text2 and says itself;
// the board's words are its own; HUD writes the word in capitals; each role paints in a token
// every style has (HUD: its accent, text2 and the error).

import { describe, expect, it } from 'vitest';

import { PIP_TOKENS, statusPip } from '../../../ui/variants';
import { STATUS_WORDS } from '../../strings';
import {
  GLYPHS,
  GLYPH_ROLE_TOKENS,
  PIP_STATUSES,
  glyphLine,
  isGlyphStatus,
  statusGlyph,
  type GlyphRole,
} from '../status-glyphs';
import { ALL_STYLES, HUD_STYLES } from './fixtures';

const TABLE: readonly (readonly [string, string, GlyphRole])[] = [
  ['working', '●', 'accent'],
  ['in_progress', '●', 'accent'],
  ['live', '●', 'accent'],
  ['inbox', '○', 'text2'],
  ['assigned', '○', 'text2'],
  ['queued', '○', 'text2'],
  ['review', '◆', 'accent'],
  ['blocked', '◆', 'accent'],
  ['needs_you', '◆', 'accent'],
  ['done', '✓', 'text2'],
  ['approved', '✓', 'text2'],
  ['failed', '✕', 'error'],
  ['error', '✕', 'error'],
  ['cancelled', '—', 'text2'],
  ['closed', '—', 'text2'],
  ['paused', '—', 'text2'],
  ['idle', '—', 'text2'],
  ['offline', '—', 'text2'],
  ['running', '▸', 'accent'],
];

describe('statusGlyph', () => {
  it("covers every status variants.ts's PIP_TOKENS knows, with a glyph and a word", () => {
    const keys = Object.keys(PIP_TOKENS);
    expect(keys.length).toBeGreaterThan(0);
    expect([...PIP_STATUSES]).toEqual(keys);
    for (const status of keys) {
      expect(isGlyphStatus(status), status).toBe(true);
      const { glyph, word } = statusGlyph(status);
      expect(Object.values(GLYPHS), status).toContain(glyph);
      expect(word.trim(), status).not.toBe('');
    }
  });

  it("draws the README's glyph in its role for each status", () => {
    for (const [status, glyph, role] of TABLE) {
      expect(statusGlyph(status), status).toMatchObject({ glyph, role });
    }
  });

  it("says the board's own words for the board's statuses", () => {
    for (const status of Object.keys(PIP_TOKENS)) {
      expect(statusGlyph(status).word).toBe(statusPip(status).word);
    }
  });

  it("says HUD's words for the statuses beyond the board", () => {
    for (const [status, word] of Object.entries(STATUS_WORDS)) {
      expect(statusGlyph(status).word).toBe(word);
    }
  });

  it("draws an unknown status as '—' in text2, saying itself", () => {
    expect(isGlyphStatus('waiting_on_vendor')).toBe(false);
    expect(statusGlyph('waiting_on_vendor')).toEqual({
      glyph: '—',
      word: 'waiting on vendor',
      role: 'text2',
    });
  });

  it('never reads a prototype key as a status', () => {
    expect(isGlyphStatus('toString')).toBe(false);
    expect(statusGlyph('toString').glyph).toBe('—');
  });
});

describe('glyphLine', () => {
  it('writes the glyph and the word in capitals', () => {
    expect(glyphLine('blocked')).toBe('◆ BLOCKED');
    expect(glyphLine('in_progress')).toBe('● IN PROGRESS');
    expect(glyphLine('live', 'Streaming')).toBe('● STREAMING');
    expect(glyphLine('mystery_state')).toBe('— MYSTERY STATE');
  });
});

describe('the roles’ colours', () => {
  it('names a token every style has', () => {
    for (const style of ALL_STYLES) {
      for (const token of Object.values(GLYPH_ROLE_TOKENS)) {
        expect(style.tokens.colours[token], token).toMatch(/^#[0-9A-F]{6}([0-9A-F]{2})?$/);
      }
    }
  });

  it("paints HUD's accent and text2 roles in its README's accent and text2", () => {
    for (const style of HUD_STYLES) {
      const { colours } = style.tokens;
      expect(colours[GLYPH_ROLE_TOKENS.accent]).toBe(style.hud?.accent);
      expect(colours[GLYPH_ROLE_TOKENS.text2]).toBe(style.hud?.text2);
    }
  });
});
