// The words of the push wave's notifications port (PRD-001 §4.8, US-014b): the values that cross
// it, with no expo-notifications type in them. The port itself, NotificationsPort, is declared
// beside its one implementation in src/push/platform/expo.ts (the ONLY importer of
// expo-notifications, and with registration/permission.ts the only file that names the permission
// request, KP11); other modules take it through a type-only import, which is erased, so vitest
// runs them in node with a fake. Notifications and responses cross it as `unknown`:
// src/push/inbound/parse.ts reads them. Every category action opens the app (KP7): the type says
// so, `opensAppToForeground: true`.

/** A listener's handle; remove() detaches it. */
export type ListenerHandle = Readonly<{ remove: () => void }>;

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
