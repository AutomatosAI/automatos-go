// Is this push from the phone's own server, and fresh? (D-SIGNATURE, KP6 = W2 K9.) Anyone holding
// the phone's Expo push token can send it a push, so nothing is posted, followed or marked read
// unless sig is the lowercase hex HMAC-SHA256, keyed with this phone's push_key as UTF-8 (never
// base64-decoded), over the canonical v2 message, and iat lies in the window. The answer is a
// boolean and this never throws: a payload of the wrong shape, a v other than 2, a stale or
// future iat, a malformed sig, a missing key or a failing digest are all false; checkPushSignature
// gives the same answer as a word that says which (the tap diagnostics keep it). It logs nothing
// (the caller logs the kind); the sha256 port is the device's native digest or, in tests,
// node:crypto.

import {
  PUSH_PAYLOAD_VERSION,
  PUSH_SIG_MAX_AGE_SECONDS,
  PUSH_SIG_MAX_FUTURE_SECONDS,
  PUSH_SIG_PATTERN,
} from '../config';
import { pushPayloadSchema, type PushPayload } from '../schemas/payload';
import { signedMessage } from './canonical';
import { hmacSha256, type Sha256 } from './hmac';
import { utf8Bytes } from './utf8';

/** An HMAC-SHA256: 32 bytes, 64 hex characters. */
const SIG_BYTES = 32;
const HEX_RADIX = 16;

/** now − 7 days ≤ iat ≤ now + 5 minutes, both edges included (W2 K9). */
function isFresh(iat: number, nowSeconds: number): boolean {
  return (
    Number.isFinite(nowSeconds) &&
    iat >= nowSeconds - PUSH_SIG_MAX_AGE_SECONDS &&
    iat <= nowSeconds + PUSH_SIG_MAX_FUTURE_SECONDS
  );
}

/** The 32 bytes of a 64-character lowercase hex sig; null for any other form. */
function sigBytes(sig: string): Uint8Array | null {
  if (!PUSH_SIG_PATTERN.test(sig)) return null;
  return Uint8Array.from({ length: SIG_BYTES }, (_, index) =>
    Number.parseInt(sig.slice(index * 2, index * 2 + 2), HEX_RADIX),
  );
}

/** Every byte compared, with no exit at the first difference (the time says nothing about where). */
function constantTimeEqual(first: Uint8Array, second: Uint8Array): boolean {
  if (first.length !== second.length) return false;
  const difference = first.reduce((acc, byte, index) => acc | (byte ^ (second[index] ?? 0)), 0);
  return difference === 0;
}

async function signatureMatches(
  payload: PushPayload,
  pushKey: string,
  sha256: Sha256,
): Promise<boolean> {
  const expected = sigBytes(payload.sig);
  if (!expected) return false;
  const message = utf8Bytes(signedMessage(payload));
  const computed = await hmacSha256(utf8Bytes(pushKey), message, sha256);
  return computed.length === SIG_BYTES && constantTimeEqual(computed, expected);
}

/**
 * What the check found, as a word the tap diagnostics keep (never the key, the sig or the
 * payload): 'verified', or why not — not a v2 payload, no key, an iat outside the window, a sig
 * that does not match the key, or a digest that failed.
 */
export type SignatureCheck =
  'verified' | 'not_v2' | 'no_key' | 'stale' | 'mismatch' | 'digest_failed';

/** Like verifyPushSignature, but says why a push did not verify. Never throws. */
export async function checkPushSignature(
  payload: unknown,
  pushKey: string | null | undefined,
  sha256: Sha256,
  nowSeconds: number,
): Promise<SignatureCheck> {
  const parsed = pushPayloadSchema.safeParse(payload);
  if (!parsed.success || parsed.data.v !== PUSH_PAYLOAD_VERSION) return 'not_v2';
  if (!pushKey) return 'no_key';
  if (!isFresh(parsed.data.iat, nowSeconds)) return 'stale';
  try {
    return (await signatureMatches(parsed.data, pushKey, sha256)) ? 'verified' : 'mismatch';
  } catch {
    // A digest that fails is an unverified push, never a crash; the caller logs the kind (KP6).
    return 'digest_failed';
  }
}

/**
 * true only when payload is a v2 push payload (as received or as parsed), its iat is fresh at
 * nowSeconds (epoch seconds, the phone's clock) and its sig verifies with pushKey.
 */
export async function verifyPushSignature(
  payload: unknown,
  pushKey: string | null | undefined,
  sha256: Sha256,
  nowSeconds: number,
): Promise<boolean> {
  try {
    return (await checkPushSignature(payload, pushKey, sha256, nowSeconds)) === 'verified';
  } catch {
    return false;
  }
}
