// "Send today's brief now" (Settings → Notifications → Daily digest), pure: the gate (hidden without
// digest_now), the POST through the foundation's client and fake transport (nothing touches the
// network), what a 202, a 429 (its retry_after_seconds parsed by the client's zod schema), a 503 and
// any other failure become, the double-tap guard, and the 5-minute wait after a 202 with its minutes
// in the button's VoiceOver label.

import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/errors';
import type { Capability } from '../../api/discovery';
import { API_ERROR_COPY } from '../../api/strings';
import { jsonReply, reply } from '../../api/__tests__/fake-transport';
import { sendDigestNow } from '../api';
import { DIGEST_NOW_WAIT_MS, MS_PER_MINUTE } from '../config';
import { PUSH_DIGEST_NOW_COPY } from '../strings';
import {
  DIGEST_NOW_IDLE,
  afterAnswer,
  answerOf,
  canSend,
  digestNowShown,
  digestNowView,
  nextChangeIn,
  outcomeOfError,
  refusalLine,
  startSending,
  type DigestNowOutcome,
} from '../settings/digest-now';
import { createDigestNowStore } from '../settings/digest-now-store';
import { WS, harness, sent } from './data-fixtures';
import { deepFreeze } from './inbound-fixtures';

const doc = (capabilities: Capability[], expo = true) =>
  deepFreeze({ capabilities, push: { expo } });

const T0 = 1_792_540_800_000;
const QUEUED_BODY = { status: 'queued' };
const RATE_LIMITED = (seconds: unknown) => ({
  code: 'digest_rate_limited',
  retry_after_seconds: seconds,
});

/** The client's answer to one POST, as the button sees it. */
async function outcomeFor(status: number, body: unknown): Promise<DigestNowOutcome> {
  const { client } = harness(() => jsonReply(status, body));
  return answerOf(() => sendDigestNow(client));
}

/** A send that answers only when the test says, so the in-between can be looked at. */
function deferredSend() {
  let settle: (fail?: unknown) => void = () => undefined;
  const send = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        settle = (fail) => (fail === undefined ? resolve() : reject(fail));
      }),
  );
  return { send, settle: (fail?: unknown) => settle(fail) };
}

function clockAt(start: number) {
  let now = start;
  return { clock: () => now, advance: (ms: number) => (now += ms) };
}

describe('the gate: shown only where the digest is and the server lists digest_now', () => {
  it('hidden without digest_now', () => {
    expect(digestNowShown(doc(['push', 'digest']))).toBe(false);
  });

  it('hidden without push, without the digest, without Expo, and before discovery', () => {
    expect(digestNowShown(doc(['digest', 'digest_now']))).toBe(false);
    expect(digestNowShown(doc(['push', 'digest_now']))).toBe(false);
    expect(digestNowShown(doc(['push', 'digest', 'digest_now'], false))).toBe(false);
    expect(digestNowShown(null)).toBe(false);
    expect(digestNowShown(undefined)).toBe(false);
  });

  it('shown with push, the digest and digest_now', () => {
    expect(digestNowShown(doc(['push', 'digest', 'digest_now']))).toBe(true);
  });
});

describe('POST /api/v1/mobile/digest/now', () => {
  it('sends no body, with the bearer and the workspace header, and parses the 202', async () => {
    const { client, calls } = harness(() => jsonReply(202, QUEUED_BODY));
    await expect(sendDigestNow(client)).resolves.toEqual({ status: 'queued' });
    expect(calls).toHaveLength(1);
    const call = sent(calls[0]);
    expect(call.method).toBe('POST');
    expect(call.path).toBe('/api/v1/mobile/digest/now');
    expect(call.body).toBeUndefined();
    expect(calls[0]?.headers).toMatchObject({
      Authorization: 'Bearer jwt.token.value',
      'X-Workspace-ID': WS,
    });
  });

  it('a 202 that is not {status: queued} is an answer this version cannot read', async () => {
    const { client } = harness(() => jsonReply(202, { status: 'done' }));
    await expect(sendDigestNow(client)).rejects.toMatchObject({ kind: 'invalid_response' });
  });
});

