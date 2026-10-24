// This phone as a registration describes it (W1 RegisterDeviceRequest, W2 US-009's name): the
// adapter over expo-constants, expo-device, expo-localization and the Platform, plus the Expo push
// token through the notifications port. Each value is checked or cut to W1's limits; a value that
// cannot be read is null and registration waits for it — a missing time zone is never guessed as
// 'UTC'. The name is the phone's model (expo-device, US-002g), else 'iPhone' / 'Android phone'.
// The platform and app version are the connect kit's (src/connect/device-info.ts), so pairing and
// registration describe the phone the same way. The token is never logged.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { getCalendars, getLocales } from 'expo-localization';
import { Platform } from 'react-native';
import { z } from 'zod';

import { appVersion, devicePlatform } from '../../connect/device-info';
import { logger } from '../../lib/logger';
import type { PushPlatform } from '../api';
import {
  EXPO_PUSH_TOKEN_MAX_LENGTH,
  EXPO_PUSH_TOKEN_PATTERN,
  LOCALE_MAX_LENGTH,
  PHONE_NAME_MAX_LENGTH,
  TIMEZONE_MAX_LENGTH,
} from '../config';
import type { NotificationsPort } from '../platform/expo';
import { PUSH_PHONE_NAME_COPY } from '../strings';

export type DeviceFacts = Readonly<{
  /** The build's EAS project id, or null (then 'not_configured'). */
  projectId: string | null;
  platform: PushPlatform;
  appVersion: string | null;
  /** A BCP 47 tag, at most 35 characters. */
  locale: string | null;
  /** An IANA name, as the phone's calendar gives it. */
  timeZone: string | null;
  name: string;
}>;

/** What register.ts reads the phone through; tests pass a fake. */
export type DeviceSource = Readonly<{
  read: () => DeviceFacts;
  /** The Expo push token, or null when there is none this time. */
  expoToken: (projectId: string) => Promise<string | null>;
}>;

const Text = z.string().trim().min(1);

/** The text, trimmed, when it is a non-empty string; anything else is null. */
function textOf(value: unknown): string | null {
  const parsed = Text.safeParse(value);
  return parsed.success ? parsed.data : null;
}

type ConstantsView = Readonly<{
  expoConfig?: { readonly extra?: { readonly eas?: { readonly projectId?: unknown } } } | null;
  easConfig?: { readonly projectId?: unknown } | null;
}>;

/** app.json's extra.eas.projectId, else EAS's own config; absent → null. */
export function projectIdOf(constants: ConstantsView): string | null {
  return (
    textOf(constants.expoConfig?.extra?.eas?.projectId) ?? textOf(constants.easConfig?.projectId)
  );
}

/** The first preferred locale's tag, cut to W1's 35 characters. */
export function localeOf(locales: readonly { readonly languageTag?: unknown }[]): string | null {
  return textOf(locales[0]?.languageTag)?.slice(0, LOCALE_MAX_LENGTH) ?? null;
}

/** The first calendar's IANA time zone; none (or one too long for W1) → null, never a guess. */
export function timeZoneOf(calendars: readonly { readonly timeZone?: unknown }[]): string | null {
  const zone = textOf(calendars[0]?.timeZone);
  return zone && zone.length <= TIMEZONE_MAX_LENGTH ? zone : null;
}

/** The phone's model name, else the platform's word; trimmed, at most 120 characters. */
export function phoneNameOf(modelName: unknown, platform: PushPlatform): string {
  const name = textOf(modelName) ?? PUSH_PHONE_NAME_COPY[platform];
  return name.slice(0, PHONE_NAME_MAX_LENGTH).trim();
}

/** W1's token rule; anything else is not sent. */
export function expoTokenOf(value: unknown): string | null {
  const token = textOf(value);
  const valid =
    token !== null &&
    token.length <= EXPO_PUSH_TOKEN_MAX_LENGTH &&
    EXPO_PUSH_TOKEN_PATTERN.test(token);
  return valid ? token : null;
}

/** A native read that throws is a value not known this time. */
function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function readDeviceFacts(): DeviceFacts {
  const platform = devicePlatform(Platform.OS);
  return Object.freeze({
    projectId: safely(() => projectIdOf(Constants), null),
    platform,
    appVersion: safely(() => appVersion() ?? null, null),
    locale: safely(() => localeOf(getLocales()), null),
    timeZone: safely(() => timeZoneOf(getCalendars()), null),
    name: safely(() => phoneNameOf(Device.modelName, platform), PUSH_PHONE_NAME_COPY[platform]),
  });
}

export async function readExpoToken(
  port: Pick<NotificationsPort, 'getExpoPushTokenAsync'>,
  projectId: string,
): Promise<string | null> {
  try {
    return expoTokenOf(await port.getExpoPushTokenAsync({ projectId }));
  } catch {
    logger.warn('[push] no push token this time');
    return null;
  }
}

/** The phone, read natively; the token through the given port. */
export function nativeDeviceSource(
  port: Pick<NotificationsPort, 'getExpoPushTokenAsync'>,
): DeviceSource {
  return Object.freeze({
    read: readDeviceFacts,
    expoToken: (projectId: string) => readExpoToken(port, projectId),
  });
}
