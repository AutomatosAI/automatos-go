// One read of the workspace's themes, applied to the style store (D-PHONE-CHOICE, D58): /active
// and the offered installs (api.ts, installed.ts), decided by plan.ts, then the painted theme's
// fonts downloaded and loaded before the swap, so a theme arrives with its colours and its faces
// in one crossfade (a change of the painted style plays the flip's crossfade and, into Play,
// Auto's hello). Its mascot files follow (watchPaintFiles). A read that fails keeps what the phone
// had: nothing falls back to Studio on a passing fault. One read at a time per session (server and
// workspace): a call while one runs for the same session joins it, so a second StyleSync never
// reads twice, and a read finished after the session changed is dropped, never applied to the
// next workspace. Nothing here throws: a file or font failure is logged and Studio's faces or the
// bundled Auto stay.

import type { ApiClient } from '../../api/client';
import type { GateInput } from '../../api/capabilities';
import { logger } from '../../lib/logger';
import type { RunCrossfade } from '../provider/context';
import { flipPlan } from '../provider/flip-plan';
import type { StyleState, StyleStoreApi } from '../provider/store';
import { sameChoice, samePhoneChoice } from '../registry/style-id';
import { themeReader, type ThemeReader } from './api';
import { serialiseThemePaint } from './cache';
import { cachePaintFiles } from './files';
import { paintedInstall } from './follow';
import { applyThemeFonts, loadThemeFonts } from './fonts';
import { offeredThemes } from './installed';
import {
  paintedChange,
  planRead,
  type ThemePlan,
  type ThemeRead,
  type ThemeSnapshot,
} from './plan';
import type { LoadedThemeFonts, ThemePaint } from './types';

export type ThemeSyncDeps = {
  /** The server and workspace the read is for (sessionKey). */
  readonly session: string;
  readonly client: ApiClient;
  readonly discovery: GateInput;
  readonly store: StyleStoreApi;
  readonly crossfade: RunCrossfade;
  readonly reduceMotion: boolean;
  /** The theme on screen is gone: the toast. */
  readonly onLost: () => void;
};

/** One session's reads: the server's API URL and the workspace id. */
export function sessionKey(apiUrl: string, workspaceId: string): string {
  return `${apiUrl}|${workspaceId}`;
}

let running: { readonly session: string; readonly read: Promise<void> } | null = null;
let latestSession: string | null = null;

/** Reads and applies once; a call while a read for the same session runs gets that read. */
export function refreshThemes(deps: ThemeSyncDeps): Promise<void> {
  latestSession = deps.session;
  if (running?.session === deps.session) return running.read;
  const read = readAndApply(deps).finally(() => {
    if (running?.read === read) running = null;
  });
  running = { session: deps.session, read };
  return read;
}

function stale(deps: ThemeSyncDeps): boolean {
  return latestSession !== deps.session;
}

async function readThemes(reader: ThemeReader, discovery: GateInput): Promise<ThemeRead> {
  const [active, offered] = await Promise.all([reader.active(), offeredThemes(reader, discovery)]);
  return { active, offered };
}

function snapshotOf(state: StyleState): ThemeSnapshot {
  return { choice: state.choice, followed: state.followed, paint: state.themePaint };
}

/** Two paintings that would be stored the same. */
export function samePaint(a: ThemePaint | null, b: ThemePaint | null): boolean {
  return a === b || serialiseThemePaint(a) === serialiseThemePaint(b);
}

/** The painted theme's fonts on the phone and loaded; null when a built-in style is painted. */
async function readyFonts(client: ApiClient, plan: ThemePlan): Promise<LoadedThemeFonts | null> {
  const { paint } = plan;
  if (!paint || paintedInstall(plan.choice, plan.followed) !== paint.installId) return null;
  try {
    await cachePaintFiles(client, paint, 'font');
    return await loadThemeFonts(paint);
  } catch (error) {
    logger.warn("[styles] the theme's fonts could not be readied; Studio's faces stay", error);
    return null;
  }
}

function apply(
  deps: ThemeSyncDeps,
  snapshot: ThemeSnapshot,
  plan: ThemePlan,
  fonts: LoadedThemeFonts | null,
) {
  const { from, to } = paintedChange(snapshot, plan);
  const flip = flipPlan(from, to, deps.reduceMotion);
  const hello = flip.changed && flip.hello;
  const swap = () => {
    const state = deps.store.getState();
    state.setThemes(plan.themes);
    if (!samePaint(plan.paint, state.themePaint)) state.setThemePaint(plan.paint);
    if (fonts) state.setThemeFonts(fonts);
    if (!sameChoice(plan.followed, state.followed)) state.setFollowed(plan.followed, { hello });
    if (!samePhoneChoice(plan.choice, state.choice)) state.setChoice(plan.choice);
  };
  if (flip.changed) deps.crossfade(swap, flip.crossfadeMs);
  else swap();
}

async function readAndApply(deps: ThemeSyncDeps): Promise<void> {
  let read: ThemeRead;
  try {
    read = await readThemes(themeReader(deps.client), deps.discovery);
  } catch (error) {
    logger.warn('[styles] the workspace themes could not be read; keeping the last answers', error);
    return;
  }
  if (stale(deps)) return;
  const fonts = await readyFonts(deps.client, planRead(snapshotOf(deps.store.getState()), read));
  if (stale(deps)) return;
  // planned again after the downloads: a pick made meanwhile is the snapshot's
  const snapshot = snapshotOf(deps.store.getState());
  const plan = planRead(snapshot, read);
  apply(deps, snapshot, plan, fonts?.installId === plan.paint?.installId ? fonts : null);
  if (plan.lost) deps.onLost();
}

const fetching = new WeakSet<ThemePaint>();

/** A painting's files: its fonts (then loaded), then its mascot files, once per painting held. */
async function fetchPaintFiles(client: ApiClient, store: StyleStoreApi, paint: ThemePaint) {
  if (fetching.has(paint)) return;
  fetching.add(paint);
  try {
    if (await cachePaintFiles(client, paint, 'font')) await applyThemeFonts(store, paint);
    await cachePaintFiles(client, paint, 'mascot');
  } catch (error) {
    fetching.delete(paint); // the next change of painting tries again
    logger.warn("[styles] the theme's files could not be fetched", error);
  }
}

/** The painting the store holds when it is the theme on screen, else null. */
function shownPaint(state: StyleState): ThemePaint | null {
  const paint = state.themePaint;
  const install = paintedInstall(state.choice, state.followed);
  return paint && paint.installId === install ? paint : null;
}

/** Fetches the files of each theme the phone comes to paint (a read, a pick); the unsubscribe. */
export function watchPaintFiles(client: ApiClient, store: StyleStoreApi): () => void {
  const shown = shownPaint(store.getState());
  if (shown) void fetchPaintFiles(client, store, shown);
  return store.subscribe((state, previous) => {
    const next = shownPaint(state);
    if (next && next !== shownPaint(previous)) void fetchPaintFiles(client, store, next);
  });
}