describe('what the answer becomes', () => {
  it('202: queued', async () => {
    await expect(outcomeFor(202, QUEUED_BODY)).resolves.toEqual({ kind: 'queued' });
  });

  it("429: retry_after_seconds parsed by the client's zod schema, beside the detail or in it", async () => {
    await expect(outcomeFor(429, RATE_LIMITED(240))).resolves.toEqual({
      kind: 'rate_limited',
      retryAfterSeconds: 240,
    });
    await expect(outcomeFor(429, { detail: RATE_LIMITED(90) })).resolves.toEqual({
      kind: 'rate_limited',
      retryAfterSeconds: 90,
    });
  });

  it('429 with no usable retry_after_seconds still waits, with no number', async () => {
    for (const seconds of ['240', -5, null, undefined]) {
      await expect(outcomeFor(429, RATE_LIMITED(seconds))).resolves.toEqual({
        kind: 'rate_limited',
        retryAfterSeconds: null,
      });
    }
    const { client } = harness(() => reply(429, 'Too Many Requests'));
    await expect(answerOf(() => sendDigestNow(client))).resolves.toEqual({
      kind: 'rate_limited',
      retryAfterSeconds: null,
    });
  });

  it('503 digest_unavailable: unavailable', async () => {
    await expect(outcomeFor(503, { code: 'digest_unavailable' })).resolves.toEqual({
      kind: 'unavailable',
    });
    await expect(outcomeFor(503, { detail: { code: 'digest_unavailable' } })).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it("any other failure: the taxonomy's plain line", async () => {
    await expect(outcomeFor(500, { detail: 'Traceback: boom' })).resolves.toEqual({
      kind: 'failed',
      line: API_ERROR_COPY.server,
    });
    await expect(outcomeFor(503, {})).resolves.toEqual({
      kind: 'failed',
      line: API_ERROR_COPY.server,
    });
    await expect(outcomeFor(403, {})).resolves.toEqual({
      kind: 'failed',
      line: API_ERROR_COPY.forbidden,
    });
    expect(outcomeOfError(new ApiError('network'))).toEqual({
      kind: 'failed',
      line: API_ERROR_COPY.network,
    });
    expect(outcomeOfError(new TypeError('boom'))).toEqual({
      kind: 'failed',
      line: API_ERROR_COPY.server,
    });
  });
});

describe('the words of a refusal', () => {
  it('429: "Try again in N minutes", rounded up, never under one', () => {
    const line = (seconds: number | null) =>
      refusalLine({ kind: 'rate_limited', retryAfterSeconds: seconds });
    expect(line(240)).toBe('Try again in 4 minutes.');
    expect(line(241)).toBe('Try again in 5 minutes.');
    expect(line(61)).toBe('Try again in 2 minutes.');
    expect(line(60)).toBe('Try again in 1 minute.');
    expect(line(1)).toBe('Try again in 1 minute.');
    expect(line(0)).toBe('Try again in 1 minute.');
    expect(line(null)).toBe(PUSH_DIGEST_NOW_COPY.tryAgainSoon);
  });

  it('503 and other failures: one plain line, no status code', () => {
    expect(refusalLine({ kind: 'unavailable' })).toBe(PUSH_DIGEST_NOW_COPY.unavailable);
    expect(refusalLine({ kind: 'failed', line: API_ERROR_COPY.network })).toBe(
      API_ERROR_COPY.network,
    );
    for (const copy of [PUSH_DIGEST_NOW_COPY.unavailable, PUSH_DIGEST_NOW_COPY.tryAgainSoon]) {
      expect(copy).not.toMatch(/\d/);
    }
  });
});

describe('the double-tap guard', () => {
  it('a second tap while the POST is out sends nothing', async () => {
    const store = createDigestNowStore(() => T0);
    const { send, settle } = deferredSend();
    const first = store.press(send);
    const second = store.press(send);
    expect(send).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBeNull();
    expect(store.current().sending).toBe(true);
    expect(digestNowView(store.current(), T0)).toMatchObject({ busy: true, line: null });
    settle();
    await expect(first).resolves.toEqual({ kind: 'queued' });
    expect(store.current().sending).toBe(false);
  });

  it('busy clears after a refusal too, and the next tap sends again', async () => {
    const store = createDigestNowStore(() => T0);
    const { send, settle } = deferredSend();
    const first = store.press(send);
    settle(new ApiError('server', { status: 500 }));
    await expect(first).resolves.toEqual({ kind: 'failed', line: API_ERROR_COPY.server });
    expect(store.current().sending).toBe(false);
    expect(canSend(store.current(), T0)).toBe(true);
    void store.press(send);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('tells its listeners at the start and at the answer; a removed listener hears nothing', async () => {
    const store = createDigestNowStore(() => T0);
    const heard = vi.fn();
    const gone = vi.fn();
    store.subscribe(heard);
    store.subscribe(gone)();
    await store.press(async () => undefined);
    expect(heard).toHaveBeenCalledTimes(2);
    expect(gone).not.toHaveBeenCalled();
  });
});

describe('the wait after a 202', () => {
  it('disabled for 5 minutes, sending nothing, with the minutes left read out', async () => {
    const { clock, advance } = clockAt(T0);
    const store = createDigestNowStore(clock);
    const send = vi.fn(async () => undefined);
    await expect(store.press(send)).resolves.toEqual({ kind: 'queued' });
    expect(store.current().waitUntil).toBe(T0 + DIGEST_NOW_WAIT_MS);
    expect(digestNowView(store.current(), clock())).toEqual({
      label: "Send today's brief now",
      busy: false,
      disabled: true,
      accessibilityLabel: "Send today's brief now. You can send another in 5 minutes.",
      line: 'Sent. You can send another in 5 minutes.',
      lineHidden: true,
    });
    advance(DIGEST_NOW_WAIT_MS - MS_PER_MINUTE - 1);
    expect(digestNowView(store.current(), clock()).accessibilityLabel).toBe(
      "Send today's brief now. You can send another in 2 minutes.",
    );
    advance(1);
    expect(digestNowView(store.current(), clock()).accessibilityLabel).toBe(
      "Send today's brief now. You can send another in 1 minute.",
    );
    await expect(store.press(send)).resolves.toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('ends at 5 minutes: enabled again, no line, and a tap sends', async () => {
    const { clock, advance } = clockAt(T0);
    const store = createDigestNowStore(clock);
    const send = vi.fn(async () => undefined);
    await store.press(send);
    advance(DIGEST_NOW_WAIT_MS);
    expect(digestNowView(store.current(), clock())).toEqual({
      label: "Send today's brief now",
      busy: false,
      disabled: false,
      accessibilityLabel: "Send today's brief now",
      line: null,
      lineHidden: false,
    });
    await expect(store.press(send)).resolves.toEqual({ kind: 'queued' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("a 429 with retry_after_seconds waits that long, counting down like the 202's", async () => {
    const { clock, advance } = clockAt(T0);
    const store = createDigestNowStore(clock);
    const send = vi.fn(async () => {
      throw new ApiError('server', { status: 429, retryAfterSeconds: 200 });
    });
    await expect(store.press(send)).resolves.toEqual({
      kind: 'rate_limited',
      retryAfterSeconds: 200,
    });
    expect(store.current().waitUntil).toBe(T0 + 200_000);
    expect(digestNowView(store.current(), clock())).toEqual({
      label: "Send today's brief now",
      busy: false,
      disabled: true,
      accessibilityLabel: "Send today's brief now. Try again in 4 minutes.",
      line: 'Try again in 4 minutes.',
      lineHidden: true,
    });
    expect(nextChangeIn(store.current(), clock())).toBe(20_000);
    advance(150_000);
    expect(digestNowView(store.current(), clock())).toMatchObject({
      disabled: true,
      accessibilityLabel: "Send today's brief now. Try again in 1 minute.",
      line: 'Try again in 1 minute.',
    });
    await expect(store.press(send)).resolves.toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
    advance(50_000);
    expect(digestNowView(store.current(), clock())).toMatchObject({
      disabled: false,
      accessibilityLabel: "Send today's brief now",
      line: null,
    });
    await store.press(send);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('a 429 without retry_after_seconds starts no wait: its line, and the button stays enabled', async () => {
    const store = createDigestNowStore(() => T0);
    await store.press(async () => {
      throw new ApiError('server', { status: 429 });
    });
    expect(store.current().waitUntil).toBeNull();
    expect(digestNowView(store.current(), T0)).toMatchObject({
      disabled: false,
      line: PUSH_DIGEST_NOW_COPY.tryAgainSoon,
      lineHidden: false,
    });
  });

  it('a 503 or another failure keeps the wait as it was (none here)', () => {
    const failed = afterAnswer(startSending(DIGEST_NOW_IDLE), { kind: 'unavailable' }, T0);
    expect(failed.waitUntil).toBeNull();
    expect(digestNowView(failed, T0).disabled).toBe(false);
  });

  it("the next tap clears the last refusal's line while it is out", () => {
    const refused = afterAnswer(startSending(DIGEST_NOW_IDLE), { kind: 'unavailable' }, T0);
    expect(digestNowView(refused, T0).line).toBe(PUSH_DIGEST_NOW_COPY.unavailable);
    expect(digestNowView(startSending(refused), T0)).toMatchObject({ busy: true, line: null });
  });

  it("the clock wakes when the wait's minutes change, and stops once it ends", () => {
    const waiting = afterAnswer(DIGEST_NOW_IDLE, { kind: 'queued' }, T0);
    expect(nextChangeIn(DIGEST_NOW_IDLE, T0)).toBeNull();
    expect(nextChangeIn(waiting, T0)).toBe(MS_PER_MINUTE);
    expect(nextChangeIn(waiting, T0 + 1)).toBe(MS_PER_MINUTE - 1);
    expect(nextChangeIn(waiting, T0 + DIGEST_NOW_WAIT_MS - 10)).toBe(10);
    expect(nextChangeIn(waiting, T0 + DIGEST_NOW_WAIT_MS)).toBeNull();
  });

  it('every state is a new, frozen value', () => {
    const sending = startSending(DIGEST_NOW_IDLE);
    expect(sending).not.toBe(DIGEST_NOW_IDLE);
    expect(Object.isFrozen(sending)).toBe(true);
    expect(DIGEST_NOW_IDLE).toEqual({ sending: false, waitUntil: null, refusal: null });
    expect(Object.isFrozen(afterAnswer(sending, { kind: 'queued' }, T0))).toBe(true);
  });
});

describe('reset (the leaving: sign-out, an account or server switch, an ended session)', () => {
  it('clears the wait and the line, and tells the screen', async () => {
    const store = createDigestNowStore(() => T0);
    await store.press(async () => undefined);
    const heard = vi.fn();
    store.subscribe(heard);
    store.reset();
    expect(store.current()).toEqual(DIGEST_NOW_IDLE);
    expect(digestNowView(store.current(), T0)).toMatchObject({ disabled: false, line: null });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("drops an answer that lands after it: the next person's button is not held by it", async () => {
    const store = createDigestNowStore(() => T0);
    const { send, settle } = deferredSend();
    const sentByA = store.press(send);
    store.reset();
    settle();
    await expect(sentByA).resolves.toBeNull();
    expect(store.current()).toEqual(DIGEST_NOW_IDLE);
    const next = vi.fn(async () => undefined);
    await expect(store.press(next)).resolves.toEqual({ kind: 'queued' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
