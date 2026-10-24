// Play's and HUD's looks in step with the web (D55, D59, D-PHONE-CHOICE), pure: a look changed on
// the phone repaints the browser, and the other way round. Behaviour references, not vendored:
// the web's lib/theme-host/builtin/play-look-state.ts (lookReducer's 'served', mergeLooks) and
// play-look-store.ts (the pending and synced marks, the refused statuses) at the pin 630fc1c85.
//
// The state is the phone's copy {saved, active} and its marks: lookChanged / savedChanged (that
// part was changed on the phone since the last read and the server has not kept it yet) and
// serverSeen (the phone has met the server's copy once). The first meeting merges: the server's
// saved looks first, then each phone-only one the server lacks (a clashing id renamed by the
// editor's fresh-id rule); the active look is the server's, else the phone's. Afterwards the server
// is the truth, except for a part changed on the phone since the last read, which is sent next. One
// rule set per theme (LookRules): Play's over the vendored looks engine, HUD's over HUD_LOOK_SPEC.

import { isApiError, type ApiErrorKind } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import { MAX_SAVED_LOOKS } from './looks-schemas';

/** What every look document has; the rest are its knobs. */
export type LookDoc = { readonly id: string; readonly name: string };

/** The phone's copy of one theme's looks: the saved ones and the one painted. */
export type LookSet<L extends LookDoc> = {
  readonly saved: readonly L[];
  readonly active: L;
};

/** The server's copy: no active look until the member saves one. */
export type ServedSet<L extends LookDoc> = {
  readonly saved: readonly L[];
  readonly active: L | null;
};

/** One theme's look rules: its server id, the vendored check and the editor's fresh-id rule. */
export type LookRules<L extends LookDoc> = {
  /** The id the server keeps the looks under ('automatos/play'). */
  readonly themeId: string;
  /** The look as the theme's schema takes it (the vendored validateLook), or null. */
  readonly check: (value: unknown) => L | null;
  readonly isPreset: (id: string) => boolean;
  /** An id no preset and no look in `taken` uses. */
  readonly freshId: (taken: readonly L[]) => string;
  /** What the theme paints when nothing is chosen (Ember, ARC). */
  readonly defaultLook: L;
};

/** In step with the server, kept on the phone only (not installed), or waiting to be sent. */
export type LookSynced = 'server' | 'local-only' | 'pending';

/** What the phone keeps between launches beside its copy. */
export type LookMarks = {
  readonly serverSeen: boolean;
  readonly lookChanged: boolean;
  readonly savedChanged: boolean;
};

/** The marks and this launch's standing with the server, for the look pages. */
export type LookSyncStatus = LookMarks & {
  readonly synced: LookSynced;
  /** Why the last read or save failed (the taxonomy's kind), or null. */
  readonly failure: ApiErrorKind | null;
};

export type LookSyncState<L extends LookDoc> = LookSet<L> &
  LookSyncStatus & {
    /** The phone's changes so far: a save clears the marks only when none came after it. */
    readonly edits: number;
  };

export type LookSyncAction<L extends LookDoc> =
  /** The phone's copy and marks, as read from the phone. */
  | { readonly type: 'loaded'; readonly local: LookSet<L>; readonly marks: LookMarks }
  /** GET /api/themes/looks/{themeId}, every look checked. */
  | { readonly type: 'served'; readonly server: ServedSet<L> }
  /** The active look changed on the phone. */
  | { readonly type: 'edited'; readonly look: L }
  /** The saved looks changed on the phone (saved, renamed, deleted). */
  | { readonly type: 'savedChanged'; readonly saved: readonly L[] }
  /** The server kept the save sent after `edits` changes. */
  | { readonly type: 'kept'; readonly edits: number }
  | { readonly type: 'failed'; readonly error: unknown };

const NOT_FOUND = 404;

/**
 * Answers that mean the server will never keep this save as sent (play-look-store.ts
 * REFUSED_STATUSES, less 403 and 404): the marks go, so the next read takes the server's copy.
 * 401, 403, 5xx and no answer at all keep the change on the phone for the next foreground.
 */
const REFUSED_STATUSES: readonly number[] = Object.freeze([400, 409, 413, 422]);

export const NO_MARKS: LookMarks = Object.freeze({
  serverSeen: false,
  lookChanged: false,
  savedChanged: false,
});

function changed(marks: LookMarks): boolean {
  return marks.lookChanged || marks.savedChanged;
}

/** The standing a phone starts a launch with: pending while a change waits, else in step. */
export function statusFromMarks(marks: LookMarks): LookSyncStatus {
  const { serverSeen, lookChanged, savedChanged } = marks;
  const synced: LookSynced = changed(marks) ? 'pending' : 'server';
  return Object.freeze({ serverSeen, lookChanged, savedChanged, synced, failure: null });
}

/** A look's fields in a fixed order: the server and the vendored check order keys differently. */
function canonical(look: LookDoc): string {
  const entries = Object.entries(look).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(entries);
}

export function sameLook(a: LookDoc | null, b: LookDoc | null): boolean {
  if (a === b) return true;
  return a !== null && b !== null && canonical(a) === canonical(b);
}

export function sameLooks(a: readonly LookDoc[], b: readonly LookDoc[]): boolean {
  return a.length === b.length && a.every((look, index) => sameLook(look, b[index] ?? null));
}

