// The real transport: expo/fetch, the fetch with a streaming response body on React Native (the
// built-in one has none: digests/chat-api.md, MOBILE GAPS). This is the ONLY file that imports
// expo/fetch (D-ONE-CLIENT); tests inject a fake Transport and never import this module.

import { fetch as expoFetch } from 'expo/fetch';

import { decodeChunks } from './body';
import type { StreamingResponse, Transport, TransportRequest } from './transport-types';

async function send(request: TransportRequest): Promise<StreamingResponse> {
  const response = await expoFetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
  });
  return {
    status: response.status,
    text: () => response.text(),
    chunks: () => decodeChunks(response.body),
  };
}

export const expoTransport: Transport = Object.freeze({ request: send, stream: send });
