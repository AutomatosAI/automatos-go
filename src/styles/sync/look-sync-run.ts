// The look sync running (US-017d, D-PHONE-CHOICE; Arcade's from US-022c, Candy's from US-023c):
// one runner per style store and theme (Play, HUD, Arcade, Candy), over the pure reducer (play/look-sync.ts). It reads the
// member's looks (GET /api/themes/looks/{themeId}) when LookSync asks (mount, every foreground, a
// look page opening) and writes the result to the style store, which repaints the style and keeps
// the copy on the phone; it watches the style store for a change made on the phone (the look page,
// HUD's drawer) and sends the whole set through the outbox (one PUT at a time, a newer waiting save
// replacing an older). A part changed on the phone wins until the server keeps it. Not installed
// (404): the looks stay on the phone. 401, 403, 5xx and no answer: kept, sent after the next read.
// No timers and no polling. The target's session is the copy's owner (server, workspace, user): a
// copy another owner left is put back to the theme's defaults when a new one attaches or reads,
// before anything is read, merged or sent. One read at a time per session: a second call joins it.
// A read's answer (or failure) is dropped, changing nothing on the phone, when it is for an older
// session or when a save of the theme was queued, in flight or answered at any point between the
// read's start and its answer: the server may have served the read before that save landed. The
// next mount, foreground or look page reads again. Pure TypeScript (no React).

import type { ApiClient } from '../../api/client';
import { logger } from '../../lib/logger';
import { fetchLooks, saveLooks } from '../play/looks-api';
import { lookBody } from '../play/looks-schemas';
import {
  reduceLookSync,
  sameLook,
  sameLooks,
  type LookDoc,
  type LookSyncAction,
  type LookSyncState,
  type LookSyncStatus,
} from '../play/look-sync';
import type { StyleState, StyleStoreApi } from '../provider/store';
import { createLookOutbox, type LookOutbox } from './look-outbox';
import {
  ARCADE_LOOK_THEME,
  CANDY_LOOK_THEME,
  HUD_LOOK_THEME,
  PLAY_LOOK_THEME,
  type LookTheme,
} from './look-themes';

/** Where the looks are read from and sent to: the session's client, and whose looks they are. */
export type LookSyncTarget = {
  readonly client: ApiClient;
  /** The copy's owner: the server, workspace and signed-in user (lookOwner). */
  readonly session: string;
};

/** The owner of a copy of looks: '<server>|<workspace>|<user>' (the web keeps one per scope). */
export function lookOwner(apiUrl: string, workspaceId: string, userId: string | null): string {
  return `${apiUrl}|${workspaceId}|${userId ?? ''}`;
}

export type LookSyncRunner = {
  /** Reads the server's looks and sends what the phone changed; joins a read already running. */
  readonly refresh: (target: LookSyncTarget) => Promise<void>;
  /** Changes made on the phone are sent to the latest attached target; returns the detach. */
  readonly attach: (target: LookSyncTarget) => () => void;
};

/** A runner's working state: held for the store's lifetime and changed only by this module. */
type Runtime<L extends LookDoc> = {
  readonly store: StyleStoreApi;
  readonly theme: LookTheme<L>;
  readonly outbox: LookOutbox;
  edits: number;
  /** Saves queued so far, and those whose turn is over (answered, failed or dropped). */
  sends: number;
  answered: number;
  /** True while the runner writes the store, so its own write is not taken for a phone change. */
  applying: boolean;
  targets: readonly LookSyncTarget[];
  running: { readonly session: string; readonly read: Promise<void> } | null;
  latest: string | null;
};

function currentState<L extends LookDoc>(rt: Runtime<L>): LookSyncState<L> {
  const state = rt.store.getState();
  return { ...rt.theme.select(state), ...state.lookSync[rt.theme.key], edits: rt.edits };
}

function sameStatus(a: LookSyncStatus, b: LookSyncStatus): boolean {
  const keys = ['owner', 'serverSeen', 'lookChanged', 'savedChanged', 'synced', 'failure'] as const;
  return keys.every((key) => a[key] === b[key]);
}

function writeLooks<L extends LookDoc>(rt: Runtime<L>, next: LookSyncState<L>) {
  rt.applying = true;
  try {
    rt.theme.apply(rt.store.getState(), { saved: next.saved, active: next.active });
  } finally {
    rt.applying = false;
  }
}

/** The action reduced and the result written to the style store (the looks, then the standing). */
function dispatch<L extends LookDoc>(rt: Runtime<L>, action: LookSyncAction<L>): LookSyncState<L> {
  const before = currentState(rt);
  const next = reduceLookSync(rt.theme.rules, before, action);
  rt.edits = next.edits;
  if (next.saved !== before.saved || next.active !== before.active) writeLooks(rt, next);
  const { owner, serverSeen, lookChanged, savedChanged, synced, failure } = next;
  const status: LookSyncStatus = { owner, serverSeen, lookChanged, savedChanged, synced, failure };
  const { key } = rt.theme;
  if (!sameStatus(status, rt.store.getState().lookSync[key])) {
    rt.store.getState().setLookSync(key, status);
  }
  return currentState(rt);
}

function stale<L extends LookDoc>(rt: Runtime<L>, target: LookSyncTarget): boolean {
  return rt.latest !== target.session;
}

/**
 * Queues the phone's whole set; its answer clears the marks if nothing changed after it. A save
 * whose owner is no longer the phone's when its turn comes is never sent.
 */
