// A PDF, DOCX or XLSX in the system viewer (D-DELIVERABLES, D25): the file is downloaded through the
// one transfer module (src/api/transfer.ts: the client's own request, bearer and X-Workspace-ID,
// written a part at a time under DOWNLOAD_MAX_BYTES) into one folder under the cache, then shown
// by the viewer module the foundation installed (react-native-file-viewer-turbo: QuickLook on iOS,
// the default app on Android; docs/native-modules.md). A generated document's route may answer
// with a redirect to storage: only that route's download follows it, once, to https, with nothing
// of the session (src/api/transfer-request.ts). The copy is deleted when the viewer closes, and
// the folder is emptied before every download, so a copy the viewer never reported closing goes
// on the next open. A download that fails is an ApiError of the taxonomy's kind (its status, when
// the server sent one); a viewer that cannot show the file is a ViewerError. Nothing is retried.

import { Directory, File, Paths } from 'expo-file-system';
import { open } from 'react-native-file-viewer-turbo';

import type { ApiClient } from '../../api/client';
import { ApiError, isApiError } from '../../api/errors';
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

/** Whether `url` is a generated document's route on this server, which may redirect to storage. */
export function redirectsToStorage(apiUrl: string, url: string): boolean {
  const origin = withoutTrailingSlash(apiUrl);
  const onServer = url.slice(0, origin.length).toLowerCase() === origin.toLowerCase();
  return onServer && url.slice(origin.length).startsWith(GENERATED_PREFIX);
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

/** The file, downloaded through the transfer module into the emptied viewer folder. */
export async function downloadForViewer(source: ViewerSource, fileName: string): Promise<File> {
  clearViewerFiles();
  const target = new File(viewerFolder(), fileName);
  try {
    return await download(source.client, source.url, target, {
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      redirectsToStorage: redirectsToStorage(source.client.server.apiUrl, source.url),
    });
  } catch (error) {
    throw downloadError(error);
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
