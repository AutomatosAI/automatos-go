// The error taxonomy (PRD-001 §4.4, D-ERRORS): every failure of the one client is an ApiError of one
// kind, and each kind has one user-facing message (strings.ts). FastAPI answers errors as
// {"detail": "<words>"} or {"detail": {"code", "message", …}}; the 409 pending_invitation body is
// {"detail": {"code": "pending_invitation", "redirect", "token", "message"}} (automatos-ai
// core/auth/hybrid.py:852-861) and its code and message are kept exactly as sent. A code beside the
// detail ({"code", "detail"}: the server voice's refusals, tts_busy) is read when the detail has
// none, and so is a 429's retry_after_seconds (the digest's {"code": "digest_rate_limited",
// "retry_after_seconds": N}), beside the detail or in it. A 429 is 'limit' (rule 6.2): it carries
// when the limit lifts, from its Retry-After (else that retry_after_seconds) read against the
// client's clock (retry-after.ts), and its words say roughly when to try again. Statuses outside
// the named ones (400, 402, 422, …) are 'server': the server refused and the app cannot fix it.

import { z } from 'zod';

import {
  REDIRECT_TARGET_MAX_CHARS,
  SERVER_CODE_MAX_CHARS,
  SERVER_MESSAGE_MAX_CHARS,
} from './config';
import { parseJson } from './json';
import { boundedRetryAfterSeconds, limitWaitMs, saneWaitMs } from './retry-after';
import { API_ERROR_COPY, APP_ERROR_COPY, LIMIT_COPY } from './strings';

const MS_PER_SECOND = 1_000;

export type ApiErrorKind =
  | 'network'
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'server'
  | 'stream'
  | 'invalid_response'
  | 'limit';

export type ApiErrorDetail = {
  readonly status?: number;
  readonly code?: string;
  readonly serverMessage?: string;
  /**
   * How long the server asks the caller to wait before trying again: retry_after_seconds, and for
   * a limit its Retry-After first (retry-after.ts), as it stood when the answer came.
   */
  readonly retryAfterSeconds?: number;
  /** A limit: when it lifts (epoch ms, on the client's clock); null when not known or not a limit. */
  readonly retryAt?: number | null;
  /**
   * Where a redirect the app refused to follow pointed (its Location), kept only when it has no
   * query and no fragment. Never followed and never shown: only pairing reads it, to offer the
   * same server's https address (src/connect).
   */
  readonly redirectTo?: string;
  /** What went wrong underneath, for the logs only. */
  readonly cause?: unknown;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly serverMessage?: string;
  readonly retryAfterSeconds?: number;
  readonly retryAt: number | null;
  readonly redirectTo?: string;

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
    this.retryAt = detail.retryAt ?? null;
    this.redirectTo = detail.redirectTo;
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
  [429, 'limit'],
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

function clip(text: string, maxChars = SERVER_MESSAGE_MAX_CHARS): string {
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/** A server's code, cut as its message is: it goes into the error's message, for the logs. */
function codeOf(code: string | undefined): Pick<ApiErrorDetail, 'code'> {
  return code ? { code: clip(code, SERVER_CODE_MAX_CHARS) } : {};
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

const REDIRECT_MIN = 300;
const REDIRECT_END = 400;

/** A 3xx: an answer that asks to be followed somewhere else, which the app never does. */
export function isRedirectStatus(status: number): boolean {
  return status >= REDIRECT_MIN && status < REDIRECT_END;
}

/** What a limit's answer says about when it lifts: its Retry-After, and the client's clock. */
export type LimitFacts = {
  readonly retryAfter: string | null;
  /** The client's clock when the answer came (epoch ms): an HTTP date needs it, as does retryAt. */
  readonly now?: number;
};

/** A limit's wait, as the wait it asked for and the instant it ends; nothing when unknown. */
function limitDetail(
  bodySeconds: number | undefined,
  facts: LimitFacts | undefined,
): Pick<ApiErrorDetail, 'retryAfterSeconds' | 'retryAt'> {
  const now = facts?.now;
  const wait = limitWaitMs(facts?.retryAfter, bodySeconds, now);
  if (wait === null) return { retryAt: null };
  return {
    retryAfterSeconds: wait / MS_PER_SECOND,
    retryAt: now === undefined ? null : now + wait,
  };
}

/** A query or a fragment: where a presigned address keeps its signature. */
const QUERY_OR_FRAGMENT = /[?#]/;

/**
 * Where a refused redirect pointed, as far as a caller needs it: pairing reads the origin and the
 * path (src/connect/https-twin.ts) and refuses one with a query or a fragment. So an address with
 * either is not kept at all (a presigned storage address is a credential, in its query), and one
 * longer than any real address of a server is dropped too.
 */
function keptRedirect(location: string | null | undefined): Pick<ApiErrorDetail, 'redirectTo'> {
  if (!location || location.length > REDIRECT_TARGET_MAX_CHARS) return {};
  return QUERY_OR_FRAGMENT.test(location) ? {} : { redirectTo: location };
}

/**
 * A non-OK response as an ApiError of the kind its status names. A redirect (never followed) keeps
 * where it pointed, when it said and the address is no longer than any real one. A limit keeps
 * when it lifts, when its answer said and the wait is believable (retry-after.ts).
 */
export function errorFromResponse(
  status: number,
  body: string,
  location?: string | null,
  limit?: LimitFacts,
): ApiError {
  const kind = kindForStatus(status);
  const { retryAfterSeconds: bodySeconds, ...detail } = detailOf(body);
  const redirectTo = isRedirectStatus(status) ? keptRedirect(location) : {};
  // a body's wait is never kept as it came: a limit's is worked out, any other's bounded the same
  const wait =
    kind === 'limit'
      ? limitDetail(bodySeconds, limit)
      : retryAfterOf(boundedRetryAfterSeconds(bodySeconds) ?? undefined);
  return new ApiError(kind, { status, ...detail, ...redirectTo, ...wait });
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

const MS_PER_MINUTE = 60 * MS_PER_SECOND;

/** A limit's words: roughly when to try again, in whole minutes rounded up; "later" when unknown. */
export function limitWords(waitMs: number | null): string {
  if (waitMs === null) return API_ERROR_COPY.limit;
  const minutes = Math.ceil(waitMs / MS_PER_MINUTE);
  return minutes <= 1 ? LIMIT_COPY.underAMinute : LIMIT_COPY.inMinutes(minutes);
}

/**
 * How long is left of a limit: against `now` when the caller holds a clock and the limit's end is
 * known, else the wait as the answer gave it (right as the answer is shown); null when unknown.
 */
function limitLeftMs(error: ApiError, now: number | undefined): number | null {
  if (now !== undefined && error.retryAt !== null) return Math.max(0, error.retryAt - now);
  return saneWaitMs(
    error.retryAfterSeconds === undefined ? null : error.retryAfterSeconds * MS_PER_SECOND,
  );
}

/**
 * What to show the user. An error the app raised with a code of its own shows that code's words;
 * a conflict shows the server's own words when it sent any (waitlist, unlinked account, pending
 * invitation: PRD-001 §4.5); a limit says roughly when to try again (`now`, the caller's clock in
 * epoch ms, words it against the moment it is shown); every other kind shows its fixed copy.
 */
export function userMessage(error: unknown, now?: number): string {
  if (!isApiError(error)) return API_ERROR_COPY.server;
  const own = appCopy(error);
  if (own) return own;
  if (error.kind === 'conflict' && error.serverMessage) return error.serverMessage;
  if (error.kind === 'limit') return limitWords(limitLeftMs(error, now));
  return API_ERROR_COPY[error.kind];
}
