// The push wave's own screens (KP4): their paths live here, beside the foundation's
// src/navigation/routes.ts and never inside it. Each one is an expo-router file at exactly that path:
// app/(app)/settings/notifications.tsx is pushScreens.notifications and app/(app)/notifications.tsx
// the inbox. Settings → Account links to the first (US-014h); the header menu, Play's Chats and a
// push that cannot open its own screen link to the inbox. A link builds it from here, never by hand.

import { UUID_PATTERN } from './config';

/** The inbox's query parameter: the notification to show first (a push's notification_id). */
export const INBOX_FOCUS_PARAM = 'focus';

export const pushScreens = Object.freeze({
  /** Settings → Notifications (PRD-001 §4.7): app/(app)/settings/notifications.tsx. */
  notifications: '/settings/notifications',
  /** The notifications inbox: app/(app)/notifications.tsx. */
  inbox: '/notifications',
});

/** The inbox, with one notification first when its id is a notification's (a UUID). */
export function inboxRoute(focus?: string | null): string {
  const id = focus?.trim();
  if (!id || !UUID_PATTERN.test(id)) return pushScreens.inbox;
  return `${pushScreens.inbox}?${INBOX_FOCUS_PARAM}=${encodeURIComponent(id)}`;
}

/** The notification an inbox route asks to show first, or null (none, or not an id). */
export function inboxFocusFrom(
  params: Readonly<Record<string, string | string[] | undefined>>,
): string | null {
  const raw = params[INBOX_FOCUS_PARAM];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}
