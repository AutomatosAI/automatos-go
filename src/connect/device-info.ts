// This phone as its row in Studio's Phones & devices names it (POST /pair's name, platform and
// app_version). expo-device is not installed and this wave adds no native module, so the name is
// the platform's, not the phone's own. The app ships iPhone and Android builds only (no web, no
// iPad: supportsTablet is false), so any OS but Android reads as the iPhone. Each value is cut to
// the server's column limit.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { APP_VERSION_MAX_LENGTH, DEVICE_NAME_MAX_LENGTH } from './config';
import { DEVICE_NAME_COPY } from './strings';

export type DevicePlatform = 'ios' | 'android';

const ANDROID = 'android';

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

export function devicePlatform(os: string = Platform.OS): DevicePlatform {
  return os === ANDROID ? 'android' : 'ios';
}

/** 'Automatos Go on iPhone' or 'Automatos Go on Android'. */
export function deviceName(os: string = Platform.OS): string {
  return clip(DEVICE_NAME_COPY[devicePlatform(os)], DEVICE_NAME_MAX_LENGTH);
}

/** app.json's version, as Settings → Account shows it; undefined when the build has none. */
export function appVersion(
  version: string | undefined = Constants.expoConfig?.version,
): string | undefined {
  const trimmed = version?.trim();
  return trimmed ? clip(trimmed, APP_VERSION_MAX_LENGTH) : undefined;
}
