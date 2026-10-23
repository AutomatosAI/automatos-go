// The one API client (PRD-001 §4.4, D-ONE-CLIENT): every screen's HTTP goes through it. It fills the
// route's path parameters, sends the bearer and X-Workspace-ID (auth-headers.ts), JSON-encodes plain
// bodies and passes FormData through untouched (multipart, POST /api/attachments), maps every
// failure to the taxonomy (errors.ts) and parses every JSON response with the caller's zod schema:
// without a schema the body is discarded, so no unparsed data ever leaves the client. The transport
// is injected; the real one (transport.ts, expo/fetch) is wired by the app shell, never by tests.

import type { z } from 'zod';

import {
  buildAuthHeaders,
  createAuthHeaders,
  resolveToken,
  type AuthHeaders,
  type TokenGetter,
  type WorkspaceIdGetter,
} from './auth-headers';
import { REQUEST_TIMEOUT_MS, STREAM_CONNECT_TIMEOUT_MS } from './config';
import { startDeadline, type Deadline } from './deadline';
import { abortError, ApiError, errorFromResponse, isAbortError, isApiError } from './errors';
import { parseJson } from './json';
import type { Route } from './routes';
import type { Server } from './server';
import type {
  StreamingResponse,
  Transport,
  TransportRequest,
  TransportResponse,
} from './transport-types';
import { buildUrl, type PathParams, type QueryParams } from './url';

const CONTENT_TYPE_HEADER = 'Content-Type';
const JSON_CONTENT_TYPE = 'application/json';
const UNAUTHORIZED = 401;

export type ApiClientOptions = {
  readonly server: Server;
  /** The active sign-in provider's token (null when signed out). */
  readonly getToken: TokenGetter;
  /** The workspace id read back from GET /api/workspaces/current (null until known). */
  readonly getWorkspaceId: WorkspaceIdGetter;
  readonly transport: Transport;
  /**
   * Called on a 401 with its ApiError (the code says why: a paired phone's device_revoked), once per
   * token: concurrent 401s on the same token call it once.
   */
  readonly onAuthExpired?: (error?: ApiError) => void;
  readonly timeoutMs?: number;
  readonly connectTimeoutMs?: number;
};

export type CallOptions = {
  readonly params?: PathParams;
  readonly query?: QueryParams;
  /** A plain value is sent as JSON; FormData is sent as is (multipart). */
  readonly body?: unknown;
  readonly signal?: AbortSignal;
};

export type ParsedCallOptions<S extends z.ZodTypeAny> = CallOptions & { readonly schema: S };

export interface ApiClient {
  readonly server: Server;
  /** A JSON call: the response is parsed with `schema` (an invalid_response when it does not fit). */
  request<S extends z.ZodTypeAny>(
    route: Route,
    options: ParsedCallOptions<S>,
  ): Promise<z.output<S>>;
  /** A call whose response body is not needed: it resolves once the server answers OK. */
  request(route: Route, options?: CallOptions): Promise<void>;
  /** Opens a streaming body (stream.ts, sse.ts read it); a non-OK status throws first. */
  stream(route: Route, options?: CallOptions): Promise<StreamingResponse>;
  /** The bearer and workspace headers, for native loads outside the client (auth-headers.ts). */
  authHeaders(): Promise<AuthHeaders>;
}

type Context = {
  readonly server: Server;
  readonly getToken: TokenGetter;
  readonly getWorkspaceId: WorkspaceIdGetter;
  readonly transport: Transport;
  readonly timeoutMs: number;
  readonly connectTimeoutMs: number;
  readonly expired: (token: string | null, error: ApiError) => void;
};

type Prepared = {
  readonly request: Omit<TransportRequest, 'signal'>;
  readonly token: string | null;
};

type AnyCallOptions = CallOptions & { readonly schema?: z.ZodTypeAny };

function isOk(status: number): boolean {
  return status >= 200 && status < 300;
}

/** onAuthExpired once per token: a later token (signed in again) can expire again. */
function expiryLatch(
  onAuthExpired?: (error?: ApiError) => void,
): (token: string | null, error: ApiError) => void {
  let lastExpired: string | null | undefined;
  return (token, error) => {
    if (token === lastExpired) return;
    lastExpired = token;
    onAuthExpired?.(error);
  };
}

function encodeBody(body: unknown): { body?: string | FormData; headers: Record<string, string> } {
  if (body === undefined) return { headers: {} };
  if (typeof FormData !== 'undefined' && body instanceof FormData) return { body, headers: {} };
  return { body: JSON.stringify(body), headers: { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE } };
}

