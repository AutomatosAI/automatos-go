// The one place a fetched body is written to a file (docs/app-standard.md rule 13.2): a theme's
// fonts and mascot files, a Deliverable's file for the system viewer. The request is the client's
// file() (transfer-request.ts): its transport and request policy, its own server, its bearer and
// workspace, never the file system's own downloader, which follows a redirect by itself with the
// headers it was given. The body is written as it arrives, a part at a time, through a file
// handle (expo-file-system's File.open() and FileHandle.writeBytes()), under a byte cap, so a file
// is never held whole in memory. It is written to a partial file beside the target and moved into
// place only once the whole body is in; on a failure, an abort or a cap exceeded the partial file
// is deleted and the target is left as it was.
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

/** The whole file is in: it replaces whatever the target held. */
function placeInto(partial: File, target: File): void {
  if (target.exists) target.delete();
  partial.move(target);
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
    try {
      const body = await client.file(url, callOf(options));
      for await (const part of body.parts(options.maxBytes ?? DOWNLOAD_MAX_BYTES)) {
        handle.writeBytes(part);
      }
    } finally {
      handle.close();
    }
    placeInto(partial, target);
    return target;
  } catch (error) {
    removeQuietly(partial);
    throw error;
  }
}
