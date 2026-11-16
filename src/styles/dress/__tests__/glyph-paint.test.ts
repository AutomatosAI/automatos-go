// Status colour on Arcade (PRD-268 §6.12.2, D-ARC-7): Arcade draws HUD's glyph + WORD but paints
// each glyph by its state's role token (the dress's glyphPaint 'state-role', state-tokens.ts
// glyphToken), never the accent; HUD keeps its glyph roles exactly; Studio and Play keep their dots.
// Covers every place a glyph status is painted: StatusPip (the Command Centre's board and LIVE),
// StateGlyph (state-tokens.ts stateGlyphMark: in StateMark on the board, the ticket sheet,
// Questions and the brief's rows, and in the readiness list), and Arcade's own party strip and
// quest map.

import { describe, expect, it } from 'vitest';

import { stateMark } from '../../../cc/status/row-status';
import { readinessMark } from '../../../readiness/view-model';
import { STATE_TOKENS, glyphToken, stateGlyphMark } from '../../../ui/state-tokens';
import { PARTY_TONES } from '../../arcade/home/party';
import { QUEST_TONES } from '../../arcade/home/quests';
import { STATUS_WORDS } from '../../strings';
import { ARCADE_ROLES } from '../../tokens/arcade';
import { dressOf } from '../dress';
import {
  GLYPH_ROLE_TOKENS,
  PIP_STATUSES,
  STATUS_STATES,
  glyphState,
  statusGlyph,
  type GlyphStatus,
} from '../status-glyphs';
import { ARCADE_STYLES, HUD_STYLES, PLAY_STYLES, STUDIO_STYLES } from './fixtures';

/** Every status a glyph is drawn for: the board's, the vocabulary's and HUD's panels' own. */
const EVERY_STATUS: readonly string[] = [
  ...new Set<string>([...PIP_STATUSES, ...STATUS_STATES, ...Object.keys(STATUS_WORDS)]),
];
/** The accent and the highlight, as Arcade's Studio-keyed set names them. */
const ACCENTS = ['primary', 'accent', 'ring'];

describe('the dress says how a glyph status is painted', () => {
  it('HUD by its glyph role; Arcade by its state’s role; Studio and Play draw dots', () => {
    HUD_STYLES.forEach((style) => expect(dressOf(style).glyphPaint).toBe('glyph-role'));
    ARCADE_STYLES.forEach((style) => {
      expect(dressOf(style)).toMatchObject({ status: 'glyph', glyphPaint: 'state-role' });
    });
    [...STUDIO_STYLES, ...PLAY_STYLES].forEach((style) =>
      expect(dressOf(style)).toMatchObject({ status: 'pip', glyphPaint: 'state-role' }),
    );
  });
});

describe('glyphToken', () => {
  it('is exactly HUD’s glyph role under glyph-role, for every status', () => {
    for (const status of [...EVERY_STATUS, 'something_new']) {
      expect(glyphToken(status, 'glyph-role'), status).toBe(
        GLYPH_ROLE_TOKENS[statusGlyph(status).role],
      );
    }
  });

  it('is the state’s role under state-role, and never the accent', () => {
    for (const status of [...EVERY_STATUS, 'something_new']) {
      const token = glyphToken(status, 'state-role');
      expect(token, status).toBe(STATE_TOKENS[glyphState(status)]);
      expect(ACCENTS, status).not.toContain(token);
      expect(['ac', 'hl'], status).not.toContain(ARCADE_ROLES[token]);
    }
  });

  it('reads a status outside the vocabulary as its glyph’s state', () => {
    const read = (statuses: readonly GlyphStatus[]) => statuses.map(glyphState);
    expect(read(['in_progress', 'live', 'running'])).toEqual(['working', 'working', 'working']);
    expect(read(['review', 'blocked'])).toEqual(['needs_you', 'needs_you']);
    expect(read(['approved', 'done', 'ready'])).toEqual(['done', 'done', 'ready']);
    expect(read(['error', 'failed'])).toEqual(['failed', 'failed']);
    expect(read(['inbox', 'cancelled', 'offline'])).toEqual([
      'not_checked',
      'not_checked',
      'not_checked',
    ]);
    expect(glyphState('needs_setup')).toBe('needs_setup');
    expect(glyphState('something_new')).toBe('not_checked');
  });
});

describe('the marks that draw a state', () => {
  const HUD = { glyphs: true, glyphPaint: 'glyph-role', scheme: 'dark' } as const;
  const ARCADE = { glyphs: true, glyphPaint: 'state-role', scheme: 'dark' } as const;

  it('StateGlyph: HUD’s exactly as before; Arcade’s glyph HUD’s, painted in the state’s role', () => {
    for (const state of STATUS_STATES) {
      const hud = stateGlyphMark(state, HUD);
      expect(hud).toEqual({
        glyph: statusGlyph(state).glyph,
        token: GLYPH_ROLE_TOKENS[statusGlyph(state).role],
      });
      expect(stateGlyphMark(state, ARCADE)).toEqual({ ...hud, token: STATE_TOKENS[state] });
      // the light ground's stand-ins are Studio's; Arcade's roles hold on Handheld as they are
      expect(stateGlyphMark(state, { ...ARCADE, scheme: 'light' }).token).toBe(STATE_TOKENS[state]);
    }
  });

  it('StateMark and the readiness list say HUD’s and Arcade’s words the same, muted', () => {
    for (const state of STATUS_STATES) {
      expect(stateMark(state, true)).toEqual({ word: statusGlyph(state).word, wordTone: 'muted' });
    }
    for (const state of ['ready', 'needs_setup', 'not_checked'] as const) {
      expect(readinessMark(state, true).wordTone).toBe('muted');
    }
  });
});

describe('Arcade’s own status marks', () => {
  it('paint the party and the quests in their states’ roles, never the accent', () => {
    expect(PARTY_TONES).toEqual({
      needs: ARCADE_ROLES[STATE_TOKENS.needs_you],
      working: ARCADE_ROLES[STATE_TOKENS.working],
      ready: ARCADE_ROLES[STATE_TOKENS.not_checked],
    });
    expect(QUEST_TONES).toMatchObject({
      active: ARCADE_ROLES[STATE_TOKENS.working],
      needs: ARCADE_ROLES[STATE_TOKENS.needs_you],
      failed: ARCADE_ROLES[STATE_TOKENS.failed],
    });
    [...Object.values(PARTY_TONES), ...Object.values(QUEST_TONES)].forEach((tone) =>
      expect(['ac', 'hl']).not.toContain(tone),
    );
  });
});
