// A theme's font and mascot files on the phone (D-NO-CODE, docs/theme-host/mobile.md): only a URL
// file-url.ts allows is downloaded, from the configured API server with the client's own bearer and
// X-Workspace-ID (client.authHeaders(), the A3 kit's idiom in src/cc/deliverables/open-file.ts),
// into one folder under the cache, at its digest path: a copy already there is the same bytes and
// is never downloaded again (content-addressed). A download lands in a partial folder first and
// moves into place only when it is no larger than its kind's cap (fonts 400 KB, mascot files 2 MB);
// a larger one is deleted and refused. One download per copy at a time (a second ask joins it).
// Nothing here throws: a failure is logged and the caller keeps Studio's faces or the bundled Auto.
// iOS may empty the cache: a missing copy is fetched again on the next read.
//
// Known limits (security review, 24 Oct): expo-file-system's download has no byte cap or cancel,
// so the size is checked once the file has arrived (the deadline stops waiting, not the transfer),
// and URLSession follows a redirect with the request's headers. Both need the configured server
// itself to misbehave; the file is still refused above its cap, and only allowlisted paths on that
// server are ever asked for.

import { Directory, File, Paths } from 'expo-file-system';

import type { ApiClient } from '../../api/client';
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
const PARTIAL_FOLDER = '.partial';
/** A download that has not finished by then is given up. */
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

function removeQuietly(entry: File): void {
  try {
    if (entry.exists) entry.delete();
  } catch (error) {
    logger.warn('[styles] a theme file copy could not be deleted', error);
  }
}

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

function partialCopy(file: ThemeFile): File {
  const folder = new Directory(Paths.cache, THEME_FILES_FOLDER, PARTIAL_FOLDER);
  folder.create({ intermediates: true, idempotent: true });
  return new File(folder, `${file.digest}-${file.path.split('/').join('_')}`);
}

/** Moves the finished download into place, or refuses it when it is over the kind's cap. */
function settle(partial: File, file: ThemeFile, copy: File): File | null {
  if (partial.size > file.maxBytes) {
    logger.warn(`[styles] theme file ${file.path} is ${partial.size} bytes, over ${file.maxBytes}`);
    removeQuietly(partial);
    return null;
  }
  copy.parentDirectory.create({ intermediates: true, idempotent: true });
  removeQuietly(copy);
  partial.move(copy);
  return copy;
}

async function download(client: ApiClient, file: ThemeFile): Promise<File | null> {
  let partial: File | null = null;
  try {
    const copy = themeFileCopy(file);
    if (copy.exists && copy.size <= file.maxBytes) return copy;
    partial = partialCopy(file);
    const fetched = File.downloadFileAsync(themeFileSource(client.server.apiUrl, file), partial, {
      headers: { ...(await client.authHeaders()) },
      idempotent: true,
    });
    await withDeadline(fetched, THEME_FILE_TIMEOUT_MS);
    return settle(partial, file, copy);
  } catch (error) {
    logger.warn(`[styles] theme file ${file.path} could not be downloaded`, error);
    if (partial) removeQuietly(partial);
    return null;
  }
}

/** Downloads running, by copy: two asks for one file share one download. */
const downloading = new Map<string, Promise<File | null>>();

/** The file's copy on the phone, downloaded when it is not there yet; null when refused or failed. */
export function cacheThemeFile(client: ApiClient, file: ThemeFile): Promise<File | null> {
  const key = `${file.digest}/${file.path}`;
  const running = downloading.get(key);
  if (running) return running;
  const started = download(client, file).finally(() => downloading.delete(key));
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
