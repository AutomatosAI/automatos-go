// The real transport: expo/fetch, the fetch with a streaming response body on React Native (the
// built-in one has none: digests/chat-api.md, MOBILE GAPS). This is the ONLY file that imports
// expo/fetch (D-ONE-CLIENT); tests inject a fake Transport and never import this module. binary
// reads a whole body as bytes under the caller's cap (body.ts readBytes) and keeps the headers:
// Auto's server voice, one MP3.

import { fetch as expoFetch } from 'expo/fetch';

import { decodeChunks, readBytes } from './body';
import type {
  BinaryResponse,
  StreamingResponse,
  Transport,
  TransportRequest,
} from './transport-types';

function open(request: TransportRequest) {
  return expoFetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
  });
}

async function send(request: TransportRequest): Promise<StreamingResponse> {
  const response = await open(request);
  return {
    status: response.status,
    text: () => response.text(),
    chunks: () => decodeChunks(response.body),
  };
}

/** The body as bytes (Auto's server voice: one MP3), with the response's headers. */
async function sendBinary(request: TransportRequest): Promise<BinaryResponse> {
  const response = await open(request);
  return {
    status: response.status,
    text: () => response.text(),
    bytes: (maxBytes) => readBytes(response.body, maxBytes, response.headers.get('content-length')),
    header: (name) => response.headers.get(name),
  };
}

export const expoTransport: Transport = Object.freeze({
  request: send,
  stream: send,
  binary: sendBinary,
});
