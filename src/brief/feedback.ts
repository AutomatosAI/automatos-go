// The thumbs on the brief (PRD-268 §6.4 'Feedback', §6.12.3 'Brief card'), pure: the thumbs up or
// down Auto's Read has on the web (PRD-221 S10), posted to core's existing POST
// /api/activity/digest/feedback {state_hash, rating: 1 | -1} through the one client, keyed by the
// state the brief described. Offered only where the brief names that state and the role may use
// Auto (the route is gated agents:execute, chat's own scope). A press shows as chosen at once, one
// send at a time; pressing the chosen one again sends nothing; a refusal puts the last choice back
// and says one line, never a crash. The choice is kept per state for the launch (memory only), so
// the thread's card and a layout's sheet of the same brief agree. Nothing here speaks of cost (D8).

import type { ApiClient } from '../api/client';
import type { WorkspaceRole } from '../api/workspace';
import { roleCan } from '../auth/role';
import { BRIEF_ROUTES } from './routes';
import type { Brief } from './schema';

export const BRIEF_RATINGS = Object.freeze({ up: 1, down: -1 } as const);
export type BriefRating = keyof typeof BRIEF_RATINGS;

export type FeedbackBody = { readonly state_hash: string; readonly rating: 1 | -1 };

export function feedbackBody(stateHash: string, rating: BriefRating): FeedbackBody {
  return Object.freeze({ state_hash: stateHash, rating: BRIEF_RATINGS[rating] });
}

/** POST /api/activity/digest/feedback; {ok: true} is not read. A refusal is the client's ApiError. */
export async function sendBriefFeedback(
  client: Pick<ApiClient, 'request'>,
  stateHash: string,
  rating: BriefRating,
): Promise<void> {
  await client.request(BRIEF_ROUTES.feedback, { body: feedbackBody(stateHash, rating) });
}

/** The thumbs are drawn: the brief names its state, and the role may use Auto. */
export function feedbackOffered(
  brief: Pick<Brief, 'state_hash'>,
  role: WorkspaceRole | null,
): boolean {
  return brief.state_hash.trim() !== '' && roleCan(role, 'chat');
}

export type FeedbackState = {
  /** What the server has: the person's last choice it agreed to. */
  readonly chosen: BriefRating | null;
  /** The choice on its way; shown as chosen until the server answers. */
  readonly sending: BriefRating | null;
  /** The last send was refused: one line under the thumbs. */
  readonly failed: boolean;
};

export function feedbackStart(chosen: BriefRating | null): FeedbackState {
  return Object.freeze({ chosen, sending: null, failed: false });
}

export type FeedbackPress = { readonly state: FeedbackState; readonly send: boolean };

/** A thumb pressed: sent unless one is on its way or it is already the choice. */
export function pressFeedback(state: FeedbackState, rating: BriefRating): FeedbackPress {
  if (state.sending !== null || state.chosen === rating) return { state, send: false };
  return { state: Object.freeze({ ...state, sending: rating, failed: false }), send: true };
}

export function feedbackSent(state: FeedbackState, rating: BriefRating): FeedbackState {
  return Object.freeze({ ...state, chosen: rating, sending: null, failed: false });
}

/** The server said no: the last choice it agreed to shows again, with the line. */
export function feedbackRefused(state: FeedbackState): FeedbackState {
  return Object.freeze({ ...state, sending: null, failed: true });
}

/** The thumb drawn as chosen: the one on its way, else the last agreed. */
export function shownRating(state: FeedbackState): BriefRating | null {
  return state.sending ?? state.chosen;
}

export type FeedbackMemory = {
  readonly get: (stateHash: string) => BriefRating | null;
  readonly set: (stateHash: string, rating: BriefRating) => void;
};

/** The choices the server agreed to, per brief state, for the launch. */
export function createFeedbackMemory(): FeedbackMemory {
  let chosen: ReadonlyMap<string, BriefRating> = new Map();
  return Object.freeze({
    get: (stateHash: string) => chosen.get(stateHash) ?? null,
    set: (stateHash: string, rating: BriefRating) => {
      chosen = new Map([...chosen, [stateHash, rating]]);
    },
  });
}
