// A file's request (docs/app-standard.md rules 13.2 and 13.2c): the client's file(), which
// transfer.ts writes to a file. It goes through the client's own transport and request policy
// (redirect 'manual', credentials 'omit'), to the client's own server only, with the client's
// bearer, workspace and language, under one deadline that runs until the whole body is in. Its
// answer is checked as every answer is (a 401 signs out, a refusal is its kind).
//
// A redirect is never followed, with one exception the caller names: a route that answers with a
// redirect to storage (GET /api/documents/generated/{filename}: a presigned address). Then the one
// redirect is followed, and only to an https address with a host and nothing before it, never
// into a private network from a public server (private-host.ts): the second request carries no
// header at all, so no bearer, no workspace and no cookie goes with it, and what it answers is
// checked without signing anyone out: any refusal from storage is 'server' with its status. A
// second redirect, an http address, a private host or a redirect on a request not so named is
// the redirect error every call gives.

import { ERROR_BODY_MAX_BYTES, STORAGE_REDIRECT_MAX_CHARS } from './config';
import { callFailure, startDeadline, type Deadline } from './deadline';
import { ApiError, isRedirectStatus } from './errors';
import { hostOfAddress, storageHostAllowed } from './private-host';
import { BodyTooLargeError } from './body';
import type { Server } from './server';
import type { FileResponse, Transport, TransportResponse } from './transport-types';
import { withoutTrailingSlash } from './url';

const LOCATION_HEADER = 'location';
const GET = 'GET';
/** Whitespace, a control character or a backslash: nothing a real address holds. */
const UNSAFE = /[\s\u0000-\u001f\u007f\\]/;
/** https, then a host (no user name or password before it), then a path, a query or the end. */
const STORAGE_ADDRESS = /^https:\/\/[^/?#@]+(?:[/?#]|$)/i;

export type FileCallOptions = {
  readonly signal?: AbortSignal;
  /** The whole fetch, status and body, gives up after this long; the client's own when not given. */
  readonly timeoutMs?: number;
  /**
   * The route answers with a redirect to storage (a presigned address): that one redirect is
   * followed, to https only, with nothing of the session on it. Never set for any other route.
   */
  readonly redirectsToStorage?: boolean;
};

/** A file's answer: its headers and its body's bytes as they arrive, under the caller's cap. */
export type FileBody = {
  readonly header: (name: string) => string | null;
  /** Past `maxBytes` an invalid_response, read no further; a deadline run out, the network. */
  readonly parts: (maxBytes: number) => AsyncIterable<Uint8Array>;
};

/** What the client lends a file's request: its server, transport, credentials and checks. */
export type FilePort = {
  readonly server: Server;
  readonly transport: Transport;
  readonly timeoutMs: number;
  /** The client's headers for its own server (bearer, workspace, language) and the token in them. */
  readonly signed: () => Promise<{
    readonly headers: Readonly<Record<string, string>>;
    readonly token: string | null;
  }>;
  /** The client's check of its own server's answer: OK through, anything else its ApiError. */
  readonly checked: <R extends TransportResponse>(response: R, token: string | null) => Promise<R>;
};

/** `url` when it is on the client's own server; anything else is refused before it is asked. */
export function assertOnServer(apiUrl: string, url: string): void {
  const origin = withoutTrailingSlash(apiUrl).toLowerCase();
  const onServer =
    url.slice(0, origin.length).toLowerCase() === origin && url.charAt(origin.length) === '/';
  if (!onServer || UNSAFE.test(url)) {
    throw new TypeError("a file is fetched only from the client's own server");
  }
}

/**
 * Where a storage redirect may lead: an https address with a host, and, when the app's own server
 * is not on a private network, a host that is not on one either (private-host.ts); anything else
 * is null. A server on a home or office network may point to storage on that same network.
 */
export function storageAddress(location: string | null, apiUrl: string): string | null {
  if (!location || location.length > STORAGE_REDIRECT_MAX_CHARS || UNSAFE.test(location)) {
    return null;
  }
  if (!STORAGE_ADDRESS.test(location)) return null;
  const host = hostOfAddress(location);
  return host !== null && storageHostAllowed(host, apiUrl) ? location : null;
}

/** A body not wanted (a redirect's): read no further than an error body's cap, then let go. */
async function discard(response: TransportResponse): Promise<void> {
  await response.bytes(ERROR_BODY_MAX_BYTES).catch(() => undefined);
}

/**
 * Storage's answer: OK through; anything else is 'server' with its status, whatever it is. A 401
 * or 403 from storage is a link run out, not the person's session or role: it signs no one out
 * and never says "sign in again". Where a redirect from storage pointed is never kept: it may be
 * another presigned address.
 */
async function storageChecked(response: FileResponse): Promise<FileResponse> {
  if (response.status >= 200 && response.status < 300) return response;
  await discard(response);
  throw new ApiError('server', { status: response.status });
}

async function answered(
  port: FilePort,
  first: FileResponse,
  token: string | null,
  options: { readonly deadline: Deadline; readonly call: FileCallOptions },
): Promise<FileResponse> {
  const marked = options.call.redirectsToStorage === true && isRedirectStatus(first.status);
  const target = marked ? storageAddress(first.header(LOCATION_HEADER), port.server.apiUrl) : null;
  if (target === null) return port.checked(first, token);
  await discard(first);
  const signal = options.deadline.signal;
  const second = await port.transport.file({ url: target, method: GET, headers: {}, signal });
  return storageChecked(second);
}

async function* partsUnder(
  parts: AsyncIterable<Uint8Array>,
  deadline: Deadline,
  call: FileCallOptions,
  timeoutMs: number,
): AsyncGenerator<Uint8Array> {
  try {
    yield* parts;
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      throw new ApiError('invalid_response', { cause: error });
    throw callFailure(error, deadline, call.signal, timeoutMs);
  } finally {
    deadline.dispose();
  }
}

/** The client's file(): see the top of this file. */
export async function openFile(
  port: FilePort,
  url: string,
  call: FileCallOptions = {},
): Promise<FileBody> {
  assertOnServer(port.server.apiUrl, url);
  const { headers, token } = await port.signed();
  const timeoutMs = call.timeoutMs ?? port.timeoutMs;
  const deadline = startDeadline(timeoutMs, call.signal);
  try {
    const first = await port.transport.file({ url, method: GET, headers, signal: deadline.signal });
    const answer = await answered(port, first, token, { deadline, call });
    return Object.freeze({
      header: (name: string) => answer.header(name),
      parts: (maxBytes: number) => partsUnder(answer.parts(maxBytes), deadline, call, timeoutMs),
    });
  } catch (error) {
    deadline.dispose();
    throw callFailure(error, deadline, call.signal, timeoutMs);
  }
}
