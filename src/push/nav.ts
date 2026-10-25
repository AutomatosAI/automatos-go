// The push wave's own screens (KP4): their paths live here, beside the foundation's
// src/navigation/routes.ts and never inside it. Each one is an expo-router file at exactly that path:
// app/(app)/settings/notifications.tsx is pushScreens.notifications. Settings → Account links to it
// (US-014h); a link builds it from here, never by hand.

export const pushScreens = Object.freeze({
  /** Settings → Notifications (PRD-001 §4.7): app/(app)/settings/notifications.tsx. */
  notifications: '/settings/notifications',
});
