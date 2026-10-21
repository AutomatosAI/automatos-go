// A fake Transport for the client's tests: records every request and answers from a responder, so
// nothing touches the network or imports expo/fetch.

import type { Server } from '../server';
import type { StreamingResponse, Transport, TransportRequest } from '../transport-types';

export const SERVER: Server = Object.freeze({
  apiUrl: 'https://api.example.test',
  webUrl: 'https://ui.example.test',
  source: 'hosted',
});

type Responder = (request: TransportRequest) => StreamingResponse | Promise<StreamingResponse>;

export type FakeTransport = Transport & { readonly calls: TransportRequest[] };

export function fakeTransport(responder: Responder): FakeTransport {
  const calls: TransportRequest[] = [];
  const handle = async (request: TransportRequest) => {
    calls.push(request);
    return responder(request);
  };
  return { calls, request: handle, stream: handle };
}

/** A whole-body answer. */
export function reply(status: number, body = ''): StreamingResponse {
  return {
    status,
    text: async () => body,
    chunks: async function* () {
      if (body) yield body;
    },
  };
}

export function jsonReply(status: number, value: unknown): StreamingResponse {
  return reply(status, JSON.stringify(value));
}

/** A chunk that never arrives (the read stays pending until the request is aborted). */
export const PENDING = Symbol('pending');
type Chunk = string | Error | typeof PENDING;

export type ChunkedReply = StreamingResponse & {
  /** true once the body was read to its end */
  readonly finished: () => boolean;
  /** true once the reader was closed (at the end, or early by a cancel) */
  readonly closed: () => boolean;
};

/** A body that arrives in these chunks; an Error chunk fails the read at that point. */
export function chunked(chunks: readonly Chunk[], status = 200): ChunkedReply {
  let finished = false;
  let closed = false;
  async function* body(): AsyncGenerator<string> {
    try {
      for (const chunk of chunks) {
        if (chunk === PENDING) await new Promise<never>(() => undefined);
        if (chunk instanceof Error) throw chunk;
        if (typeof chunk === 'string') yield chunk;
      }
      finished = true;
    } finally {
      closed = true;
    }
  }
  return {
    status,
    text: async () => chunks.filter((chunk) => typeof chunk === 'string').join(''),
    chunks: body,
    finished: () => finished,
    closed: () => closed,
  };
}

/** Answers only when the request's signal aborts, then rejects the way fetch does. */
export function hangUntilAborted(request: TransportRequest): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    const fail = () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    };
    if (request.signal.aborted) fail();
    else request.signal.addEventListener('abort', fail);
  });
}

export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
