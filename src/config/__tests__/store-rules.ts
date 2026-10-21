// The store rules app.json is held to, shared by app-privacy.test.ts and the evaluated-config
// suite in app-config.test.ts.

// ITMS-90683: App Store processing bounces a binary that references a privacy framework
// without its usage string, even when the app never asks. docs/native-modules.md 'Symbols and
// usage keys' maps each key to the modules that reference it.
export const USED_KEYS: string[] = [
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSSpeechRecognitionUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSFaceIDUsageDescription',
  'NSLocalNetworkUsageDescription',
];
export const REFERENCED_ONLY_KEYS: string[] = [
  'NSPhotoLibraryAddUsageDescription',
  'NSMotionUsageDescription',
];
export const REQUIRED_KEYS = [...USED_KEYS, ...REFERENCED_ONLY_KEYS];
// Checked against every bundled module and referenced by none, so a notice would be untrue.
export const UNREFERENCED_KEYS: string[] = [
  'NSLocationWhenInUseUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSContactsUsageDescription',
  'NSCalendarsUsageDescription',
  'NSCalendarsFullAccessUsageDescription',
  'NSRemindersUsageDescription',
  'NSAppleMusicUsageDescription',
  'NSBluetoothAlwaysUsageDescription',
  'NSUserTrackingUsageDescription',
];

export const ANDROID_PERMISSIONS = [
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
].map((name) => `android.permission.${name}`);

export const ANDROID_BLOCKED = [
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
].map((name) => `android.permission.${name}`);
