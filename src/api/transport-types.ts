// The transport port the client sends through. The real one is expo/fetch (transport.ts, the only
// importer of expo/fetch); tests inject a fake, so nothing here touches the network or React Native.

import type { HttpMethod } from './routes';

export type TransportRequest = {
  readonly url: string;
  readonly method: HttpMethod;
  readonly headers: Readonly<Record<string, string>>;
  /** A JSON string, or FormData passed through untouched (multipart). */
  readonly body?: string | FormData;
  readonly signal: AbortSignal;
};

/** A response whose body is read whole. */
export type TransportResponse = {
  readonly status: number;
  text(): Promise<string>;
};

/** A response whose body is read as it arrives; leaving the loop early cancels the read. */
export type StreamingResponse = TransportResponse & {
  chunks(): AsyncIterable<string>;
};

export type Transport = {
  request(request: TransportRequest): Promise<TransportResponse>;
  stream(request: TransportRequest): Promise<StreamingResponse>;
};
