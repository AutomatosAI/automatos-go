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
// Every download listens to one abort that leaving fires (stopDownloads: sign-out, a server
// switch, src/connect/user-files.ts): a download stopped so places nothing, even when its body
// ends after the person has gone, because the abort is checked after the last write and before
// the move, in the same turn as the move.
//
// Nothing here sends a file. The one feature that does, a chat attachment, posts multipart through
// the client, and Expo's fetch reads every request body whole before it sends it (a stream too), so
// an upload that does not hold the file in memory could only be the file system's own uploader,
// which follows a redirect with its headers: not built (rule 13.2c).

import { File } from 'expo-file-system';

import { logger } from '../lib/logger';
import type { ApiClient } from './client';
import { abortError, isAbortError } from './errors';
import { DOWNLOAD_MAX_BYTES } from './config';
import type { FileCallOptions } from './transfer-request';

export type DownloadOptions = Omit<FileCallOptions, 'timeoutMs'> & {
  /**
   * The whole download gives up after this long: the status and every part of the body, to the
   * last byte. Required: the client's own 30 s is a request's, and a file can take longer.
   */
  readonly timeoutMs: number;
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

/**
 * An empty partial file, its folder made first, and a handle to write it with. A partial a crash
 * left for this target is removed first (the person leaving removes the rest: user-files.ts).
 */
function openPartial(partial: File) {
  removeQuietly(partial);
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

/** One signal for a download: the caller's, if any, and leaving's; release drops the listeners. */
function joinedSignal(signals: readonly (AbortSignal | undefined)[]) {
  const joined = new AbortController();
  const stop = () => joined.abort();
  const live = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  live.forEach((signal) => {
    if (signal.aborted) stop();
    else signal.addEventListener('abort', stop);
  });
  const release = () => live.forEach((signal) => signal.removeEventListener('abort', stop));
  return { signal: joined.signal, release };
}

function stopIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

/** The body written into the partial file, a part at a time; the handle closed however it ends. */
async function writeInto(
  client: Pick<ApiClient, 'file'>,
  url: string,
  partial: File,
  options: DownloadOptions & { readonly signal: AbortSignal },
): Promise<void> {
  const handle = openPartial(partial);
  let failed = false;
  try {
    const body = await client.file(url, callOf(options));
    for await (const part of body.parts(options.maxBytes ?? DOWNLOAD_MAX_BYTES)) {
      stopIfAborted(options.signal);
      handle.writeBytes(part);
    }
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    closeHandle(handle, failed);
  }
}

async function fetchInto(
  client: Pick<ApiClient, 'file'>,
  url: string,
  target: File,
  options: DownloadOptions & { readonly session: AbortSignal },
): Promise<File> {
  const stop = joinedSignal([options.signal, options.session]);
  const partial = partialOf(target);
  try {
    stopIfAborted(stop.signal); // stopped while it waited its turn: nothing is created
    await writeInto(client, url, partial, { ...options, signal: stop.signal });
    stopIfAborted(stop.signal); // stopped while the last part came: nothing is placed
    placeInto(partial, target);
    return target;
  } catch (error) {
    removeQuietly(partial);
    // a file-system failure after the stop (its folder deleted under it) is the stop
    throw stop.signal.aborted && !isAbortError(error) ? abortError() : error;
  } finally {
    stop.release();
  }
}

type Running = {
  readonly url: string;
  readonly done: Promise<File>;
  /** The leaving it listens to: once fired, the run is ending and no later ask may join it. */
  readonly session: AbortSignal;
};

/** Downloads running, by target: a target is only ever written by one of them at a time. */
const running = new Map<string, Running>();

/** What every download running now listens to; stopDownloads fires it and starts a new one. */
let leaving = new AbortController();

/**
 * Stops every download running now (the person is leaving: sign-out, a server switch). None of
 * them places a file afterwards, whenever its body ends; each rejects with an AbortError. A later
 * ask, for the same target too, downloads afresh, once the stopped run for that target has
 * settled and removed its partial file: the runs stay in `running` until they settle, so a new
 * run never shares a partial file with one still unwinding.
 */
export function stopDownloads(): void {
  const left = leaving;
  leaving = new AbortController();
  left.abort();
}

/**
 * `url` on the client's server written to `target`, through a partial file; the target once it is
 * whole. Throws the client's ApiError (a refusal, the network, a body over its cap as
 * invalid_response), the caller's AbortError, or the file system's own error; the partial file is
 * gone whichever it is. Two asks for one target and one address share one download (the first
 * ask's options hold); an ask for the same target from another address, or after a stop, waits for
 * the running one to settle before it starts, so two writers never share a partial file.
 * `options.timeoutMs` covers the whole download, the last byte of the body included.
 */
export function download(
  client: Pick<ApiClient, 'file'>,
  url: string,
  target: File,
  options: DownloadOptions,
): Promise<File> {
  const key = target.uri;
  const current = running.get(key);
  if (current?.url === url && !current.session.aborted) return current.done;
  const earlier = current?.done.then(
    () => undefined,
    () => undefined,
  );
  const session = leaving.signal;
  const done: Promise<File> = (async () => {
    await earlier;
    return fetchInto(client, url, target, { ...options, session });
  })().finally(() => {
    if (running.get(key)?.done === done) running.delete(key);
  });
  running.set(key, { url, done, session });
  return done;
}
