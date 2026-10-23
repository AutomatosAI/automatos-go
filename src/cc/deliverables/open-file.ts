// A PDF, DOCX or XLSX in the system viewer (D-DELIVERABLES, D25): the file is downloaded with the
// client's bearer and X-Workspace-ID (file-source.ts authenticatedRequest) into one folder under the
// cache with expo-file-system, then shown by the viewer module the foundation installed
// (react-native-file-viewer-turbo: QuickLook on iOS, the default app on Android;
// docs/native-modules.md). The copy is deleted when the viewer closes, and the folder is emptied
// before every download, so a copy the viewer never reported closing goes on the next open. A
// download that fails is an ApiError of the taxonomy's kind (its status, when the server sent one);
// a viewer that cannot show the file is a ViewerError. Nothing here is retried.

import { Directory, File, Paths } from 'expo-file-system';
import { open } from 'react-native-file-viewer-turbo';

import { ApiError, errorFromResponse, isApiError } from '../../api/errors';
import { logger } from '../../lib/logger';
import type { AuthenticatedRequest } from './file-source';

/** The one folder under the cache the viewer's copies are saved in. */
export const VIEWER_FOLDER = 'deliverable-viewer';
/** A download that has not finished by then is given up (a large file on a slow line). */
export const DOWNLOAD_TIMEOUT_MS = 120_000;
/** expo-file-system's 'response has status 404' (iOS) or 'response has status: 404' (Android). */
const HTTP_STATUS = /response has status:?\s*(\d{3})/;

/** The viewer could not show the downloaded file (no app for it, or the module refused). */
export class ViewerError extends Error {
  constructor(cause: unknown) {
    super('The system viewer could not show the file', { cause });
    this.name = 'ViewerError';
  }
}

/** A failed download as the taxonomy's error: the server's status when it answered, else the network. */
export function downloadError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  const message = error instanceof Error ? error.message : String(error);
  const status = HTTP_STATUS.exec(message)?.[1];
  return status ? errorFromResponse(Number(status), '') : new ApiError('network', { cause: error });
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

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/** The file, downloaded with the request's headers into the emptied viewer folder. */
export async function downloadForViewer(
  request: AuthenticatedRequest,
  fileName: string,
): Promise<File> {
  clearViewerFiles();
  const folder = viewerFolder();
  try {
    folder.create({ intermediates: true, idempotent: true });
    const target = new File(folder, fileName);
    const download = File.downloadFileAsync(request.url, target, {
      headers: { ...request.headers },
      idempotent: true,
    });
    await withDeadline(download, DOWNLOAD_TIMEOUT_MS);
    return target; // the destination was named, so the download is at its uri
  } catch (error) {
    throw downloadError(error);
  }
}

export type ViewerFile = {
  readonly request: AuthenticatedRequest;
  /** The copy's name, with the format's extension (file-source.ts viewerFileName). */
  readonly fileName: string;
  /** What the viewer's title bar shows. */
  readonly title: string;
};

/** Downloads the file, then shows it; the copy is deleted once the viewer closes. */
export async function openInSystemViewer(file: ViewerFile): Promise<void> {
  const copy = await downloadForViewer(file.request, file.fileName);
  try {
    await open(copy.uri, { displayName: file.title, onDismiss: () => removeQuietly(copy) });
  } catch (error) {
    removeQuietly(copy);
    throw new ViewerError(error);
  }
}
