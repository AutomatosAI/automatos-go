// The error taxonomy (PRD-001 §4.4, D-ERRORS): every failure of the one client is an ApiError of one
// kind, and each kind has one user-facing message (strings.ts). FastAPI answers errors as
// {"detail": "<words>"} or {"detail": {"code", "message", …}}; the 409 pending_invitation body is
// {"detail": {"code": "pending_invitation", "redirect", "token", "message"}} (automatos-ai
// core/auth/hybrid.py:852-861) and its code and message are kept exactly as sent. Statuses outside
// the named ones (400, 422, 429, …) are 'server': the server refused and the app cannot fix it.

import { z } from 'zod';

import { SERVER_MESSAGE_MAX_CHARS } from './config';
import { parseJson } from './json';
import { API_ERROR_COPY } from './strings';

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
  /** What went wrong underneath, for the logs only. */
  readonly cause?: unknown;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly serverMessage?: string;

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
const ErrorBodySchema = z.object({
  detail: z
    .union([z.string(), z.object({ code: optionalString, message: optionalString })])
    .optional()
    .catch(undefined),
});

function clip(text: string): string {
  return text.length > SERVER_MESSAGE_MAX_CHARS ? text.slice(0, SERVER_MESSAGE_MAX_CHARS) : text;
}

/** The code and words a FastAPI error body carries, when it carries any (a non-JSON body: none). */
export function detailOf(body: string): Pick<ApiErrorDetail, 'code' | 'serverMessage'> {
  const parsed = ErrorBodySchema.safeParse(parseJson(body)?.value);
  const detail = parsed.success ? parsed.data.detail : undefined;
  if (typeof detail === 'string') return { serverMessage: clip(detail) };
  if (!detail) return {};
  return {
    ...(detail.code ? { code: detail.code } : {}),
    ...(detail.message ? { serverMessage: clip(detail.message) } : {}),
  };
}

/** A non-OK response as an ApiError of the kind its status names. */
export function errorFromResponse(status: number, body: string): ApiError {
  return new ApiError(kindForStatus(status), { status, ...detailOf(body) });
}

/**
 * What to show the user. A conflict shows the server's own words when it sent any (waitlist,
 * unlinked account, pending invitation: PRD-001 §4.5); every other kind shows its fixed copy.
 */
export function userMessage(error: unknown): string {
  if (!isApiError(error)) return API_ERROR_COPY.server;
  if (error.kind === 'conflict' && error.serverMessage) return error.serverMessage;
  return API_ERROR_COPY[error.kind];
}
