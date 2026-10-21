// The live event stream's frames and what each one does (PRD-001 §4.4, K5). GET /api/v1/tasks/stream
// is an invalidation signal, not a data feed (automatos-ai orchestrator/services/board_events.py):
// on connect it sends board_changed {workspace_id}; every pg_notify on the board channel is
// forwarded as board_changed {workspace_id, task_id, status, event}, or as chat_changed
// {workspace_id, chat_id, user_id, event} when a background message lands in a chat. Each frame is
// parsed with zod; an unknown event or a frame that does not fit is ignored, never a crash.
// board_changed refetches the board, the open ticket, the needs-you number and the questions (the
// web's use-board-event-stream.ts + use-needs-you.ts); both are fanned out to subscribers (the hub).

import type { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { logger } from '../lib/logger';
import { matchesFamily, type KeyFamilyName } from './query-keys';
import type { ServerEvent } from './sse';

export const LIVE_EVENT_TYPES = ['board_changed', 'chat_changed'] as const;
export type LiveEventType = (typeof LIVE_EVENT_TYPES)[number];

/** A field this version reads loosely: a value of another type reads as absent. */
const OptionalText = z.string().nullable().optional().catch(undefined);

/** Every pg_notify that is not a chat's: a ticket's change (task_id, status) or the connect sync. */
export const BoardChangedSchema = z.object({
  workspace_id: z.string(),
  task_id: z.number().int().nullable().optional().catch(undefined),
  status: OptionalText,
  event: OptionalText,
});

/** A background message landed in a chat; user_id says whose (consumers drop other people's). */
export const ChatChangedSchema = z.object({
  workspace_id: z.string(),
  chat_id: z.string(),
  user_id: z.union([z.number(), z.string()]).nullable().optional().catch(undefined),
  event: OptionalText,
});

export type BoardChanged = Readonly<z.output<typeof BoardChangedSchema>>;
export type ChatChanged = Readonly<z.output<typeof ChatChangedSchema>>;

type LiveData = { readonly board_changed: BoardChanged; readonly chat_changed: ChatChanged };
export type LiveEventData<T extends LiveEventType> = LiveData[T];

export type LiveEvent = {
  [T in LiveEventType]: { readonly type: T; readonly data: LiveEventData<T> };
}[LiveEventType];

const SCHEMAS: {
  readonly [T in LiveEventType]: z.ZodType<LiveEventData<T>, z.ZodTypeDef, unknown>;
} = {
  board_changed: BoardChangedSchema,
  chat_changed: ChatChangedSchema,
};

function isLiveEventType(name: string): name is LiveEventType {
  return (LIVE_EVENT_TYPES as readonly string[]).includes(name);
}

/** The frame as this version reads it, or null: an unknown event, or data that does not fit. */
export function parseLiveEvent(event: ServerEvent): LiveEvent | null {
  if (!isLiveEventType(event.event)) return null;
  const parsed = SCHEMAS[event.event].safeParse(event.data);
  if (!parsed.success) return null;
  return { type: event.event, data: parsed.data } as LiveEvent;
}

/** The key families each event refetches; chat_changed only reaches its subscribers. */
export const LIVE_INVALIDATIONS: Readonly<Record<LiveEventType, readonly KeyFamilyName[]>> =
  Object.freeze({
    board_changed: Object.freeze(['board', 'ticket', 'needsYou', 'questions'] as const),
    chat_changed: Object.freeze([] as const),
  });

/** The stream replays nothing, so a resume refetches every family a missed event would have. */
export const RESUME_INVALIDATIONS: readonly KeyFamilyName[] = Object.freeze([
  ...new Set(LIVE_EVENT_TYPES.flatMap((type) => LIVE_INVALIDATIONS[type])),
]);

/**
 * Marks every query of these families stale and refetches the ones on screen. A refetch already
 * in flight is kept, not restarted: several signals in a row cost one request (the web's
 * cancelRefetch: false). A failed refetch is the query's own error state; this only logs.
 */
export function invalidateFamilies(
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
  families: readonly KeyFamilyName[],
): Promise<void> {
  if (families.length === 0) return Promise.resolve();
  return queryClient
    .invalidateQueries(
      { predicate: (query) => families.some((name) => matchesFamily(name, query.queryKey)) },
      { cancelRefetch: false },
    )
    .catch((error: unknown) => logger.warn('[live] refetch after a live event failed', error));
}

export type LiveStatus = 'live' | 'connecting' | 'offline';
export type LiveHandler<T extends LiveEventType> = (data: LiveEventData<T>) => void;

type Subscription = { readonly type: LiveEventType; readonly handler: (data: never) => void };

/** The fan-out: subscribers per event type, and the connection's status for the header. */
export type LiveHub = {
  readonly on: <T extends LiveEventType>(type: T, handler: LiveHandler<T>) => () => void;
  readonly emit: (event: LiveEvent) => void;
  readonly status: () => LiveStatus;
  readonly setStatus: (status: LiveStatus) => void;
  /** useSyncExternalStore's subscribe: the listener runs on every status change. */
  readonly onStatus: (listener: () => void) => () => void;
};

/** Runs each one; a subscriber that throws is logged and the others still run. */
function deliver(subscriptions: readonly Subscription[], event: LiveEvent): void {
  subscriptions
    .filter((subscription) => subscription.type === event.type)
    .forEach((subscription) => {
      try {
        (subscription.handler as (data: LiveEvent['data']) => void)(event.data);
      } catch (error) {
        logger.warn(`[live] a ${event.type} subscriber failed`, error);
      }
    });
}

export function createLiveHub(): LiveHub {
  let subscriptions: readonly Subscription[] = [];
  let listeners: readonly (() => void)[] = [];
  let current: LiveStatus = 'offline';
  return Object.freeze({
    on: <T extends LiveEventType>(type: T, handler: LiveHandler<T>) => {
      const subscription: Subscription = { type, handler };
      subscriptions = [...subscriptions, subscription];
      return () => {
        subscriptions = subscriptions.filter((entry) => entry !== subscription);
      };
    },
    emit: (event: LiveEvent) => deliver(subscriptions, event),
    status: () => current,
    setStatus: (status: LiveStatus) => {
      if (status === current) return;
      current = status;
      listeners.forEach((listener) => listener());
    },
    onStatus: (listener: () => void) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((entry) => entry !== listener);
      };
    },
  });
}
