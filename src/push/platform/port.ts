// The narrow surface of expo-notifications the push wave uses (PRD-001 §4.8, US-014b), as a typed
// port. src/push/platform/expo.ts is its one implementation (the ONLY importer of
// expo-notifications); every other module takes a NotificationsPort, so vitest passes a fake.
// Notifications and responses cross it as `unknown`: src/push/inbound/parse.ts reads them.
// Every category action opens the app (KP7): the type says so, `opensAppToForeground: true`.
// The port has no way to schedule or present a notification of the app's own (D-PAYLOAD) and none
// to run a background task (KP19): only what the server sent is ever shown.

/** A listener's handle; remove() detaches it. */
export type Subscription = Readonly<{ remove: () => void }>;

/** One button a notification category offers (expo-notifications' NotificationAction). */
export type CategoryAction = Readonly<{
  identifier: string;
  buttonTitle: string;
  textInput?: Readonly<{ submitButtonTitle: string; placeholder: string }>;
  options: Readonly<{ opensAppToForeground: true; isAuthenticationRequired?: true }>;
}>;

/** A category as registered: what iOS shows on a notification sent with its identifier. */
export type PushCategory = Readonly<{
  identifier: string;
  actions: readonly CategoryAction[];
  options: Readonly<{ previewPlaceholder: string }>;
}>;

/** The Android values a channel names; the port maps them to the module's own numbers. */
export type AndroidImportanceName = 'HIGH' | 'DEFAULT';
export type AndroidVisibilityName = 'PRIVATE';

/** An Android channel as setNotificationChannelAsync takes it (the module's numbers). */
export type ChannelInput = Readonly<{
  name: string;
  importance: number;
  lockscreenVisibility: number;
  showBadge: boolean;
}>;

/** What a foreground handler tells the system to do with a push (NotificationBehavior). */
export type Presentation = Readonly<{
  shouldShowBanner: boolean;
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
}>;

export type ForegroundHandler = Readonly<{
  handleNotification: (notification: unknown) => Promise<Presentation>;
}>;

/** The OS's answer about notifications; `provisional` is iOS's quiet delivery (provisional or ephemeral). */
export type PermissionAnswer = Readonly<{
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  provisional: boolean;
}>;

export type PermissionRequest = Readonly<{
  ios: Readonly<{ allowAlert: boolean; allowBadge: boolean; allowSound: boolean }>;
}>;

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
  addPushTokenListener: (listener: () => void) => Subscription;
  addNotificationReceivedListener: (listener: (notification: unknown) => void) => Subscription;
  addNotificationResponseReceivedListener: (listener: (response: unknown) => void) => Subscription;
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
