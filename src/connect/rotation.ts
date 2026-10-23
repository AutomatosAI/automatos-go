// Token rotation (US-006i, PRD-266 §4.2, §4.3): once the paired record's rotateAfter has passed, the
// phone swaps its device token for a new one with POST /api/v1/mobile/devices/{device_id}/rotate,
// presenting its CURRENT token. The server hands the new token over once and keeps the old one
// valid for MOBILE_TOKEN_ROTATION_OVERLAP_SECONDS (600).
//
// It runs at launch and on resume (src/session/use-session-refresh.ts), never per request, and one
// rotation at a time: concurrent callers share the call in flight. The new token and the next
// rotate_after are written to the keychain (device-store.ts) BEFORE the new token is used: nothing
// here hands it on, and the provider (src/auth/providers/device.ts) reads the store, which shows a
// record only once its write is done. A rotation keeps the pairing (device, server, pairedAt), so
// the provider goes on serving it. On any failure the old token is kept: a server that did not
// rotate is asked again at the next launch or resume; one that did (the answer then lost, or not
// kept) is never asked again for that rotateAfter, because the old token can no longer rotate
// (409 token_superseded) and a later call's 401 takes the person to Connect (US-006c).
//
// The call goes through the one client, to the record's own origin with the record's token and no
// X-Workspace-ID (the device lane's workspace is its row's). Its 401 calls nothing here: the
// session's next call hears it. Nothing here logs a token.

import { createApiClient } from '../api/client';
import { isApiError } from '../api/errors';
import { ownServerFrom } from '../api/server';
import type { Transport } from '../api/transport-types';
import { logger } from '../lib/logger';
import type { RefreshEvent } from '../session/role-refresh';
import { TOKEN_SUPERSEDED } from './config';
import { pairingOf } from './current-server';
import type { DeviceStore, PairedRecord } from './device-store';
import { CONNECT_ROUTES } from './routes';
import { rotateResponseSchema, type RotateResponse } from './schemas';

export type RotationResult =
  /** no paired record: the hosted server, or nothing paired */
  | 'none'
  /** rotateAfter is still ahead */
  | 'not_due'
  /** this rotateAfter was already rotated (or refused as superseded) this launch: never twice */
  | 'spent'
  /** the new token and rotateAfter are in the keychain */
  | 'rotated'
  /** no new token (no answer, a refusal, an answer this version cannot read): asked again later */
  | 'failed'
  /** the server says this token was already rotated out: asking again cannot succeed */
  | 'superseded'
  /** a new token the keychain would not keep, or the pairing moved on meanwhile: the old one stays */
  | 'not_saved';

export type TokenRotationDeps = {
  readonly store: Pick<DeviceStore, 'load' | 'save'>;
  /** The shell wires expoTransport (as use-connect.ts does); tests a fake. */
  readonly transport: Transport;
  readonly now: () => Date;
};

export type TokenRotation = {
  /** Rotates the token if it is due; concurrent callers share one call. Never rejects. */
  readonly rotateIfDue: () => Promise<RotationResult>;
};

/** Python's isoformat() carries microseconds; Date.parse is only specified for milliseconds. */
const FRACTION_BEYOND_MS = /(\.\d{3})\d+/;

/** The instant an ISO 8601 date names, in ms (NaN when it names none). */
export function instantOf(iso: string): number {
  return Date.parse(iso.replace(FRACTION_BEYOND_MS, '$1'));
}

/** Pure: is the record's token due to rotate at `now`? */
export function rotationDue(record: Pick<PairedRecord, 'rotateAfter'>, now: Date): boolean {
  const after = instantOf(record.rotateAfter);
  return Number.isFinite(after) && now.getTime() >= after;
}

/** The refresh events a rotation runs on: launch and resume, never a refusal (or a request). */
export function rotatesOn(event: RefreshEvent): boolean {
  return event === 'launch' || event === 'resume';
}

