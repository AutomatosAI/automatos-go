// A theme's font and mascot files on the phone (D-NO-CODE, docs/theme-host/mobile.md): only a URL
// file-url.ts allows is downloaded, from the configured API server, through the one transfer
// module (src/api/transfer.ts: the client's own request, bearer and X-Workspace-ID, never a
// redirect followed), into one folder under the cache, at its digest path: a copy already there
// is the same bytes and is never downloaded again (content-addressed). The file is written a part
// at a time under its kind's cap (fonts 400 KB, mascot files 2 MB), to a partial file that moves
// into place only once it is whole: a larger one is cut off where it crosses the cap, deleted and
// refused, and a download that runs past its deadline is stopped, not just left. One download per
// copy at a time (a second ask joins it). Nothing here throws: a failure is logged and the caller
// keeps Studio's faces or the bundled Auto. iOS may empty the cache: a missing copy is fetched
// again on the next read.

import { Directory, File, Paths } from 'expo-file-system';

import type { ApiClient } from '../../api/client';
import { download as transfer } from '../../api/transfer';
import { logger } from '../../lib/logger';
import {
  themeFile,
  themeFileSegments,
  themeFileSource,
  type ThemeFile,
  type ThemeFileKind,
} from './file-url';
import type { ThemePaint } from './types';

/** The one folder under the cache the theme files are kept in. */
export const THEME_FILES_FOLDER = 'theme-files';
/** A download that has not finished by then is stopped. */
export const THEME_FILE_TIMEOUT_MS = 60_000;

/** The copy's place: <cache>/theme-files/<digest>/<path>. */
export function themeFileCopy(file: ThemeFile): File {
  return new File(Paths.cache, THEME_FILES_FOLDER, ...themeFileSegments(file));
}

/** The copy of an allowed theme URL when it is on the phone, else null (US-017b's Mascot). */
export function localThemeFile(url: string | null | undefined, kind: ThemeFileKind): File | null {
  const file = themeFile(url, kind);
  if (!file) return null;
  try {
    const copy = themeFileCopy(file);
    return copy.exists ? copy : null;
  } catch (error) {
    logger.warn(`[styles] theme file ${file.path} could not be looked up`, error);
    return null;
  }
}

function removeQuietly(entry: File | Directory): void {
  try {
    if (entry.exists) entry.delete();
  } catch (error) {
    logger.warn('[styles] a theme file copy could not be deleted', error);
  }
}

/** Downloads running, by copy: two asks for one file share one download. */
const downloading = new Map<string, Promise<File | null>>();

/**
 * Deletes every theme file on the phone, a partial left beside a copy too (every way of leaving:
 * src/connect/user-files.ts, which stops the running downloads first). The downloads running are
 * forgotten, so the next read downloads what the painted theme needs again, from the next server.
 */
export function clearThemeFiles(): void {
  downloading.clear();
  removeQuietly(new Directory(Paths.cache, THEME_FILES_FOLDER));
}

async function download(client: ApiClient, file: ThemeFile): Promise<File | null> {
  try {
    const copy = themeFileCopy(file);
    if (copy.exists && copy.size <= file.maxBytes) return copy;
    return await transfer(client, themeFileSource(client.server.apiUrl, file), copy, {
      maxBytes: file.maxBytes,
      timeoutMs: THEME_FILE_TIMEOUT_MS,
    });
  } catch (error) {
    logger.warn(`[styles] theme file ${file.path} could not be downloaded`, error);
    return null;
  }
}

/** The file's copy on the phone, downloaded when it is not there yet; null when refused or failed. */
export function cacheThemeFile(client: ApiClient, file: ThemeFile): Promise<File | null> {
  const key = `${file.digest}/${file.path}`;
  const running = downloading.get(key);
  if (running) return running;
  const started: Promise<File | null> = download(client, file).finally(() => {
    // after a clear the key may already belong to a newer download
    if (downloading.get(key) === started) downloading.delete(key);
  });
  downloading.set(key, started);
  return started;
}

/** The painting's files of one kind, as allowed theme files (never a URL the allowlist refuses). */
export function paintFiles(paint: ThemePaint, kind: ThemeFileKind): readonly ThemeFile[] {
  const urls =
    kind === 'font'
      ? Object.values(paint.fonts ?? {})
      : (paint.mascotFiles?.states ?? []).flatMap((state) => [state.clip, state.still]);
  return urls.flatMap((url) => {
    const file = themeFile(url, kind);
    return file ? [file] : [];
  });
}

/** Every file of one kind on the phone, one download at a time; true when all are there. */
export async function cachePaintFiles(
  client: ApiClient,
  paint: ThemePaint,
  kind: ThemeFileKind,
): Promise<boolean> {
  let all = true;
  for (const file of paintFiles(paint, kind)) {
    // one at a time: a theme lists at most three fonts and a few dozen small mascot files
    all = (await cacheThemeFile(client, file)) !== null && all;
  }
  return all;
}
