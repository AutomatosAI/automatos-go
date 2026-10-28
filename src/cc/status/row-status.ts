// A row's status, pure (PRD-268 §6.11.1, §6.12.3 'Status row', US-G05): the server's display_state
// as a glyph and a word, its next_step as a '▸' line, and Try again when it offers a retry this
// version can send. Board cards, the ticket sheet and Questions draw it (StatusLine.tsx). The state
// is the server's alone: a row without one (an older server) or with one this version does not
// know draws nothing new, never a placeholder. Try again goes to the core route its kind names
// (RETRY_ROUTES): run the ticket again, run the failed Mission's failed steps again, or plan them
// anew; a kind with no route, or a row without the id it needs, offers none. VoiceOver reads the
// row as '<word>: <title>. <next step>.'

import type { DisplayState, RetryKind, RowStatusFields } from '../../api/row-status';
import type { Route } from '../../api/routes';
import type { PathParams } from '../../api/url';
import { isTaskId } from '../../navigation/routes';
import {
  GLYPH_ROLE_TOKENS,
  stateGlyph,
  statusGlyph,
  type StatusState,
} from '../../styles/dress/status-glyphs';
import type { ColourName, ColourScheme } from '../../styles/tokens/types';
import { STATE_WORD_TOKEN, statePaint } from '../../ui/state-tokens';
import { CC_ROUTES } from '../routes';

type RetryParam = 'task_id' | 'mission_id';
type RetryRoute = { readonly route: Route; readonly param: RetryParam };

/**
 * Each retry kind's core route at the pin (null: none, so no Try again). Resume first makes a
 * failed Mission's failed steps wait to run again (F247); Replan plans them anew; Run Now runs a
 * failed ticket again.
 */
export const RETRY_ROUTES: Readonly<Record<RetryKind, RetryRoute | null>> = Object.freeze({
  rerun_mission: { route: CC_ROUTES.missions.resume, param: 'mission_id' },
  replan_mission: { route: CC_ROUTES.missions.replan, param: 'mission_id' },
  retry_ticket: { route: CC_ROUTES.board.runNow, param: 'task_id' },
});

/** The ids a row's Try again may name: its ticket's row id and its Mission's id. */
export type RetryTargets = {
  readonly ticketId: number | null | undefined;
  readonly missionId: string | null | undefined;
};

/** Try again, ready to send: the kind, its route and the id it names. */
export type RetryAction = {
  readonly kind: RetryKind;
  readonly route: Route;
  readonly params: PathParams;
};

export type RowStatusView = {
  readonly state: DisplayState;
  /** The server's next step, as it wrote it; null when it sent none. */
  readonly next: string | null;
  /** Try again (whether the role may is the caller's to ask); null when not offered. */
  readonly retry: RetryAction | null;
  /** '<word>: <title>. <next step>.' */
  readonly accessibilityLabel: string;
};

function targetOf(param: RetryParam, targets: RetryTargets): string | null {
  if (param === 'task_id') {
    const id = targets.ticketId;
    return id !== null && id !== undefined && isTaskId(String(id)) ? String(id) : null;
  }
  return targets.missionId?.trim() || null;
}

/** The retry the row offers, when its kind has a route and the row has the id it needs. */
export function retryAction(
  retry: RowStatusFields['retry'],
  targets: RetryTargets,
): RetryAction | null {
  const known = retry ? RETRY_ROUTES[retry.kind] : null;
  if (!retry || !known) return null;
  const id = targetOf(known.param, targets);
  return id === null
    ? null
    : { kind: retry.kind, route: known.route, params: { [known.param]: id } };
}

const ENDED = /[.!?…]$/;

/** The text as a sentence: a full stop unless it already ends one. */
function sentence(text: string): string {
  return ENDED.test(text) ? text : `${text}.`;
}

/** 'Needs you: Draft the launch post. Allow me to send it, or refuse.' */
export function statusLabel(word: string, title: string, next: string | null): string {
  const named = title.trim();
  const head = sentence(named ? `${word}: ${named}` : word);
  return next ? `${head} ${sentence(next)}` : head;
}

/** The row's status, or null when the server sent no state this version knows. */
export function rowStatusView(
  fields: RowStatusFields,
  title: string,
  targets: RetryTargets,
): RowStatusView | null {
  const state = fields.display_state;
  if (!state) return null;
  const next = fields.next_step ?? null;
  return {
    state,
    next,
    retry: retryAction(fields.retry, targets),
    accessibilityLabel: statusLabel(stateGlyph(state).word, title, next),
  };
}

export type StateMarkSpec = {
  readonly glyph: string;
  readonly word: string;
  readonly glyphToken: ColourName;
  readonly wordToken: ColourName;
};

/**
 * What a state's mark draws: HUD's glyph in its role and its own word (capitals come from its
 * label face), else the vocabulary's word and the state's colour role for the ground's scheme.
 */
export function stateMark(
  state: StatusState,
  glyphs: boolean,
  scheme: ColourScheme,
): StateMarkSpec {
  if (glyphs) {
    const hud = statusGlyph(state);
    return {
      glyph: hud.glyph,
      word: hud.word,
      glyphToken: GLYPH_ROLE_TOKENS[hud.role],
      wordToken: STATE_WORD_TOKEN,
    };
  }
  const vocabulary = stateGlyph(state);
  const paint = statePaint(state, scheme);
  return {
    glyph: vocabulary.glyph,
    word: vocabulary.word,
    glyphToken: paint.glyph,
    wordToken: paint.word,
  };
}
