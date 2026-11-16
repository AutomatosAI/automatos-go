// A PDF, DOCX or XLSX in the system viewer (D-DELIVERABLES, D25): the file is downloaded through the
// one transfer module (src/api/transfer.ts: the client's own request, bearer and X-Workspace-ID,
// written a part at a time under DOWNLOAD_MAX_BYTES) into one folder under the cache, then shown
// by the viewer module the foundation installed (react-native-file-viewer-turbo: QuickLook on iOS,
// the default app on Android; docs/native-modules.md). A generated document's route may answer
// with a redirect to storage: only that route's download follows it, once, to https, with nothing
// of the session (src/api/transfer-request.ts). The viewer keeps one copy at a time: a new open
// stops the download still running for an earlier one and waits for it to settle (its partial
// file gone) before the folder is emptied, and the earlier open then ends as an abort, which
// shows nothing. The copy is deleted when the viewer closes, and the folder is emptied before
// every download, so a copy the viewer never reported closing goes on the next open. A download that fails is an ApiError of the taxonomy's kind (its status, when
// the server sent one); a viewer that cannot show the file is a ViewerError. Nothing is retried.

import { Directory, File, Paths } from 'expo-file-system';
import { open } from 'react-native-file-viewer-turbo';

import type { ApiClient } from '../../api/client';
import { abortError, ApiError, isAbortError, isApiError } from '../../api/errors';
import { download } from '../../api/transfer';
import { withoutTrailingSlash } from '../../api/url';
import { logger } from '../../lib/logger';
import { CC_ROUTES } from '../routes';

/** The one folder under the cache the viewer's copies are saved in. */
export const VIEWER_FOLDER = 'deliverable-viewer';
/** A download that has not finished by then is stopped (a large file on a slow line). */
export const DOWNLOAD_TIMEOUT_MS = 120_000;

const GENERATED_PATH = CC_ROUTES.deliverables.generatedFile.path;
/** The generated documents' route up to its file name: the one route that redirects to storage. */
const GENERATED_PREFIX = GENERATED_PATH.slice(0, GENERATED_PATH.indexOf('{'));

/** The viewer could not show the downloaded file (no app for it, or the module refused). */
export class ViewerError extends Error {
  constructor(cause: unknown) {
    super('The system viewer could not show the file', { cause });
    this.name = 'ViewerError';
  }
}

/** A failed download as the taxonomy's error: the client's own, else the network. */
export function downloadError(error: unknown): ApiError {
  return isApiError(error) ? error : new ApiError('network', { cause: error });
}

/** The viewer's download running now: how to stop it, and its settling (never a rejection). */
type ViewerDownload = { readonly stop: AbortController; readonly settled: Promise<void> };

let latest: ViewerDownload | null = null;

/** A dot-dot, an escaped dot, slash or backslash, or a backslash: never in a file's own name. */
const NOT_A_NAME = /\.\.|%2e|%2f|%5c|\\/i;
const NAME_END = /[?#]/;

/** The file name in a generated document's path: one segment, nothing that could leave it. */
function isFileName(rest: string): boolean {
  const end = rest.search(NAME_END);
  const name = end < 0 ? rest : rest.slice(0, end);
  return name !== '' && !name.includes('/') && !NOT_A_NAME.test(name);
}

/**
 * Whether `url` is a generated document's route on this server, which may redirect to storage:
 * its path is that route's with a plain file name. A name that could lead out of the route
 * (`..`, an escaped dot, slash or backslash, a backslash, a further segment) is an ordinary
 * download, which follows nothing.
 */
export function redirectsToStorage(apiUrl: string, url: string): boolean {
  const origin = withoutTrailingSlash(apiUrl);
  const onServer = url.slice(0, origin.length).toLowerCase() === origin.toLowerCase();
  const path = url.slice(origin.length);
  return (
    onServer && path.startsWith(GENERATED_PREFIX) && isFileName(path.slice(GENERATED_PREFIX.length))
  );
}

function viewerFolder(): Directory {
  return new Directory(Paths.cache, VIEWER_FOLDER);
}

function removeQuietly(entry: File | Directory): void {
  try {
    if (entry.exists) entry.delete();
  } catch (error) {
    logger.warn('[cc/deliverables] a viewer copy could not be deleted', error);
  }
}

/** Deletes every copy an earlier open left behind. */
export function clearViewerFiles(): void {
  removeQuietly(viewerFolder());
}

/** Where the viewer's file comes from: the client and the file's address on its server. */
export type ViewerSource = {
  readonly client: Pick<ApiClient, 'server' | 'file'>;
  /** The file's link on this server (file-source.ts fileLink, kind 'api'). */
  readonly url: string;
};

async function fetchCopy(
  source: ViewerSource,
  fileName: string,
  after: { readonly earlier: Promise<void> | undefined; readonly stop: AbortController },
): Promise<File> {
  await after.earlier; // the earlier download has stopped and removed its partial file
  if (after.stop.signal.aborted) throw abortError(); // a newer open came while this one waited
  clearViewerFiles();
  return download(source.client, source.url, new File(viewerFolder(), fileName), {
    signal: after.stop.signal,
    timeoutMs: DOWNLOAD_TIMEOUT_MS,
    redirectsToStorage: redirectsToStorage(source.client.server.apiUrl, source.url),
  });
}

/**
 * The file, downloaded through the transfer module into the emptied viewer folder. A download
 * still running for an earlier open is stopped first and waited for; the earlier open then
 * rejects with an AbortError, as one stopped by its caller does. Any other failure is the
 * taxonomy's error.
 */
export async function downloadForViewer(source: ViewerSource, fileName: string): Promise<File> {
  const earlier = latest;
  earlier?.stop.abort();
  const stop = new AbortController();
  const copy = fetchCopy(source, fileName, { earlier: earlier?.settled, stop });
  const settled = copy.then(
    () => undefined,
    () => undefined,
  );
  const mine: ViewerDownload = { stop, settled };
  latest = mine;
  try {
    return await copy;
  } catch (error) {
    throw isAbortError(error) ? error : downloadError(error);
  } finally {
    if (latest === mine) latest = null;
  }
}

export type ViewerFile = ViewerSource & {
  /** The copy's name, with the format's extension (file-source.ts viewerFileName). */
  readonly fileName: string;
  /** What the viewer's title bar shows. */
  readonly title: string;
};

/** Downloads the file, then shows it; the copy is deleted once the viewer closes. */
export async function openInSystemViewer(file: ViewerFile): Promise<void> {
  const copy = await downloadForViewer(file, file.fileName);
  try {
    await open(copy.uri, { displayName: file.title, onDismiss: () => removeQuietly(copy) });
  } catch (error) {
    removeQuietly(copy);
    throw new ViewerError(error);
  }
}
