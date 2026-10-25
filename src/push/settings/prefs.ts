// The push switches over the notification preferences (PRD-001 §4.7, D-TYPES, KP12), pure. A switch
// is the 'push' rows of its push type's events (W2 K7: no row means on). PUT
// /api/notification-preferences replaces ALL of the caller's rows for each event_type it names
// (bulk_update_preferences, W2 US-014a's contract), so a change sends every row GET returned for
// those events — every destination, channel_connection_id kept, only the 'push' rows changed — plus
// a 'push' row for an event that had none, and no row of any other event. The type → events map is
// GET's push_types once W2 lands (RE-VERIFY after W2), else the named fallback below. The rows are
// never changed: every answer is a new, frozen array.

import type { ApiClient } from '../../api/client';
import { putPreferences } from '../api';
import { PUSH_DESTINATION } from '../config';
import type { PreferenceRow, Preferences, PreferencesSaved, PushTypes } from '../schemas/server';

export type PushTypeKey = keyof PushTypes;

export type PushTypeEvents = Readonly<Record<PushTypeKey, readonly string[]>>;

/**
 * W2's services/push/payload.PUSH_TYPE_EVENTS (K8) plus the digest switch's own event (K12), as GET's
 * push_types sends them (W2 US-014a): the map when a server sends none.
 */
export const PUSH_TYPE_EVENTS: PushTypeEvents = Object.freeze({
  needs_answer: Object.freeze(['question_pending', 'approval_pending', 'mission_plan_ready']),
  review: Object.freeze(['review_pending']),
  auto_message: Object.freeze(['auto_message']),
  digest: Object.freeze(['daily_digest']),
});

/** The three push types the Notifications screen switches (D-TYPES); the digest is its own row. */
export const PUSH_TYPE_SWITCHES = Object.freeze([
  'needs_answer',
  'review',
  'auto_message',
] as const);

/** GET's map when it sent one, else the fallback. */
export function pushTypesOf(response: Pick<Preferences, 'push_types'>): PushTypeEvents {
  return response.push_types ?? PUSH_TYPE_EVENTS;
}

const isPushRow = (row: PreferenceRow) => row.destination === PUSH_DESTINATION;

/** On when every 'push' row of those events is enabled; an event with no push row counts as on. */
export function switchState(rows: readonly PreferenceRow[], events: readonly string[]): boolean {
  const named = new Set(events);
  return rows.every((row) => !named.has(row.event_type) || !isPushRow(row) || row.enabled);
}

/**
 * The PUT body that turns those events' push on or off: every row of the named events as GET sent
 * it, the 'push' rows set to enabled, then a 'push' row for each named event that had none.
 */
export function setPushType(
  rows: readonly PreferenceRow[],
  events: readonly string[],
  enabled: boolean,
): readonly PreferenceRow[] {
  const named = new Set(events);
  const kept = rows
    .filter((row) => named.has(row.event_type))
    .map((row) => (isPushRow(row) ? { ...row, enabled } : { ...row }));
  const withPush = new Set(kept.filter(isPushRow).map((row) => row.event_type));
  const added = [...named]
    .filter((event) => !withPush.has(event))
    .map((event) => ({
      event_type: event,
      destination: PUSH_DESTINATION,
      enabled,
      channel_connection_id: null,
    }));
  return Object.freeze([...kept, ...added].map((row) => Object.freeze(row)));
}

/** Sends one switch's rows at once: never queued or retried (D-WRITES); the server's answer stands. */
export function savePushType(
  client: ApiClient,
  rows: readonly PreferenceRow[],
  events: readonly string[],
  enabled: boolean,
): Promise<PreferencesSaved> {
  return putPreferences(client, setPushType(rows, events, enabled));
}
