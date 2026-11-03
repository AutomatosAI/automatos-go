// "Pause suggestions" (PRD-268 §6.9, FR-13), outside React: the person's own pause in this
// workspace, read and written through the foundation's one client (GET and PUT /api/proactive/me,
// parsed by schema.ts MyProactiveSchema), its cache key, and the switch's view. Core stops a
// paused person's check-in runs (services/proactive/gates.py), so no new suggestion and no
// suggestion push is made; it still lists the ones already open, so the phone shows none while the
// pause is on (use-suggestions.ts) and reads the open list again on every change. A write is sent
// once per press and never retried or queued (D-WRITES; the client's mutations run networkMode
// 'always', retry off). Every value handed out is frozen.

import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { ApiClient } from '../api/client';
import { userMessage } from '../api/errors';
import { matchesFamily } from '../api/query-keys';
import { SUGGESTION_ROUTES } from './routes';
import { MyProactiveSchema, type MyProactive } from './schema';
import { PAUSE_COPY } from './strings';

type Requester = Pick<ApiClient, 'request'>;

const MINE = ['proactive', 'me'] as const;

/**
 * The pause's TanStack Query key, kept here because src/api/query-keys.ts is the foundation's (K5).
 * No family there claims it, so it stays in memory (isPersistableKey); one per server and
 * workspace, so a switch never shows another's.
 */
export const pauseQueryKeys = Object.freeze({
  /** Every pause key, for one invalidation. */
  all: () => MINE,
  mine: (apiUrl: string, workspaceId: string) => [...MINE, apiUrl, workspaceId] as const,
});

/** GET /api/proactive/me. */
export function fetchMyProactive(client: Requester, signal?: AbortSignal): Promise<MyProactive> {
  return client.request(SUGGESTION_ROUTES.me, { schema: MyProactiveSchema, signal });
}

/** PUT /api/proactive/me {paused}: only the pause (core keeps what a PUT leaves out). */
export function savePaused(client: Requester, paused: boolean): Promise<MyProactive> {
  return client.request(SUGGESTION_ROUTES.saveMe, { body: { paused }, schema: MyProactiveSchema });
}

/** Marks every suggestions key stale; the ones on screen are read again now, the rest when shown. */
export function refreshSuggestions(queryClient: Pick<QueryClient, 'invalidateQueries'>): void {
  void queryClient.invalidateQueries({
    predicate: (query) => matchesFamily('suggestions', query.queryKey),
  });
}

export type PauseDeps = Readonly<{
  client: Requester;
  queryClient: Pick<QueryClient, 'cancelQueries' | 'setQueryData' | 'invalidateQueries'>;
  key: QueryKey;
}>;

/**
 * One press: the PUT, then the server's answer in the cache (a read still out would land an older
 * answer over it, so it is cancelled first) and the open list read again. A refusal rejects with
 * the client's ApiError and changes nothing.
 */
export async function applyPause(deps: PauseDeps, paused: boolean): Promise<MyProactive> {
  const saved = await savePaused(deps.client, paused);
  await deps.queryClient.cancelQueries({ queryKey: deps.key });
  deps.queryClient.setQueryData(deps.key, saved);
  refreshSuggestions(deps.queryClient);
  return saved;
}

/**
 * The pause as the home reads it: the server's answer once it lands; undefined while the first read
 * is out, so no suggestion shows and then vanishes. A read that failed is not paused (the home
 * shows the open list, as it did before this switch): core is the one that stops new suggestions
 * and their pushes, and a person with no pause to read (403) has no list to read either.
 */
export function pausedNow(read: {
  readonly data: MyProactive | undefined;
  readonly isError: boolean;
}): boolean | undefined {
  if (read.data) return read.data.paused;
  return read.isError ? false : undefined;
}

/** A refused write: what the person asked for, and why it did not happen. */
export type PauseFailure = Readonly<{ paused: boolean; error: unknown }>;

export type PauseInput = Readonly<{
  /** The server's answer; undefined until the first read lands. */
  paused: boolean | undefined;
  /** What the person chose while its write is out; null when none is. */
  choosing: boolean | null;
  /** The first read is out. */
  loading: boolean;
  /** The last read failed (null when it answered, or while none has finished). */
  readError: unknown;
  /** The last write was refused; cleared by the next press. */
  failure: PauseFailure | null;
}>;

export type PauseView = Readonly<{
  /** The switch: the choice being sent, else the server's answer, else off. */
  value: boolean;
  /** Not pressable before the server has answered, or while a write is out. */
  disabled: boolean;
  /** Under the switch: a failure, or 'Reading…'; null when there is nothing to say. */
  line: string | null;
}>;

function failureLine(lead: string, error: unknown): string {
  return `${lead} ${userMessage(error)}`;
}

/** A refused write's line: 'Your suggestions weren't paused.' and the taxonomy's why. */
export function pauseFailureLine(failure: PauseFailure): string {
  const lead = failure.paused ? PAUSE_COPY.pauseFailed : PAUSE_COPY.resumeFailed;
  return failureLine(lead, failure.error);
}

/** The line under the switch: a refused write first, then a failed or pending first read. */
export function pauseLine(input: PauseInput): string | null {
  if (input.failure) return pauseFailureLine(input.failure);
  if (input.paused !== undefined) return null;
  if (input.readError) return failureLine(PAUSE_COPY.readFailed, input.readError);
  return input.loading ? PAUSE_COPY.reading : null;
}

export function pauseView(input: PauseInput): PauseView {
  return Object.freeze({
    value: input.choosing ?? input.paused ?? false,
    disabled: input.choosing !== null || input.paused === undefined,
    line: pauseLine(input),
  });
}
