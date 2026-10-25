// The theme reads over the one client (D-ONE-CLIENT, STYLE_ROUTES): what Studio shows this member,
// the workspace's installs and one install's phone painting, each parsed with its schema
// (schemas.ts). A server without theme routes answers /active with 404: the phone reads that as
// Studio (an older self-hosted install). A 404 for one install's painting is null: that install
// is skipped (unknown, foreign, or gone since the list was read). Every other failure is the
// taxonomy's ApiError and the caller keeps what it had. A paired phone is a theme member since
// automatos-ai #1264, so its answers are real.

import type { ApiClient } from '../../api/client';
import { isApiError } from '../../api/errors';
import { logger } from '../../lib/logger';
import { STYLE_ROUTES } from '../routes';
import {
  ActiveSchema,
  InstalledSchema,
  MobileThemeSchema,
  NO_ACTIVE_THEME,
  installRows,
  type Active,
  type InstallRow,
  type MobileTheme,
} from './schemas';

const NOT_FOUND = 404;

export type ThemeReader = {
  readonly active: () => Promise<Active>;
  readonly installed: () => Promise<readonly InstallRow[]>;
  /** null when the server answers 404 for that install. */
  readonly mobile: (installId: string) => Promise<MobileTheme | null>;
};

function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === NOT_FOUND;
}

async function orWhenNotFound<T, F>(read: () => Promise<T>, fallback: F): Promise<T | F> {
  try {
    return await read();
  } catch (error) {
    if (isNotFound(error)) return fallback;
    throw error;
  }
}

export function themeReader(client: ApiClient, signal?: AbortSignal): ThemeReader {
  const { themes } = STYLE_ROUTES;
  return Object.freeze({
    active: () =>
      orWhenNotFound(
        () => client.request(themes.active, { schema: ActiveSchema, signal }),
        NO_ACTIVE_THEME,
      ),
    installed: async () => {
      const answer = await client.request(themes.installed, { schema: InstalledSchema, signal });
      const { rows, dropped } = installRows(answer.installs);
      if (dropped > 0) logger.warn(`[styles] ${dropped} install row(s) could not be read; skipped`);
      return rows;
    },
    mobile: (installId: string) =>
      orWhenNotFound(
        () =>
          client.request(themes.mobile, {
            params: { install_id: installId },
            schema: MobileThemeSchema,
            signal,
          }),
        null,
      ),
  });
}
