// The store rules app.json is held to, shared by app-privacy.test.ts and the evaluated-config
// suite in app-config.test.ts (src/config/__tests__): the usage keys the binary needs and the ones
// it must not carry, the Android permissions it declares and blocks, and the data types its
// privacy manifest collects. The rules themselves (a usage string's length, its notice, tracking
// off) stay in those tests.

// ITMS-90683: App Store processing bounces a binary that references a privacy framework
// without its usage string, even when the app never asks. docs/native-modules.md 'Symbols and
// usage keys' maps each key to the modules that reference it.
export const USED_KEYS: readonly string[] = Object.freeze([
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSSpeechRecognitionUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSFaceIDUsageDescription',
  'NSLocalNetworkUsageDescription',
]);
export const REFERENCED_ONLY_KEYS: readonly string[] = Object.freeze([
  'NSPhotoLibraryAddUsageDescription',
  'NSMotionUsageDescription',
]);
export const REQUIRED_KEYS: readonly string[] = Object.freeze([
  ...USED_KEYS,
  ...REFERENCED_ONLY_KEYS,
]);
// Checked against every bundled module and referenced by none, so a notice would be untrue.
export const UNREFERENCED_KEYS: readonly string[] = Object.freeze([
  'NSLocationWhenInUseUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSContactsUsageDescription',
  'NSCalendarsUsageDescription',
  'NSCalendarsFullAccessUsageDescription',
  'NSRemindersUsageDescription',
  'NSAppleMusicUsageDescription',
  'NSBluetoothAlwaysUsageDescription',
  'NSUserTrackingUsageDescription',
]);

/** Android's full names for the permissions listed by their short ones, frozen. */
const permissions = (names: readonly string[]): readonly string[] =>
  Object.freeze(names.map((name) => `android.permission.${name}`));

export const ANDROID_PERMISSIONS: readonly string[] = permissions([
  'INTERNET',
  'ACCESS_NETWORK_STATE',
  'CAMERA',
  'RECORD_AUDIO',
  'MODIFY_AUDIO_SETTINGS',
  'BLUETOOTH',
  'BLUETOOTH_ADMIN',
  'POST_NOTIFICATIONS',
  'RECEIVE_BOOT_COMPLETED',
  'WAKE_LOCK',
  'USE_BIOMETRIC',
  'USE_FINGERPRINT',
  'VIBRATE',
  'WRITE_EXTERNAL_STORAGE',
]);

export const ANDROID_BLOCKED: readonly string[] = permissions([
  'SYSTEM_ALERT_WINDOW',
  'FOREGROUND_SERVICE',
  'READ_EXTERNAL_STORAGE',
  'READ_MEDIA_IMAGES',
  'READ_MEDIA_VIDEO',
  'READ_MEDIA_AUDIO',
  'ACCESS_FINE_LOCATION',
  'ACCESS_COARSE_LOCATION',
  'ACCESS_BACKGROUND_LOCATION',
  'READ_CONTACTS',
  'WRITE_CONTACTS',
  // expo-audio's library manifest declares it (its lock-screen controls service); no background audio (D33)
  'FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  // androidx.test:core reaches the release merge with it; nothing moves tasks (docs/android-spike.md)
  'REORDER_TASKS',
]);

// ITMS-91053: the privacy manifest. The collected types follow the privacy policy draft's
/** The manifest's full names for the data types listed by their suffixes, frozen. */
const dataTypes = (names: readonly string[]): readonly string[] =>
  Object.freeze(names.map((name) => `NSPrivacyCollectedDataType${name}`));

export const LINKED_TYPES: readonly string[] = dataTypes([
  'EmailAddress',
  'Name',
  'PhotosorVideos',
  'AudioData',
  'CustomerSupport',
  'OtherUserContent',
  'UserID',
  'DeviceID',
  'OtherUsageData',
  'OtherDiagnosticData',
]);
export const NOT_LINKED_TYPES: readonly string[] = dataTypes(['CrashData']);
// No analytics, no performance tracing, no location: the app collects none (US-002f notes).
export const NEVER_DECLARED: readonly string[] = dataTypes([
  'ProductInteraction',
  'PerformanceData',
  'PreciseLocation',
  'CoarseLocation',
]);
