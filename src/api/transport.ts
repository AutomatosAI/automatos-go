// The real transport: expo/fetch, the fetch with a streaming response body on React Native (the
// built-in one has none: digests/chat-api.md, MOBILE GAPS). This is the ONLY file that imports
// expo/fetch (D-ONE-CLIENT); tests inject a fake Transport and never import this module. Every
// whole body is read as bytes under the caller's cap (body.ts readBytes), with a Content-Length
// over the cap refused before a byte is read: nothing here reads a body whole without one. binary
// keeps the headers too: Auto's server voice, one MP3. file gives the body as bytes as they arrive,
// under the caller's cap, for transfer.ts to write to a file without holding it in memory.

import { fetch as expoFetch } from 'expo/fetch';

import { decodeChunks, readBytes, readParts } from './body';
import type {
  BinaryResponse,
  FileResponse,
  StreamingResponse,
  Transport,
  TransportRequest,
} from './transport-types';

const CONTENT_LENGTH = 'content-length';

/**
 * What every request is sent with, whatever the client asked for.
 *   redirect 'manual': a redirect is never followed. The answer that asked for one comes back as
 * it is (its 3xx status, its Location), so the bearer never goes to an address the app was not
 * given, and pairing can read where a server says it has moved (src/connect/https-twin.ts).
 *   credentials 'omit': a request carries no cookie and keeps none. The app signs every request
 * with its bearer; a cookie would be a second, unseen credential.
 */
const REQUEST_POLICY = Object.freeze({ redirect: 'manual', credentials: 'omit' } as const);

function open(request: TransportRequest) {
  return expoFetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
    ...REQUEST_POLICY,
  });
}

async function send(request: TransportRequest): Promise<StreamingResponse> {
  const response = await open(request);
  return {
    status: response.status,
    bytes: (maxBytes) => readBytes(response.body, maxBytes, response.headers.get(CONTENT_LENGTH)),
    header: (name) => response.headers.get(name),
    chunks: () => decodeChunks(response.body),
  };
}

/** The body as bytes (Auto's server voice: one MP3), with the response's headers. */
async function sendBinary(request: TransportRequest): Promise<BinaryResponse> {
  const response = await open(request);
  return {
    status: response.status,
    bytes: (maxBytes) => readBytes(response.body, maxBytes, response.headers.get(CONTENT_LENGTH)),
    header: (name) => response.headers.get(name),
  };
}

/** A file's body as bytes as they arrive, under the caller's cap (transfer.ts). */
async function sendFile(request: TransportRequest): Promise<FileResponse> {
  const response = await open(request);
  const length = () => response.headers.get(CONTENT_LENGTH);
  return {
    status: response.status,
    bytes: (maxBytes) => readBytes(response.body, maxBytes, length()),
    header: (name) => response.headers.get(name),
    parts: (maxBytes) => readParts(response.body, maxBytes, length()),
  };
}

export const expoTransport: Transport = Object.freeze({
  request: send,
  stream: send,
  binary: sendBinary,
  file: sendFile,
});
