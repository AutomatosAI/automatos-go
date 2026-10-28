// Every status as a glyph plus a WORD (HUD's README 'Status': ● ROUTING, ○ QUEUED, — IDLE,
// ◆ WATCHING, ✓, ▸, ✕; never colour alone, D-A11Y), pure. Each status the foundation's StatusPip
// knows (src/ui/variants.ts PIP_TOKENS, the board's columns and 'live') and the ones HUD's panels
// say beyond them has a glyph, a word and the role its glyph is painted in:
//
//   ●  accent  working, in progress, live         ◆  accent  review, blocked, needs you, needs setup
//   ○  text2   inbox, assigned, queued, not checked  ✓  text2  done, approved (ready: accent)
//   ✕  error   failed, error                         ▸  accent  a running step
//   —  text2   cancelled, closed, paused, idle, offline, and a status this version doesn't know
//
// The board's words are its own (statusPip: the web's STATUS_CONFIG labels); HUD shows them in
// capitals (its label style; glyphLine for a line written out). PRD-268 §6.11.1 adds its states
// (StatusState: a row's display_state, a readiness item's needs_setup and not_checked) with the
// glyphs above: ready is ✓ in the accent on HUD, because it asks to be looked at and done does
// not (§6.12.2). Studio, an installed theme and Play say STATE_WORDS' words (stateGlyph) and paint
// by the state's colour role (src/ui/state-tokens.ts); HUD says its own and paints by the role here.

import { PIP_TOKENS, isPipStatus, statusPip, type PipStatus } from '../../ui/variants';
import { STATE_WORDS, STATUS_WORDS } from '../strings';
import type { ColourName } from '../tokens/types';

export type GlyphRole = 'accent' | 'text2' | 'error';

export type StatusGlyph = {
  readonly glyph: string;
  readonly word: string;
  readonly role: GlyphRole;
};

export const GLYPHS = Object.freeze({
  working: '●',
  waiting: '○',
  attention: '◆',
  done: '✓',
  failed: '✕',
  stopped: '—',
  running: '▸',
});

type GlyphKind = keyof typeof GLYPHS;

const KIND_ROLES: Readonly<Record<GlyphKind, GlyphRole>> = Object.freeze({
  working: 'accent',
  waiting: 'text2',
  attention: 'accent',
  done: 'text2',
  failed: 'error',
  stopped: 'text2',
  running: 'accent',
});

/** The statuses HUD's panels say beyond the board's (strings.ts STATUS_WORDS). */
export type ExtraStatus = keyof typeof STATUS_WORDS;

export type GlyphStatus = PipStatus | ExtraStatus;

/** Every known status's glyph; a PipStatus the foundation adds fails the typecheck here. */
const STATUS_KINDS: Readonly<Record<GlyphStatus, GlyphKind>> = Object.freeze({
  working: 'working',
  in_progress: 'working',
  live: 'working',
  inbox: 'waiting',
  assigned: 'waiting',
  queued: 'waiting',
  not_checked: 'waiting',
  review: 'attention',
  blocked: 'attention',
  needs_you: 'attention',
  needs_setup: 'attention',
  done: 'done',
  ready: 'done',
  approved: 'done',
  failed: 'failed',
  error: 'failed',
  cancelled: 'stopped',
  closed: 'stopped',
  paused: 'stopped',
  idle: 'stopped',
  offline: 'stopped',
  running: 'running',
});

/** A status whose role is not its glyph's: ready is ✓ in the accent (§6.12.2). */
const STATUS_ROLES: Readonly<Partial<Record<GlyphStatus, GlyphRole>>> = Object.freeze({
  ready: 'accent',
});

/** PRD-268 §6.11.1's states: a row's display_state, and a readiness item's (§6.11.3). */
export type StatusState = keyof typeof STATE_WORDS;

/** Every state, as STATE_WORDS lists them (the tests read them from there). */
export const STATUS_STATES = Object.freeze(Object.keys(STATE_WORDS) as StatusState[]);

/** The token each glyph role paints in, on every style's Studio-keyed set (HUD: the accent, text2, the error). */
export const GLYPH_ROLE_TOKENS: Readonly<Record<GlyphRole, ColourName>> = Object.freeze({
  accent: 'primary',
  text2: 'mutedForeground',
  error: 'destructive',
});

const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

export function isGlyphStatus(status: string): status is GlyphStatus {
  return has(STATUS_KINDS, status);
}

function isExtraStatus(status: string): status is ExtraStatus {
  return has(STATUS_WORDS, status) && !isPipStatus(status);
}

/** The board's word for its own statuses, HUD's for the rest, else the status itself. */
function glyphWord(status: string): string {
  return isExtraStatus(status) ? STATUS_WORDS[status] : statusPip(status).word;
}

/** A status's glyph, word and role; one this version doesn't know is '—' in text2 and says itself. */
export function statusGlyph(status: string): StatusGlyph {
  if (!isGlyphStatus(status)) {
    return Object.freeze({
      glyph: GLYPHS.stopped,
      word: glyphWord(status),
      role: KIND_ROLES.stopped,
    });
  }
  const kind = STATUS_KINDS[status];
  const role = STATUS_ROLES[status] ?? KIND_ROLES[kind];
  return Object.freeze({ glyph: GLYPHS[kind], word: glyphWord(status), role });
}

export function isStatusState(status: string): status is StatusState {
  return has(STATE_WORDS, status);
}

/** A state's glyph and role with STATE_WORDS' word ('Ready to look at'); HUD says statusGlyph's. */
export function stateGlyph(state: StatusState): StatusGlyph {
  return Object.freeze({ ...statusGlyph(state), word: STATE_WORDS[state] });
}

/** The statuses StatusPip knows, as variants.ts lists them (the tests read them from there). */
export const PIP_STATUSES = Object.freeze(Object.keys(PIP_TOKENS) as PipStatus[]);

/** HUD's line written out: '◆ BLOCKED', or the glyph with a wider phrase given ('● STREAMING'). */
export function glyphLine(status: string, word?: string): string {
  return `${statusGlyph(status).glyph} ${(word ?? statusGlyph(status).word).toUpperCase()}`;
}
