// Today's brief on request (Settings → Notifications → Daily digest), pure: the gate, what the
// server's answer means, the button's state after it, and its words. The button shows only where
// the digest does and the server lists digest_now (D-CAPABILITIES). One tap sends one POST: never
// while one is out, never in the 5 minutes after a 202 (the server's own limit), never retried
// (D-WRITES). A 202 is a toast (the hook's); a 429 says when to try again, rounded up to whole
// minutes; a 503 digest_unavailable and every other failure are one plain line. Every answer here is
// a new, frozen value.

import { canDigestNow, type GateInput } from '../../api/capabilities';
import { isApiError, userMessage } from '../../api/errors';
import {
  DIGEST_NOW_WAIT_MS,
  DIGEST_UNAVAILABLE_CODE,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  TOO_MANY_REQUESTS_STATUS,
} from '../config';
import { PUSH_DIGEST_NOW_COPY } from '../strings';
import { digestShown } from './digest';

/** The button shows where the digest does (push and digest) and the server lists digest_now. */
export function digestNowShown(discovery: GateInput): boolean {
  return digestShown(discovery) && canDigestNow(discovery);
}

export type DigestNowRefusal =
  | Readonly<{ kind: 'rate_limited'; retryAfterSeconds: number | null }>
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'failed'; line: string }>;

export type DigestNowOutcome = Readonly<{ kind: 'queued' }> | DigestNowRefusal;

const QUEUED: DigestNowOutcome = Object.freeze({ kind: 'queued' });
const UNAVAILABLE: DigestNowRefusal = Object.freeze({ kind: 'unavailable' });

/** A failed POST in the button's terms: any 429 is a wait, its seconds when the body gives them. */
export function outcomeOfError(error: unknown): DigestNowRefusal {
  if (isApiError(error) && error.status === TOO_MANY_REQUESTS_STATUS) {
    return Object.freeze({
      kind: 'rate_limited',
      retryAfterSeconds: error.retryAfterSeconds ?? null,
    });
  }
  if (isApiError(error) && error.code === DIGEST_UNAVAILABLE_CODE) return UNAVAILABLE;
  return Object.freeze({ kind: 'failed', line: userMessage(error) });
}

/** Sends once and says what came of it; never rejects. */
export async function answerOf(send: () => Promise<unknown>): Promise<DigestNowOutcome> {
  try {
    await send();
    return QUEUED;
  } catch (error) {
    return outcomeOfError(error);
  }
}

export type DigestNowState = Readonly<{
  /** The POST is out: the button is busy and takes no tap. */
  sending: boolean;
  /** When the wait after the last 202 ends (epoch ms); null before any 202. */
  waitUntil: number | null;
  /** The last refusal, shown until the next tap; null after a 202. */
  refusal: DigestNowRefusal | null;
}>;

export const DIGEST_NOW_IDLE: DigestNowState = Object.freeze({
  sending: false,
  waitUntil: null,
  refusal: null,
});

/** The ms left of the wait after a 202; 0 when there is none. */
export function waitLeft(state: DigestNowState, now: number): number {
  return state.waitUntil === null ? 0 : Math.max(0, state.waitUntil - now);
}

/** A tap sends only when nothing is out and no wait runs. */
export function canSend(state: DigestNowState, now: number): boolean {
  return !state.sending && waitLeft(state, now) === 0;
}

/** A send starts: busy, and the last refusal's line goes. */
export function startSending(state: DigestNowState): DigestNowState {
  return Object.freeze({ ...state, sending: true, refusal: null });
}

/** The answer lands: a 202 starts the 5-minute wait; a refusal leaves the button as it was. */
export function afterAnswer(
  state: DigestNowState,
  outcome: DigestNowOutcome,
  now: number,
): DigestNowState {
  if (outcome.kind === 'queued') {
    return Object.freeze({ sending: false, waitUntil: now + DIGEST_NOW_WAIT_MS, refusal: null });
  }
  return Object.freeze({ ...state, sending: false, refusal: outcome });
}

/** Whole minutes, rounded up, never under one. */
function minutesUp(ms: number): number {
  return Math.max(1, Math.ceil(ms / MS_PER_MINUTE));
}

/** A refusal in one plain line. */
export function refusalLine(refusal: DigestNowRefusal): string {
  if (refusal.kind === 'unavailable') return PUSH_DIGEST_NOW_COPY.unavailable;
  if (refusal.kind === 'failed') return refusal.line;
  if (refusal.retryAfterSeconds === null) return PUSH_DIGEST_NOW_COPY.tryAgainSoon;
  return PUSH_DIGEST_NOW_COPY.tryAgainIn(minutesUp(refusal.retryAfterSeconds * MS_PER_SECOND));
}

export type DigestNowView = Readonly<{
  label: string;
  busy: boolean;
  /** The wait after a 202 runs. */
  disabled: boolean;
  /** The label, with the wait's minutes while it runs (VoiceOver reads it on the button). */
  accessibilityLabel: string;
  /** The line under the button: the wait, or the last refusal; null when there is neither. */
  line: string | null;
  /** The line repeats the button's label (the wait): VoiceOver skips it. */
  lineHidden: boolean;
}>;

export function digestNowView(state: DigestNowState, now: number): DigestNowView {
  const left = waitLeft(state, now);
  const label = PUSH_DIGEST_NOW_COPY.button;
  const base = { label, busy: state.sending };
  if (left > 0) {
    const minutes = minutesUp(left);
    return Object.freeze({
      ...base,
      disabled: true,
      accessibilityLabel: PUSH_DIGEST_NOW_COPY.waitLabel(minutes),
      line: PUSH_DIGEST_NOW_COPY.sentWait(minutes),
      lineHidden: true,
    });
  }
  return Object.freeze({
    ...base,
    disabled: false,
    accessibilityLabel: label,
    line: state.refusal ? refusalLine(state.refusal) : null,
    lineHidden: false,
  });
}

/** The ms until the wait's minutes next change (or it ends); null when no wait runs. */
export function nextChangeIn(state: DigestNowState, now: number): number | null {
  const left = waitLeft(state, now);
  if (left === 0) return null;
  return left % MS_PER_MINUTE || MS_PER_MINUTE;
}
