// Shared fixtures of the platform tests: a fake NotificationsPort that records every call in
// order (a method a test did not stub records its name and throws), the installed module's Android
// numbers, and the exact actions and calls US-014b registers (KP7, KP20).

import type { NotificationsPort } from '../platform/port';

/** expo-notifications 0.32.17's numbers (NotificationChannelManager.types.d.ts). */
export const IMPORTANCE = { HIGH: 6, DEFAULT: 5 } as const;
export const VISIBILITY = { PRIVATE: 2 } as const;

export const REPLY = {
  identifier: 'reply',
  buttonTitle: 'Reply…',
  textInput: { submitButtonTitle: 'Send', placeholder: 'Your answer' },
  options: { opensAppToForeground: true, isAuthenticationRequired: true },
};
export const OPEN = {
  identifier: 'open',
  buttonTitle: 'Open',
  options: { opensAppToForeground: true },
};
export const QUESTION_OPTIONS = { previewPlaceholder: 'A question needs your answer' };

export type Call = readonly [method: string, ...args: unknown[]];

/** A fake port that records every call in order; overrides replace a method (to fail, or to answer). */
export function fakePort(overrides: Partial<NotificationsPort> = {}) {
  const calls: Call[] = [];
  const record =
    (method: string) =>
    async (...args: unknown[]) => {
      calls.push([method, ...args]);
      return null;
    };
  const untouched = (method: string) => () => {
    calls.push([method]);
    throw new Error(`this test does not expect ${method}`);
  };
  const port: NotificationsPort = {
    setNotificationCategoryAsync: record('category'),
    setNotificationChannelAsync: record('channel'),
    setNotificationHandler: untouched('setNotificationHandler'),
    getPermissionsAsync: untouched('getPermissionsAsync'),
    requestPermissionsAsync: untouched('requestPermissionsAsync'),
    getExpoPushTokenAsync: untouched('getExpoPushTokenAsync'),
    addPushTokenListener: untouched('addPushTokenListener'),
    addNotificationReceivedListener: untouched('addNotificationReceivedListener'),
    addNotificationResponseReceivedListener: untouched('addNotificationResponseReceivedListener'),
    getLastNotificationResponse: untouched('getLastNotificationResponse'),
    clearLastNotificationResponse: untouched('clearLastNotificationResponse'),
    dismissNotificationAsync: untouched('dismissNotificationAsync'),
    dismissAllNotificationsAsync: untouched('dismissAllNotificationsAsync'),
    setBadgeCountAsync: untouched('setBadgeCountAsync'),
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    androidImportance: IMPORTANCE,
    androidVisibility: VISIBILITY,
    ...overrides,
  };
  return { port, calls };
}

const channelCall = (id: string, name: string, importance: number): Call => [
  'channel',
  id,
  { name, importance, lockscreenVisibility: VISIBILITY.PRIVATE, showBadge: true },
];

export const EXPECTED_CHANNEL_CALLS: Call[] = [
  channelCall('questions', 'Questions', IMPORTANCE.HIGH),
  channelCall('review', 'Ready for review', IMPORTANCE.DEFAULT),
  channelCall('auto', 'Auto', IMPORTANCE.DEFAULT),
];

export const EXPECTED_CATEGORY_CALLS: Call[] = [
  ...['0', '1', '2', '3'].map((n): Call => [
    'category',
    `automatos.question.${n}`,
    [REPLY, OPEN],
    QUESTION_OPTIONS,
  ]),
  ['category', 'automatos.open', [OPEN], { previewPlaceholder: 'Automatos Go' }],
];