/** URL, body and headers; a bad path parameter throws here, before anything is sent. */
async function prepare(ctx: Context, route: Route, call: CallOptions): Promise<Prepared> {
  const url = buildUrl(ctx.server.apiUrl, route.path, call.params, call.query);
  const encoded = encodeBody(call.body);
  const token = await resolveToken(ctx.getToken);
  const headers = { ...encoded.headers, ...buildAuthHeaders(token, ctx.getWorkspaceId()) };
  const body = encoded.body === undefined ? {} : { body: encoded.body };
  return { token, request: { url, method: route.method, headers, ...body } };
}

async function errorBody(response: TransportResponse): Promise<string> {
  try {
    return await response.text();
  } catch {
    return ''; // an unreadable error body carries no detail; the status alone still maps
  }
}

async function checked<R extends TransportResponse>(
  ctx: Context,
  response: R,
  token: string | null,
): Promise<R> {
  if (isOk(response.status)) return response;
  const error = errorFromResponse(response.status, await errorBody(response));
  if (response.status === UNAUTHORIZED) ctx.expired(token, error);
  throw error;
}

function failure(error: unknown, deadline: Deadline, call: CallOptions, timeoutMs: number) {
  if (isApiError(error)) return error;
  if (call.signal?.aborted) return isAbortError(error) ? error : abortError();
  const cause = deadline.timedOut() ? new Error(`no answer within ${timeoutMs} ms`) : error;
  return new ApiError('network', { cause });
}

function issueSummary(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.code}`)
    .join('; ');
}

/** Paths and codes only in the cause: the values may be user content and stay out of the logs. */
function parsedBody(schema: z.ZodTypeAny, text: string): unknown {
  const json = parseJson(text);
  if (!json) throw new ApiError('invalid_response', { cause: new Error('the body is not JSON') });
  const result = schema.safeParse(json.value);
  if (!result.success) {
    throw new ApiError('invalid_response', { cause: new Error(issueSummary(result.error)) });
  }
  return result.data;
}

async function send(ctx: Context, route: Route, call: AnyCallOptions): Promise<unknown> {
  const { request, token } = await prepare(ctx, route, call);
  const deadline = startDeadline(ctx.timeoutMs, call.signal);
  try {
    const sent = await ctx.transport.request({ ...request, signal: deadline.signal });
    const text = await (await checked(ctx, sent, token)).text();
    return call.schema ? parsedBody(call.schema, text) : undefined;
  } catch (error) {
    throw failure(error, deadline, call, ctx.timeoutMs);
  } finally {
    deadline.dispose();
  }
}

async function* chunksThen(response: StreamingResponse, done: () => void): AsyncGenerator<string> {
  try {
    yield* response.chunks();
  } finally {
    done();
  }
}

/** The opened stream, releasing the caller's abort listener once its body is finished with. */
function disposing(response: StreamingResponse, dispose: () => void): StreamingResponse {
  return {
    status: response.status,
    text: async () => {
      try {
        return await response.text();
      } finally {
        dispose();
      }
    },
    chunks: () => chunksThen(response, dispose),
  };
}

async function open(ctx: Context, route: Route, call: CallOptions): Promise<StreamingResponse> {
  const { request, token } = await prepare(ctx, route, call);
  const deadline = startDeadline(ctx.connectTimeoutMs, call.signal);
  try {
    const opened = await ctx.transport.stream({ ...request, signal: deadline.signal });
    const response = await checked(ctx, opened, token);
    deadline.settle(); // the server answered: the body may now run as long as it needs
    return disposing(response, deadline.dispose);
  } catch (error) {
    deadline.dispose();
    throw failure(error, deadline, call, ctx.connectTimeoutMs);
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const ctx: Context = {
    server: options.server,
    getToken: options.getToken,
    getWorkspaceId: options.getWorkspaceId,
    transport: options.transport,
    timeoutMs: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
    connectTimeoutMs: options.connectTimeoutMs ?? STREAM_CONNECT_TIMEOUT_MS,
    expired: expiryLatch(options.onAuthExpired),
  };
  return Object.freeze({
    server: ctx.server,
    request: ((route: Route, call: AnyCallOptions = {}) =>
      send(ctx, route, call)) as ApiClient['request'],
    stream: (route: Route, call: CallOptions = {}) => open(ctx, route, call),
    authHeaders: createAuthHeaders(ctx.getToken, ctx.getWorkspaceId),
  });
}