/** A phone-only look joins the list; the same id for another look takes a fresh id. */
function addPhoneLook<L extends LookDoc>(rules: LookRules<L>) {
  return (merged: readonly L[], look: L): readonly L[] => {
    if (merged.some((entry) => sameLook(entry, look))) return merged;
    const taken = merged.some((entry) => entry.id === look.id);
    return [...merged, taken ? Object.freeze({ ...look, id: rules.freshId(merged) }) : look];
  };
}

/**
 * The first meeting: the server's saved looks first, then each phone-only one it lacks (at most
 * MAX_SAVED_LOOKS); the server's active look, else the phone's — the phone's when it was changed
 * on the phone before the meeting, which wins until it is sent.
 */
export function mergeLooks<L extends LookDoc>(
  rules: LookRules<L>,
  server: ServedSet<L>,
  phone: LookSet<L>,
  lookChanged = false,
): LookSet<L> {
  const saved = phone.saved.reduce(addPhoneLook(rules), server.saved).slice(0, MAX_SAVED_LOOKS);
  const active = lookChanged ? phone.active : (server.active ?? phone.active);
  return { saved, active };
}

/** Afterwards the server is the truth, except for a part changed on the phone since the read. */
function serverTruth<L extends LookDoc>(state: LookSyncState<L>, server: ServedSet<L>) {
  return {
    saved: state.savedChanged ? state.saved : server.saved,
    active: state.lookChanged ? state.active : (server.active ?? state.active),
  };
}

/** The copy taken, keeping each unchanged part's object; marked where the server lacks it. */
function settle<L extends LookDoc>(
  rules: LookRules<L>,
  state: LookSyncState<L>,
  server: ServedSet<L>,
  next: LookSet<L>,
): LookSyncState<L> {
  const active = sameLook(next.active, state.active) ? state.active : next.active;
  const saved = sameLooks(next.saved, state.saved) ? state.saved : Object.freeze([...next.saved]);
  // a server with no active look lacks only a look that is not the theme's default
  const lookChanged = !sameLook(active, server.active ?? rules.defaultLook);
  const savedChanged = !sameLooks(saved, server.saved);
  const synced: LookSynced = lookChanged || savedChanged ? 'pending' : 'server';
  return { ...state, saved, active, lookChanged, savedChanged, serverSeen: true, synced, failure: null };
}

function served<L extends LookDoc>(
  rules: LookRules<L>,
  state: LookSyncState<L>,
  server: ServedSet<L>,
): LookSyncState<L> {
  const next = state.serverSeen
    ? serverTruth(state, server)
    : mergeLooks(rules, server, state, state.lookChanged);
  return settle(rules, state, server, next);
}

/** A change made on the phone: marked, and waiting unless the theme is not installed. */
function phoneChange<L extends LookDoc>(
  state: LookSyncState<L>,
  change: Partial<LookSyncState<L>>,
): LookSyncState<L> {
  const synced: LookSynced = state.synced === 'local-only' ? 'local-only' : 'pending';
  return { ...state, ...change, edits: state.edits + 1, synced };
}

function kept<L extends LookDoc>(state: LookSyncState<L>, edits: number): LookSyncState<L> {
  if (edits !== state.edits) return state; // a newer change is waiting to be sent
  return { ...state, lookChanged: false, savedChanged: false, synced: 'server', failure: null };
}

/** 404: not installed here, kept on the phone; a refusal: the marks go; else kept and retried. */
function failed<L extends LookDoc>(state: LookSyncState<L>, error: unknown): LookSyncState<L> {
  const status = isApiError(error) ? error.status : undefined;
  if (status === NOT_FOUND) return { ...state, synced: 'local-only', failure: null };
  const failure: ApiErrorKind = isApiError(error) ? error.kind : 'network';
  const refused = status !== undefined && REFUSED_STATUSES.includes(status);
  const marks = refused ? { lookChanged: false, savedChanged: false } : {};
  return { ...state, ...marks, synced: 'pending', failure };
}

function loaded<L extends LookDoc>(
  state: LookSyncState<L>,
  local: LookSet<L>,
  marks: LookMarks,
): LookSyncState<L> {
  return { ...state, ...statusFromMarks(marks), saved: local.saved, active: local.active };
}

export function reduceLookSync<L extends LookDoc>(
  rules: LookRules<L>,
  state: LookSyncState<L>,
  action: LookSyncAction<L>,
): LookSyncState<L> {
  switch (action.type) {
    case 'loaded':
      return loaded(state, action.local, action.marks);
    case 'served':
      return served(rules, state, action.server);
    case 'edited':
      return phoneChange(state, { active: action.look, lookChanged: true });
    case 'savedChanged':
      return phoneChange(state, { saved: action.saved, savedChanged: true });
    case 'kept':
      return kept(state, action.edits);
    case 'failed':
      return failed(state, action.error);
  }
}

/** A theme's state before anything is read: its default look, nothing saved, no marks. */
export function initialLookSync<L extends LookDoc>(rules: LookRules<L>): LookSyncState<L> {
  return { saved: [], active: rules.defaultLook, ...statusFromMarks(NO_MARKS), edits: 0 };
}

/**
 * What a look page says about the sync, or null: `notInstalled` while the theme is not installed
 * in the workspace (HUD passes null: its looks simply stay on the phone), else the taxonomy's
 * words for the last failure.
 */
export function lookSyncNotice(status: LookSyncStatus, notInstalled: string | null): string | null {
  if (status.synced === 'local-only') return notInstalled;
  return status.failure === null ? null : API_ERROR_COPY[status.failure];
}
