// The notification platform, set up before any permission request or token call (PRD-001 §4.8,
// KP7, KP20): on Android every channel first (Android 13 shows the permission prompt only once a
// channel exists), then every category on both platforms. Both calls are upserts, so a second run
// leaves the same state: setup is safe on every mount. Each call runs on its own, so one failure
// never stops the rest; failures are logged as counts per kind and nothing throws into the app.

import { logger } from '../../lib/logger';
import { PUSH_CATEGORIES } from './categories';
import { PUSH_CHANNELS } from './channels';
import type { NotificationsPort } from './port';

export type SetupOutcome = Readonly<{
  ok: boolean;
  failedChannels: number;
  failedCategories: number;
}>;

const ANDROID = 'android';

/** How many of the calls failed; a call that throws before its promise counts as failed. */
async function failuresOf(calls: readonly (() => Promise<unknown>)[]): Promise<number> {
  const settled = await Promise.allSettled(calls.map((call) => Promise.resolve().then(call)));
  return settled.filter((result) => result.status === 'rejected').length;
}

function registerChannels(port: NotificationsPort): Promise<number> {
  return failuresOf(
    PUSH_CHANNELS.map(
      (channel) => () =>
        port.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          importance: port.androidImportance[channel.importance],
          lockscreenVisibility: port.androidVisibility[channel.lockscreenVisibility],
          showBadge: channel.showBadge,
        }),
    ),
  );
}

function registerCategories(port: NotificationsPort): Promise<number> {
  return failuresOf(
    PUSH_CATEGORIES.map(
      (category) => () =>
        port.setNotificationCategoryAsync(category.identifier, category.actions, category.options),
    ),
  );
}

/** Registers what the system shows; `os` is Platform.OS. Never rejects. */
export async function setupNotificationPlatform(
  port: NotificationsPort,
  os: string,
): Promise<SetupOutcome> {
  const failedChannels = os === ANDROID ? await registerChannels(port) : 0;
  const failedCategories = await registerCategories(port);
  const ok = failedChannels === 0 && failedCategories === 0;
  if (!ok) {
    logger.warn('[push] platform setup failed', {
      channels: failedChannels,
      categories: failedCategories,
    });
  }
  return Object.freeze({ ok, failedChannels, failedCategories });
}