function queueSend<L extends LookDoc>(rt: Runtime<L>, target: LookSyncTarget): void {
  const state = currentState(rt);
  const sentAfter = state.edits;
  const body = lookBody(state);
  const { themeId } = rt.theme.rules;
  rt.sends += 1;
  const turn = rt.outbox.queue(`${themeId}|${target.session}`, async () => {
    if (stale(rt, target)) return;
    await saveLooks(target.client, themeId, body).then(
      () => {
        if (!stale(rt, target)) dispatch(rt, { type: 'kept', edits: sentAfter });
      },
      (error: unknown) => {
        logger.warn(`[styles] the ${themeId} looks were not saved; the phone keeps them`, error);
        if (!stale(rt, target)) dispatch(rt, { type: 'failed', error });
      },
    );
  });
  // counted after the answer's dispatch, so equal counts mean every save's outcome is written
  void turn.then(() => {
    rt.answered += 1;
  });
}

type SaveCount = { readonly sends: number; readonly answered: number };

function saveCount<L extends LookDoc>(rt: Runtime<L>): SaveCount {
  return { sends: rt.sends, answered: rt.answered };
}

/** No save was outstanding at `before`, and none was queued or answered since. */
function noSaveSince<L extends LookDoc>(rt: Runtime<L>, before: SaveCount): boolean {
  const idleThen = before.sends === before.answered;
  return idleThen && rt.sends === before.sends && rt.answered === before.answered;
}

async function readAndApply<L extends LookDoc>(rt: Runtime<L>, target: LookSyncTarget) {
  const before = saveCount(rt);
  const { rules } = rt.theme;
  try {
    const server = await fetchLooks(target.client, rules);
    if (stale(rt, target) || !noSaveSince(rt, before)) return;
    const next = dispatch(rt, { type: 'served', server });
    if (next.lookChanged || next.savedChanged) queueSend(rt, target);
  } catch (error) {
    if (stale(rt, target) || !noSaveSince(rt, before)) return;
    logger.warn(`[styles] the ${rules.themeId} looks could not be read; the phone keeps its own`, error);
    dispatch(rt, { type: 'failed', error });
  }
}

/** The looks are now this target's owner's: another owner's copy goes before anything else. */
function claim<L extends LookDoc>(rt: Runtime<L>, target: LookSyncTarget): void {
  rt.latest = target.session;
  dispatch(rt, { type: 'claimed', owner: target.session });
}

function refresh<L extends LookDoc>(rt: Runtime<L>, target: LookSyncTarget): Promise<void> {
  claim(rt, target);
  if (rt.running?.session === target.session) return rt.running.read;
  const read = readAndApply(rt, target).finally(() => {
    if (rt.running?.read === read) rt.running = null;
  });
  rt.running = { session: target.session, read };
  return read;
}

function attach<L extends LookDoc>(rt: Runtime<L>, target: LookSyncTarget): () => void {
  claim(rt, target);
  rt.targets = [...rt.targets, target];
  return () => {
    rt.targets = rt.targets.filter((attached) => attached !== target);
  };
}

/** A change to the theme's looks in the store that the runner did not make: the phone's. */
function onStoreChange<L extends LookDoc>(rt: Runtime<L>, state: StyleState, previous: StyleState) {
  if (rt.applying) return;
  const now = rt.theme.select(state);
  const was = rt.theme.select(previous);
  if (now === was) return;
  const savedMoved = !sameLooks(now.saved, was.saved);
  const activeMoved = !sameLook(now.active, was.active);
  if (savedMoved) dispatch(rt, { type: 'savedChanged', saved: now.saved });
  if (activeMoved) dispatch(rt, { type: 'edited', look: now.active });
  // before the first meeting a change is only marked: a PUT then would replace the server's looks
  // unmerged, so the next read merges it in and sends the whole set
  const { serverSeen, synced } = currentState(rt);
  const target = rt.targets[rt.targets.length - 1];
  const ready = serverSeen && synced !== 'local-only';
  if ((savedMoved || activeMoved) && target && ready) queueSend(rt, target);
}

function createRunner<L extends LookDoc>(
  store: StyleStoreApi,
  theme: LookTheme<L>,
  outbox: LookOutbox,
): LookSyncRunner {
  const rt: Runtime<L> = {
    store,
    theme,
    outbox,
    edits: 0,
    sends: 0,
    answered: 0,
    applying: false,
    targets: [],
    running: null,
    latest: null,
  };
  // for the store's lifetime: a change made while no LookSync is mounted is marked, sent later
  store.subscribe((state, previous) => onStoreChange(rt, state, previous));
  return Object.freeze({
    refresh: (target: LookSyncTarget) => refresh(rt, target),
    attach: (target: LookSyncTarget) => attach(rt, target),
  });
}

type Runners = {
  readonly play: LookSyncRunner;
  readonly hud: LookSyncRunner;
  readonly arcade: LookSyncRunner;
  readonly candy: LookSyncRunner;
};

const runners = new WeakMap<StyleStoreApi, Runners>();

/** Play's, HUD's, Arcade's and Candy's runners for this store, made once (one outbox between them). */
export function lookSyncRunners(store: StyleStoreApi): Runners {
  const made = runners.get(store);
  if (made) return made;
  const outbox = createLookOutbox();
  const next: Runners = Object.freeze({
    play: createRunner(store, PLAY_LOOK_THEME, outbox),
    hud: createRunner(store, HUD_LOOK_THEME, outbox),
    arcade: createRunner(store, ARCADE_LOOK_THEME, outbox),
    candy: createRunner(store, CANDY_LOOK_THEME, outbox),
  });
  runners.set(store, next);
  return next;
}
