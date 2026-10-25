// The installed themes the phone may paint (D58, D-CAPABILITIES, PRD-261 M-04): listed under
// Studio in the picker as '<name> · <version>', sorted by name. Pure over the ThemeReader (api.ts).
// Only when the discovery document carries mobile_theme (automatos-ai #1295); then each install
// that is not withdrawn (revoked null or 'warn') and is not Play's or HUD's web theme (those are
// the picker's Play and HUD already, follow.ts) is asked for its phone painting, at most
// MOBILE_THEME_FETCH_CONCURRENCY at a time. An install is offered when its answer carries a mobile
// block the phone can paint (paint.ts); a null block also covers an opt-in still required, a
// theme without a phone look and a withdrawn one. A 404 skips that install; any other failure
// fails the read, so a passing network fault never reads as every theme gone.

import { canMobileTheme, type GateInput } from '../../api/capabilities';
import { logger } from '../../lib/logger';
import type { PickerTheme } from '../registry/picker';
import type { ThemeReader } from './api';
import { builtInStyleOf } from './follow';
import { themePaint } from './paint';
import { REVOKE_WARN, type InstallRow, type MobileTheme } from './schemas';
import type { ThemePaint } from './types';

export const MOBILE_THEME_FETCH_CONCURRENCY = 4;
/** The most installs asked for a painting on one read (a bound on what one answer can cost). */
export const MAX_THEME_INSTALLS = 100;

/** An install the phone may paint: its picker row, its answer and its painting. */
export type OfferedTheme = PickerTheme & {
  readonly themeId: string;
  readonly answer: MobileTheme;
  readonly paint: ThemePaint;
};

/** Not withdrawn and not a built-in style: worth asking for a phone painting. */
export function mayOffer(row: InstallRow): boolean {
  const live = row.revoked === null || row.revoked.level === REVOKE_WARN;
  return live && builtInStyleOf(row.themeId) === null;
}

/** work(item) for every item, at most `limit` at a time, results in the items' order. */
export async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<readonly R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index]);
    }
  };
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, worker);
  await Promise.all(workers);
  return Object.freeze(results);
}

function offered(row: InstallRow, answer: MobileTheme | null): OfferedTheme | null {
  if (answer === null || answer.mobile === null) return null;
  if (answer.installId !== row.installId) {
    logger.warn(`[styles] theme ${row.installId}: the answer names another install; skipped`);
    return null;
  }
  const paint = themePaint(answer);
  if (!paint) return null;
  return Object.freeze({
    installId: row.installId,
    themeId: row.themeId,
    name: row.name ?? row.themeId,
    version: row.version,
    answer,
    paint,
  });
}

function byName(a: OfferedTheme, b: OfferedTheme): number {
  return a.name.localeCompare(b.name) || a.installId.localeCompare(b.installId);
}

/** The installs the phone may paint now, sorted by name; none without mobile_theme. */
export async function offeredThemes(
  reader: ThemeReader,
  discovery: GateInput,
): Promise<readonly OfferedTheme[]> {
  if (!canMobileTheme(discovery)) return Object.freeze([]);
  const live = (await reader.installed()).filter(mayOffer);
  if (live.length > MAX_THEME_INSTALLS) {
    logger.warn(`[styles] ${live.length} installs; only the first ${MAX_THEME_INSTALLS} are asked`);
  }
  const candidates = live.slice(0, MAX_THEME_INSTALLS);
  const answers = await mapLimited(candidates, MOBILE_THEME_FETCH_CONCURRENCY, (row) =>
    reader.mobile(row.installId),
  );
  const themes = candidates.flatMap((row, index) => {
    const theme = offered(row, answers[index]);
    return theme ? [theme] : [];
  });
  return Object.freeze([...themes].sort(byName));
}

/** The painting of an offered install, or null when it is not offered. */
export function offeredPaint(
  installId: string | null,
  themes: readonly OfferedTheme[],
): ThemePaint | null {
  if (installId === null) return null;
  return themes.find((theme) => theme.installId === installId)?.paint ?? null;
}
