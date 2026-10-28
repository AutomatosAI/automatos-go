// The push wave's route table (KP4, K4): every server path push calls, as {method, path}, beside the
// foundation's src/api/routes.ts and never inside it. GET /api/workspaces/current and discovery stay
// the foundation's (imported from there, never repeated here). scripts/check-routes.ts checks each
// entry against the pinned route manifest, which has W1's device routes and W2's push settings
// since the re-pin to 8c9361687. Shapes: W1 api/mobile_devices.py, W2 api/mobile_push.py,
// api/notifications.py, api/approval_grants.py (src/push/schemas/server.ts).

import type { Route } from '../api/routes';

/** Where today's brief on request comes from while the pinned manifest does not have it. */
const DIGEST_NOW_UPSTREAM = "automatos-ai feat/digest-now (today's brief on request, 28 Oct 2026)";

export const PUSH_ROUTES = Object.freeze({
  devices: Object.freeze({
    /** Register this phone or update its row: {device_id, push_key}, the key only when minted. */
    register: { method: 'POST', path: '/api/v1/mobile/devices' },
    /** The caller's devices (an owner or admin sees the workspace's): {devices: [to_dict]}. */
    list: { method: 'GET', path: '/api/v1/mobile/devices' },
    /** push_enabled, digest_time or timezone of one of the caller's own devices (extra=forbid). */
    update: { method: 'PATCH', path: '/api/v1/mobile/devices/{device_id}' },
    /** Revokes this phone's own row (sign-out, Remove this phone); it deletes no account (D63). */
    revoke: { method: 'DELETE', path: '/api/v1/mobile/devices/{device_id}' },
  } as const),
  /**
   * Today's brief now, no body: 202 {status: 'queued'} (it arrives as Auto's message in the Auto
   * thread within about a minute, with an "Auto messaged you" push), 429 {code:
   * 'digest_rate_limited', retry_after_seconds}, 503 {code: 'digest_unavailable'}. Listed only with
   * the discovery capability digest_now.
   */
  digestNow: {
    method: 'POST',
    path: '/api/v1/mobile/digest/now',
    pendingUpstream: DIGEST_NOW_UPSTREAM,
  },
  /** {redact_questions}: owners and admins make question pushes generic (W2 US-014b). */
  pushSettings: { method: 'PUT', path: '/api/v1/mobile/push-settings' },
  preferences: Object.freeze({
    /** The caller's merged rows, push rows and push_types included once W2 lands (US-014a). */
    list: { method: 'GET', path: '/api/notification-preferences' },
    /** Replaces ALL of the caller's rows for each event_type it names (KP12). */
    replace: { method: 'PUT', path: '/api/notification-preferences' },
  } as const),
  /** Mark one bell notification read (no-op when it already is). */
  notificationRead: { method: 'POST', path: '/api/notifications/{notification_id}/read' },
  notifications: Object.freeze({
    /** The bell's rows, newest first: ?limit&offset&unread_only (api/notifications.py). */
    list: { method: 'GET', path: '/api/notifications' },
    /** {success, count}: the unread rows not dismissed. */
    unreadCount: { method: 'GET', path: '/api/notifications/unread-count' },
    /** {success, marked_count}: every unread row read. */
    readAll: { method: 'POST', path: '/api/notifications/read-all' },
  } as const),
  /** One Mission run: its config names the chat it was launched from (origin_chat_id). */
  mission: { method: 'GET', path: '/api/missions/{mission_id}' },
  questions: Object.freeze({
    /** ?status=pending&kind=question: the stale check before a question link opens (KP9). */
    list: { method: 'GET', path: '/api/v1/approval-grants' },
    /** {answer_text} | {option}: compare-and-swap; a loser still gets 200 with the winner (KP8). */
    answer: { method: 'POST', path: '/api/v1/approval-grants/{grant_id}/answer' },
  } as const),
  /** One ticket by its row id: the stale check before a task link opens. */
  ticket: { method: 'GET', path: '/api/v1/tasks/{task_id}' },
  /** One social post as it will publish: the stale check before a social_post link opens. */
  socialPost: { method: 'GET', path: '/api/socials/posts/{post_id}' },
  /** One chat: the stale check before a chat link opens (404 gone, 403 another person's). */
  chat: { method: 'GET', path: '/api/chat/{chat_id}' },
} as const satisfies Record<string, Route | Record<string, Route>>);
