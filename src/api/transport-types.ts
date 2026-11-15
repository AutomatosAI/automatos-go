// The transport port the client sends through. The real one is expo/fetch (transport.ts, the only
// importer of expo/fetch); tests inject a fake, so nothing here touches the network or React Native.
// Every body is read under a cap: whole as bytes, never more than the caller allows (bytes), or as
// it arrives (chunks). The port has no way to read a body whole without one.

import type { HttpMethod } from './routes';

export type TransportRequest = {
  readonly url: string;
  readonly method: HttpMethod;
  readonly headers: Readonly<Record<string, string>>;
  /** A JSON string, or FormData passed through untouched (multipart). */
  readonly body?: string | FormData;
  readonly signal: AbortSignal;
};

/** A response whose body is read whole, as bytes under the caller's cap. */
export type TransportResponse = {
  readonly status: number;
  /** The body, refused with body.ts's BodyTooLargeError past `maxBytes` (read no further). */
  bytes(maxBytes: number): Promise<Uint8Array>;
};

/** A response whose body is read as it arrives; leaving the loop early cancels the read. */
export type StreamingResponse = TransportResponse & {
  chunks(): AsyncIterable<string>;
};

/** A response read whole as bytes (an MP3), with its headers. */
export type BinaryResponse = TransportResponse & {
  /** A response header by name (any case); null when the response has none. */
  header(name: string): string | null;
};

export type Transport = {
  request(request: TransportRequest): Promise<TransportResponse>;
  stream(request: TransportRequest): Promise<StreamingResponse>;
  binary(request: TransportRequest): Promise<BinaryResponse>;
};
