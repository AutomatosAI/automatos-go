// A fake Transport for the client's tests: records every request and answers from a responder, so
// nothing touches the network or imports expo/fetch.

import { readBytes } from '../body';
import type { Server } from '../server';
import type { StreamingResponse, Transport, TransportRequest } from '../transport-types';

export const SERVER: Server = Object.freeze({
  apiUrl: 'https://api.example.test',
  webUrl: 'https://ui.example.test',
  source: 'hosted',
});

/** An answer for any of the three calls. */
export type FakeResponse = StreamingResponse;

type Responder = (request: TransportRequest) => FakeResponse | Promise<FakeResponse>;

export type FakeTransport = Transport & { readonly calls: TransportRequest[] };

/** A string as a body read under the caller's cap, as the real transport reads one. */
function bytesOf(body: string): (maxBytes: number) => Promise<Uint8Array> {
  return (maxBytes) => readBytes(streamOf(new TextEncoder().encode(body)), maxBytes);
}

export function fakeTransport(responder: Responder): FakeTransport {
  const calls: TransportRequest[] = [];
  const handle = async (request: TransportRequest) => {
    calls.push(request);
    return responder(request);
  };
  return {
    calls,
    request: handle,
    stream: handle,
    binary: handle,
  };
}

/** The bytes as a body that arrives in one read, as expo/fetch's response.body. */
export function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (bytes.byteLength > 0) controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** A body of bytes with headers (Auto's server voice: an MP3 and its X-Voice-Id). */
export function bytesReply(
  status: number,
  bytes: Uint8Array,
  headers: Readonly<Record<string, string>> = {},
): FakeResponse {
  const byName = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return {
    status,
    chunks: async function* () {
      yield new TextDecoder().decode(bytes);
    },
    bytes: (maxBytes) => readBytes(streamOf(bytes), maxBytes, byName.get('content-length') ?? null),
    header: (name) => byName.get(name.toLowerCase()) ?? null,
  };
}

/** Headers by name, in any case, as a response gives them. */
function headersOf(headers: Readonly<Record<string, string>>): (name: string) => string | null {
  const byName = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return (name) => byName.get(name.toLowerCase()) ?? null;
}

/** A whole-body answer. */
export function reply(
  status: number,
  body = '',
  headers: Readonly<Record<string, string>> = {},
): StreamingResponse {
  return {
    status,
    header: headersOf(headers),
    bytes: bytesOf(body),
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
    header: () => null,
    bytes: bytesOf(chunks.filter((chunk) => typeof chunk === 'string').join('')),
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
