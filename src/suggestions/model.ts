// Auto's suggestions as the phone draws them (PRD-268 §6.5.2, §6.12.3 'Suggestion', §6.12.5,
// US-G01), pure. The list is the server's (GET …/suggestions?status=open), never thread cards: the
// newest open one is pinned above the composer (Studio, Play) or on HUD's NEXT line, and the header's
// count opens all of them. An open suggestion past its expiry is not shown (the server lapses it on
// its next read). Each view says what Start does from proposed_action.kind, and its actions name the
// suggestion to VoiceOver. With the keyboard up the pinned card is one line. Start refused (offline,
// expired, the day's ceiling) is one line in the app's words, and the suggestion stays put.

import { isApiError } from '../api/errors';
import { HIDE_REASONS, type HideReason, type Suggestion } from './schema';
import { SUGGESTION_COPY } from './strings';

/** §6.12.3: 'Started. Auto is on it.' shows for 4 s. */
export const STARTED_FOR_MS = 4000;

export type SuggestionView = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  /** 'Start does: …'; null when the server named no kind this version knows. */
  readonly does: string | null;
  readonly cardLabel: string;
  readonly startLabel: string;
  readonly hideLabel: string;
};

function timeOf(iso: string | null): number | null {
  const at = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(at) ? at : null;
}

/** Still open: its status says so and its expiry, when it has one, is ahead. */
export function isShowable(suggestion: Suggestion, now: number): boolean {
  if (suggestion.status !== 'open') return false;
  const expires = timeOf(suggestion.expires_at);
  return expires === null || expires > now;
}

/** The open ones, newest first (by created_at; the server's order where a time is missing). */
export function openSuggestions(list: readonly Suggestion[], now: number): readonly Suggestion[] {
  const open = list.filter((each) => isShowable(each, now));
  return open
    .map((each, index) => ({ each, index, at: timeOf(each.created_at) }))
    .sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity) || a.index - b.index)
    .map(({ each }) => each);
}

export function suggestionView(suggestion: Suggestion): SuggestionView {
  const kind = suggestion.proposed_action?.kind ?? null;
  const detail = suggestion.detail.trim();
  return {
    id: suggestion.id,
    title: suggestion.title,
    detail,
    does: kind ? SUGGESTION_COPY.does[kind] : null,
    cardLabel: SUGGESTION_COPY.cardLabel(suggestion.title, detail),
    startLabel: SUGGESTION_COPY.startLabel(suggestion.title),
    hideLabel: SUGGESTION_COPY.hideLabel(suggestion.title),
  };
}

/** The pinned card's form: the whole card, or one line while the keyboard is up. */
export function pinnedForm(keyboardHeight: number): 'card' | 'line' {
  return keyboardHeight > 0 ? 'line' : 'card';
}

/** The header's count ('Ideas · 3'); null hides it. */
export function countText(count: number): string | null {
  return count > 0 ? SUGGESTION_COPY.count(count) : null;
}

const REFUSALS: Readonly<Record<string, string>> = SUGGESTION_COPY.refused;

/** Start refused, in one line of the app's own words (never the server's: D8). */
export function startRefusal(error: unknown): string {
  if (!isApiError(error)) return SUGGESTION_COPY.refused.other;
  if (error.kind === 'network') return SUGGESTION_COPY.refused.offline;
  const code = error.code ?? '';
  return Object.prototype.hasOwnProperty.call(REFUSALS, code) &&
    code !== 'other' &&
    code !== 'offline'
    ? REFUSALS[code]
    : SUGGESTION_COPY.refused.other;
}

/** The list without one suggestion: Hide takes it off at once, before the server answers. */
export function withoutSuggestion(
  list: readonly Suggestion[] | undefined,
  id: string,
): readonly Suggestion[] | undefined {
  return list?.filter((each) => each.id !== id);
}

/** Hide's reason menu, in order: the three reasons, then Cancel. */
export const HIDE_MENU: readonly (HideReason | 'cancel')[] = Object.freeze([
  ...HIDE_REASONS,
  'cancel',
]);

export type HideChoice =
  { readonly hide: false } | { readonly hide: true; readonly reason: HideReason | null };

/** The menu's answer: a reason, or nothing hidden (Cancel, or a dismissed menu). */
export function hideChoiceOf(index: number): HideChoice {
  const picked = HIDE_MENU[index];
  if (picked === undefined || picked === 'cancel') return { hide: false };
  return { hide: true, reason: picked };
}
