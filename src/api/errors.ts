// The error taxonomy (PRD-001 §4.4, D-ERRORS): every failure of the one client is an ApiError of one
// kind, and each kind has one user-facing message (strings.ts). FastAPI answers errors as
// {"detail": "<words>"} or {"detail": {"code", "message", …}}; the 409 pending_invitation body is
// {"detail": {"code": "pending_invitation", "redirect", "token", "message"}} (automatos-ai
// core/auth/hybrid.py:852-861) and its code and message are kept exactly as sent. A code beside the
// detail ({"code", "detail"}: the server voice's refusals, tts_busy) is read when the detail has
// none, and so is a 429's retry_after_seconds (the digest's {"code": "digest_rate_limited",
// "retry_after_seconds": N}), beside the detail or in it. Statuses outside the named ones (400, 422,
// 429, …) are 'server': the server refused and the app cannot fix it.

import { z } from 'zod';

import { SERVER_MESSAGE_MAX_CHARS } from './config';
import { parseJson } from './json';
import { API_ERROR_COPY, APP_ERROR_COPY } from './strings';

export type ApiErrorKind =
  | 'network'
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'server'
  | 'stream'
  | 'invalid_response';

export type ApiErrorDetail = {
  readonly status?: number;
  readonly code?: string;
  readonly serverMessage?: string;
  /** How long the server asks the caller to wait before trying again (retry_after_seconds). */
  readonly retryAfterSeconds?: number;
  /** What went wrong underneath, for the logs only. */
  readonly cause?: unknown;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly serverMessage?: string;
  readonly retryAfterSeconds?: number;

  constructor(kind: ApiErrorKind, detail: ApiErrorDetail = {}) {
    // the message is for logs: the kind, status and code, never a URL, a token or a body
    super(
      ['ApiError', kind, detail.status, detail.code].filter((part) => part !== undefined).join(' '),
      detail.cause === undefined ? undefined : { cause: detail.cause },
    );
    this.name = 'ApiError';
    this.kind = kind;
    this.status = detail.status;
    this.code = detail.code;
    this.serverMessage = detail.serverMessage;
    this.retryAfterSeconds = detail.retryAfterSeconds;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

const ABORT_ERROR_NAME = 'AbortError';

/** The caller aborted: not a failure of the server or the network, so not an ApiError. */
export function abortError(): Error {
  const error = new Error('The request was aborted');
  error.name = ABORT_ERROR_NAME;
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === ABORT_ERROR_NAME;
}

const STATUS_KINDS: ReadonlyMap<number, ApiErrorKind> = new Map<number, ApiErrorKind>([
  [401, 'auth'],
  [403, 'forbidden'],
  [404, 'not_found'],
  [409, 'conflict'],
]);

export function kindForStatus(status: number): ApiErrorKind {
  return STATUS_KINDS.get(status) ?? 'server';
}

const optionalString = z.string().optional().catch(undefined);
/** A wait in seconds: a finite number, never negative; anything else is dropped. */
const optionalSeconds = z.number().finite().nonnegative().optional().catch(undefined);
const ErrorBodySchema = z.object({
  code: optionalString,
  retry_after_seconds: optionalSeconds,
  detail: z
    .union([
      z.string(),
      z.object({
        code: optionalString,
        message: optionalString,
        retry_after_seconds: optionalSeconds,
      }),
    ])
    .optional()
    .catch(undefined),
});

function clip(text: string): string {
  return text.length > SERVER_MESSAGE_MAX_CHARS ? text.slice(0, SERVER_MESSAGE_MAX_CHARS) : text;
}

function codeOf(code: string | undefined): Pick<ApiErrorDetail, 'code'> {
  return code ? { code } : {};
}

function retryAfterOf(seconds: number | undefined): Pick<ApiErrorDetail, 'retryAfterSeconds'> {
  return seconds === undefined ? {} : { retryAfterSeconds: seconds };
}

type BodyDetail = Pick<ApiErrorDetail, 'code' | 'serverMessage' | 'retryAfterSeconds'>;

/**
 * The code, words and wait a FastAPI error body carries, when it carries any (a non-JSON body:
 * none). The detail's own code and wait win over the ones beside it.
 */
export function detailOf(body: string): BodyDetail {
  const parsed = ErrorBodySchema.safeParse(parseJson(body)?.value);
  if (!parsed.success) return {};
  const { code, detail, retry_after_seconds: retryAfter } = parsed.data;
  if (typeof detail === 'string') {
    return { ...codeOf(code), ...retryAfterOf(retryAfter), serverMessage: clip(detail) };
  }
  if (!detail) return { ...codeOf(code), ...retryAfterOf(retryAfter) };
  return {
    ...codeOf(detail.code ?? code),
    ...retryAfterOf(detail.retry_after_seconds ?? retryAfter),
    ...(detail.message ? { serverMessage: clip(detail.message) } : {}),
  };
}

/** A non-OK response as an ApiError of the kind its status names. */
export function errorFromResponse(status: number, body: string): ApiError {
  return new ApiError(kindForStatus(status), { status, ...detailOf(body) });
}

/** Codes the app gives errors it raises itself (no response behind them), each with its own words. */
export const APP_ERROR_CODES = Object.freeze({
  /** auth: the sign-in service will not mint the app's token (src/auth/providers/clerk.ts). */
  signInNotSetUp: 'sign_in_not_set_up',
} as const);

const APP_CODE_COPY: ReadonlyMap<string, string> = new Map([
  [APP_ERROR_CODES.signInNotSetUp, APP_ERROR_COPY.signInNotSetUp],
]);

/** Only an error with no status (raised by the app, not read from a body) can pick these words. */
function appCopy(error: ApiError): string | undefined {
  return error.status === undefined && error.code ? APP_CODE_COPY.get(error.code) : undefined;
}

/**
 * What to show the user. An error the app raised with a code of its own shows that code's words;
 * a conflict shows the server's own words when it sent any (waitlist, unlinked account, pending
 * invitation: PRD-001 §4.5); every other kind shows its fixed copy.
 */
export function userMessage(error: unknown): string {
  if (!isApiError(error)) return API_ERROR_COPY.server;
  const own = appCopy(error);
  if (own) return own;
  if (error.kind === 'conflict' && error.serverMessage) return error.serverMessage;
  return API_ERROR_COPY[error.kind];
}
