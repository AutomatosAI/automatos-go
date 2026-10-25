// The app icon's badge (PRD-001 §4.8, KP14, FND-5): the server's needs-you total, the ONE number
// every counter reads (useNeedsYou: never recomputed here, never a second fetch of
// /api/activity/needs-you). Set while the app is open, each time the total changes; 0 when there is
// no total (before the first answer). The server's pushes carry no badge, so the number refreshes
// when the app runs; sign-out's teardown sets it to 0. iOS shows it only with allowBadge, asked
// with the permission (registration/permission.ts).

import { useEffect } from 'react';

import { useNeedsYou } from '../api/needs-you';
import { logger } from '../lib/logger';
import type { NotificationsPort } from './platform/expo';

/** The badge for a total: a whole number above zero as it is, anything else 0. */
export function badgeCount(total: number | null | undefined): number {
  return typeof total === 'number' && Number.isInteger(total) && total > 0 ? total : 0;
}

/** Keeps the icon's badge on the needs-you total while the app is open. */
export function useAppBadge(port: Pick<NotificationsPort, 'setBadgeCountAsync'>): void {
  const count = badgeCount(useNeedsYou().total);
  useEffect(() => {
    Promise.resolve()
      .then(() => port.setBadgeCountAsync(count))
      .catch(() => logger.debug('[push] could not set the badge'));
  }, [port, count]);
}
