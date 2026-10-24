// The ONE file of the app that imports expo-notifications (PRD-001 §4.8, US-014b): the narrow
// surface of 0.32.17 the push wave uses, as the typed NotificationsPort and its one implementation.
// Every other module takes the port through a type-only import (erased, so the native module never
// loads in node) and vitest passes a fake; no test imports this file at run time. Thin on purpose:
// it maps types and decides nothing, except that a foreground handler that fails shows nothing
// (SHOW_NOTHING, the unverified answer) instead of leaving the system to time out.

import {
  AndroidImportance,
  AndroidNotificationVisibility,
  DEFAULT_ACTION_IDENTIFIER,
  IosAuthorizationStatus,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  addPushTokenListener,
  clearLastNotificationResponse,
  dismissAllNotificationsAsync,
  dismissNotificationAsync,
  getExpoPushTokenAsync,
  getLastNotificationResponse,
  getPermissionsAsync,
  requestPermissionsAsync,
  setBadgeCountAsync,
  setNotificationCategoryAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  type NotificationPermissionsStatus,
} from 'expo-notifications';

import { SHOW_NOTHING } from './foreground';
import type {
  AndroidImportanceName,
  AndroidVisibilityName,
  CategoryAction,
  ChannelInput,
  ForegroundHandler,
  ListenerHandle,
  PermissionAnswer,
  PermissionRequest,
  PushCategory,
} from './port';

export type NotificationsPort = Readonly<{
  setNotificationCategoryAsync: (
    identifier: string,
    actions: readonly CategoryAction[],
    options: PushCategory['options'],
  ) => Promise<unknown>;
  setNotificationChannelAsync: (id: string, channel: ChannelInput) => Promise<unknown>;
  setNotificationHandler: (handler: ForegroundHandler | null) => void;
  getPermissionsAsync: () => Promise<PermissionAnswer>;
  /** Only src/push/registration/permission.ts calls it, and only from a person's tap (KP11). */
  requestPermissionsAsync: (request: PermissionRequest) => Promise<PermissionAnswer>;
  /** The Expo push token's value (ExponentPushToken[…]); never logged. */
  getExpoPushTokenAsync: (options: Readonly<{ projectId: string }>) => Promise<string>;
  /** Told when the OS hands the app a new device token; the Expo token is then read again. */
  addPushTokenListener: (listener: () => void) => ListenerHandle;
  addNotificationReceivedListener: (listener: (notification: unknown) => void) => ListenerHandle;
  addNotificationResponseReceivedListener: (
    listener: (response: unknown) => void,
  ) => ListenerHandle;
  /** The response that launched or last foregrounded the app, if any (a cold start's tap). */
  getLastNotificationResponse: () => unknown;
  clearLastNotificationResponse: () => void;
  dismissNotificationAsync: (identifier: string) => Promise<void>;
  dismissAllNotificationsAsync: () => Promise<void>;
  setBadgeCountAsync: (count: number) => Promise<boolean>;
  /** A tap on the notification itself (equals config's DEFAULT_ACTION_ID). */
  DEFAULT_ACTION_IDENTIFIER: string;
  androidImportance: Readonly<Record<AndroidImportanceName, number>>;
  androidVisibility: Readonly<Record<AndroidVisibilityName, number>>;
}>;

/** iOS delivers quietly under these (no prompt was answered with Allow). */
const QUIET_IOS_STATUSES: readonly IosAuthorizationStatus[] = [
  IosAuthorizationStatus.PROVISIONAL,
  IosAuthorizationStatus.EPHEMERAL,
];

function answerOf(answer: NotificationPermissionsStatus): PermissionAnswer {
  const status: string = answer.status;
  const iosStatus = answer.ios?.status;
  return Object.freeze({
    status: status === 'granted' || status === 'denied' ? status : 'undetermined',
    canAskAgain: answer.canAskAgain,
    provisional: iosStatus !== undefined && QUIET_IOS_STATUSES.includes(iosStatus),
  });
}

function handlerOf(handler: ForegroundHandler | null) {
  if (!handler) return null;
  return {
    handleNotification: (notification: unknown) =>
      handler.handleNotification(notification).catch(() => SHOW_NOTHING),
  };
}

export const expoNotifications: NotificationsPort = Object.freeze({
  setNotificationCategoryAsync: (identifier, actions, options) =>
    setNotificationCategoryAsync(identifier, [...actions], options),
  setNotificationChannelAsync: (id, channel) => setNotificationChannelAsync(id, channel),
  setNotificationHandler: (handler) => setNotificationHandler(handlerOf(handler)),
  getPermissionsAsync: async () => answerOf(await getPermissionsAsync()),
  requestPermissionsAsync: async (request) =>
    answerOf(await requestPermissionsAsync({ ios: { ...request.ios } })),
  getExpoPushTokenAsync: async ({ projectId }) => (await getExpoPushTokenAsync({ projectId })).data,
  addPushTokenListener: (listener) => addPushTokenListener(() => listener()),
  addNotificationReceivedListener: (listener) => addNotificationReceivedListener(listener),
  addNotificationResponseReceivedListener: (listener) =>
    addNotificationResponseReceivedListener(listener),
  getLastNotificationResponse: () => getLastNotificationResponse(),
  clearLastNotificationResponse: () => clearLastNotificationResponse(),
  dismissNotificationAsync: (identifier) => dismissNotificationAsync(identifier),
  dismissAllNotificationsAsync: () => dismissAllNotificationsAsync(),
  setBadgeCountAsync: (count) => setBadgeCountAsync(count),
  DEFAULT_ACTION_IDENTIFIER,
  androidImportance: Object.freeze({
    HIGH: AndroidImportance.HIGH,
    DEFAULT: AndroidImportance.DEFAULT,
  }),
  androidVisibility: Object.freeze({ PRIVATE: AndroidNotificationVisibility.PRIVATE }),
});