/** One rotation's due date for one pairing: asked at most once per launch once the server answered. */
function rotationKey(record: PairedRecord): string {
  return `${pairingOf(record)}|${record.rotateAfter}`;
}

/** The same pairing, still holding the token that was rotated. */
function stillHolds(current: PairedRecord | null, rotated: PairedRecord): current is PairedRecord {
  return (
    current !== null && pairingOf(current) === pairingOf(rotated) && current.token === rotated.token
  );
}

type Answer =
  | { readonly kind: 'rotated'; readonly answer: RotateResponse }
  | { readonly kind: 'failed' }
  | { readonly kind: 'superseded' };

const FAILED: Answer = Object.freeze({ kind: 'failed' });
const SUPERSEDED: Answer = Object.freeze({ kind: 'superseded' });
const CONFLICT = 409;

/** A failure in words for the dev log: the client's kind, status and code, never a body. */
function failureOf(error: unknown): string {
  if (isApiError(error)) return `${error.kind} ${error.status ?? '-'} ${error.code ?? ''}`.trim();
  return error instanceof Error ? error.name : typeof error;
}

async function askServer(record: PairedRecord, transport: Transport): Promise<Answer> {
  const client = createApiClient({
    server: ownServerFrom({ origin: record.origin, webUrl: record.webUrl }),
    getToken: async () => record.token,
    getWorkspaceId: () => null,
    transport,
    onAuthExpired: () => undefined,
  });
  try {
    const answer = await client.request(CONNECT_ROUTES.rotate, {
      schema: rotateResponseSchema,
      params: { device_id: record.deviceId },
    });
    if (answer.device_id === record.deviceId) return Object.freeze({ kind: 'rotated', answer });
    logger.warn('[connect] the rotate answer named another device; the current token stays');
    return FAILED;
  } catch (error) {
    if (isApiError(error) && error.status === CONFLICT && error.code === TOKEN_SUPERSEDED) {
      logger.warn('[connect] this token was already rotated out; it stays until it is refused');
      return SUPERSEDED;
    }
    logger.warn(`[connect] token rotation failed (${failureOf(error)}); trying again later`);
    return FAILED;
  }
}

/** Writes the new token over the record it replaces; anything else keeps the old token. */
async function keep(
  store: TokenRotationDeps['store'],
  rotated: PairedRecord,
  answer: RotateResponse,
): Promise<RotationResult> {
  try {
    const current = await store.load();
    // forgotten or paired again while the call ran: never bring an old pairing back
    if (!stillHolds(current, rotated)) return 'not_saved';
    await store.save({ ...current, token: answer.token, rotateAfter: answer.rotate_after });
    return 'rotated';
  } catch (error) {
    logger.warn(`[connect] could not keep the rotated token (${failureOf(error)})`);
    return 'not_saved';
  }
}

export function createTokenRotation({ store, transport, now }: TokenRotationDeps): TokenRotation {
  let inFlight: Promise<RotationResult> | undefined;
  let spent: ReadonlySet<string> = new Set();

  const rotate = async (): Promise<RotationResult> => {
    const record = await store.load();
    if (!record) return 'none';
    if (!rotationDue(record, now())) return 'not_due';
    const key = rotationKey(record);
    if (spent.has(key)) return 'spent';
    const reply = await askServer(record, transport);
    if (reply.kind === 'failed') return 'failed';
    spent = new Set([...spent, key]);
    if (reply.kind === 'superseded') return 'superseded';
    return keep(store, record, reply.answer);
  };

  return Object.freeze({
    rotateIfDue: () => {
      inFlight ??= rotate()
        .catch((error: unknown) => {
          // the keychain refused to read (before the first unlock): the next resume tries again
          logger.warn(`[connect] token rotation could not start (${failureOf(error)})`);
          return 'failed' as const;
        })
        .finally(() => {
          inFlight = undefined;
        });
      return inFlight;
    },
  });
}
