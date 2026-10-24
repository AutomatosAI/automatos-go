// The OS permission for notifications (KP11). askPermission is the ONLY call of the permission
// request in the app, and it runs only from a person's tap — the in-context sheet or the Settings
// button — never at launch or on mount; readPermission only reads. The answer maps to three words:
// granted (iOS's quiet provisional delivery included), denied (or never askable again), or not yet
// asked. iOS asks for alerts, the badge (KP14 sets it) and sounds. A failing call is logged by kind
// and reads as not asked, so nothing registers on a guess.

import { logger } from '../../lib/logger';
import type { NotificationsPort } from '../platform/expo';
import type { PermissionAnswer, PermissionRequest } from '../platform/port';
import type { PermissionState } from './state';

const PERMISSION_REQUEST: PermissionRequest = Object.freeze({
  ios: Object.freeze({ allowAlert: true, allowBadge: true, allowSound: true }),
});

export function permissionOf(answer: PermissionAnswer): PermissionState {
  if (answer.status === 'granted' || answer.provisional) return 'granted';
  if (answer.status === 'denied' || !answer.canAskAgain) return 'denied';
  return 'undetermined';
}

export async function readPermission(
  port: Pick<NotificationsPort, 'getPermissionsAsync'>,
): Promise<PermissionState> {
  try {
    return permissionOf(await port.getPermissionsAsync());
  } catch {
    logger.warn('[push] could not read the notification permission');
    return 'undetermined';
  }
}

/** Shows the OS prompt (once per install on iOS). Call it only from a person's tap (KP11). */
export async function askPermission(
  port: Pick<NotificationsPort, 'requestPermissionsAsync' | 'getPermissionsAsync'>,
): Promise<PermissionState> {
  try {
    return permissionOf(await port.requestPermissionsAsync(PERMISSION_REQUEST));
  } catch {
    logger.warn('[push] the notification permission request failed');
    return readPermission(port);
  }
}
