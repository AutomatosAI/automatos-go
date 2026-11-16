// The one place a fetched body is written to a file (docs/app-standard.md rule 13.2): a theme's
// fonts and mascot files, a Deliverable's file for the system viewer. The request is the client's
// file() (transfer-request.ts): its transport and request policy, its own server, its bearer and
// workspace, never the file system's own downloader, which follows a redirect by itself with the
// headers it was given. The body is written as it arrives, a part at a time, through a file
// handle (expo-file-system's File.open() and FileHandle.writeBytes()), under a byte cap, so a file
// is never held whole in memory. It is written to a partial file beside the target and moved into
// place only once the whole body is in; on a failure, an abort or a cap exceeded the partial file
// is deleted and the target is left as it was. A copy already at the target is put aside while
// the new one moves in, and put back if the move fails: it is deleted only once the new one is in.
//
// Nothing here sends a file. The one feature that does, a chat attachment, posts multipart through
// the client, and Expo's fetch reads every request body whole before it sends it (a stream too), so
// an upload that does not hold the file in memory could only be the file system's own uploader,
// which follows a redirect with its headers: not built (rule 13.2c).

import { File } from 'expo-file-system';

import { logger } from '../lib/logger';
import type { ApiClient } from './client';
import { DOWNLOAD_MAX_BYTES } from './config';
import type { FileCallOptions } from './transfer-request';

export type DownloadOptions = FileCallOptions & {
  /** The file is refused past this many bytes, read no further (DOWNLOAD_MAX_BYTES if not given). */
  readonly maxBytes?: number;
};

/** The partial file's name is the target's with this after it. */
export const PARTIAL_SUFFIX = '.partial';
/** Where a copy already at the target waits while the new one moves in. */
export const ASIDE_SUFFIX = '.old';

/** Where a download is written until it is whole: beside the target, under its name. */
export function partialOf(target: File): File {
  return new File(`${target.uri}${PARTIAL_SUFFIX}`);
}

function removeQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch (error) {
    logger.warn('[api] a partial download could not be deleted', error);
  }
}

/** An empty partial file, its folder made first, and a handle to write it with. */
function openPartial(partial: File) {
  partial.create({ intermediates: true, overwrite: true });
  return partial.open();
}

type Handle = ReturnType<typeof openPartial>;

/**
 * Closes the partial file's handle. After a failure the first error is the one that counts: a
 * close that fails too is logged, never thrown over it. After a whole body, a failed close is the
 * failure (what was written may not all be there).
 */
function closeHandle(handle: Handle, failed: boolean): void {
  try {
    handle.close();
  } catch (error) {
    if (!failed) throw error;
    logger.warn('[api] a partial download could not be closed', error);
  }
}

/** The copy that was set aside goes back to the target; failing that, it goes (never left over). */
function putBack(aside: File, target: File): void {
  try {
    new File(aside.uri).move(new File(target.uri));
  } catch (error) {
    logger.warn('[api] an earlier copy could not be put back', error);
    removeQuietly(aside);
  }
}

/**
 * The whole file is in: it replaces whatever the target held. The earlier copy is set aside first
 * and deleted only once the new one is in place; if the move fails, it is put back.
 */
function placeInto(partial: File, target: File): void {
  const aside = new File(`${target.uri}${ASIDE_SUFFIX}`);
  removeQuietly(aside); // one an interrupted replace left
  const hadCopy = target.exists;
  if (hadCopy) new File(target.uri).move(aside);
  try {
    partial.move(target);
  } catch (error) {
    if (hadCopy) putBack(aside, target);
    throw error;
  }
  if (hadCopy) removeQuietly(aside);
}

function callOf({ signal, timeoutMs, redirectsToStorage }: DownloadOptions): FileCallOptions {
  return { signal, timeoutMs, redirectsToStorage };
}

/**
 * `url` on the client's server written to `target`, through a partial file; the target once it is
 * whole. Throws the client's ApiError (a refusal, the network, a body over its cap as
 * invalid_response), the caller's AbortError, or the file system's own error; the partial file is
 * gone whichever it is.
 */
export async function download(
  client: Pick<ApiClient, 'file'>,
  url: string,
  target: File,
  options: DownloadOptions = {},
): Promise<File> {
  const partial = partialOf(target);
  try {
    const handle = openPartial(partial);
    let failed = false;
    try {
      const body = await client.file(url, callOf(options));
      for await (const part of body.parts(options.maxBytes ?? DOWNLOAD_MAX_BYTES)) {
        handle.writeBytes(part);
      }
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      closeHandle(handle, failed);
    }
    placeInto(partial, target);
    return target;
  } catch (error) {
    removeQuietly(partial);
    throw error;
  }
}
