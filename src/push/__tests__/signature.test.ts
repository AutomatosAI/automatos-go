// The signature check (v2, KP6 = W2 K9) against the five cases this kit and W2 K9 both publish —
// the cases W2's ONE shared vector file must carry, so the app keeps no second vector file. Each
// case verifies at now = its iat with node:crypto as the digest; a change to any signed field, a
// version other than 2, an iat past either edge of the window, a malformed sig or a missing key
// fails, and nothing throws.

import { createHash, createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { PUSH_SIG_MAX_AGE_SECONDS, PUSH_SIG_MAX_FUTURE_SECONDS } from '../config';
import { signedMessage } from '../signature/canonical';
import type { Sha256 } from '../signature/hmac';
import { verifyPushSignature } from '../signature/verify';
import { IAT, WS } from './data-fixtures';

const KEY = 'prd266-test-vector-push-key';

const nodeSha256: Sha256 = async (bytes) =>
  new Uint8Array(createHash('sha256').update(bytes).digest());

const QUESTION = {
  v: 2,
  type: 'needs_answer',
  workspace_id: WS,
  notification_id: '1001',
  grant_id: '42',
  link_type: 'question',
  link_id: '42',
  ticket_number: '0419',
  question: 'Ship the Lisbon deck?',
  options: ['Yes', 'No', 'Later'],
  iat: IAT,
  sig: 'ebbf977c0e83aefa57f52a0559c6907b31be5ebb44112450b8b88c248f4080fa',
};

const CASES = [
  ['question-with-options', QUESTION],
  [
    'redacted-question',
    {
      v: 2,
      type: 'needs_answer',
      workspace_id: WS,
      notification_id: '1002',
      grant_id: '42',
      link_type: 'question',
      link_id: '42',
      ticket_number: '0419',
      iat: IAT,
      sig: '800c8568838c16721faf7e738b7d715f0730c3c7d5cefb9941ab76ba69e293d3',
    },
  ],
  [
    'review',
    {
      v: 2,
      type: 'review',
      workspace_id: WS,
      notification_id: '1003',
      link_type: 'task',
      link_id: '8812',
      ticket_number: '0419',
      iat: IAT,
      sig: '5f11674af935f0ab0a912494ca6502750354541c774c667934922177df07dc88',
    },
  ],
  [
    'auto-message',
    {
      v: 2,
      type: 'auto_message',
      workspace_id: WS,
      notification_id: '1004',
      link_type: 'chat',
      link_id: '0d9f2c51-7a43-4b8e-9c61-2e5f7a1b3c4d',
      iat: IAT,
      sig: '3e947349177d6ee98138bb05cc14112069522d3ba2c042d8f67ac18b22b02aa5',
    },
  ],
  [
    'unicode-question',
    {
      v: 2,
      type: 'needs_answer',
      workspace_id: WS,
      notification_id: '1005',
      grant_id: '7',
      link_type: 'question',
      link_id: '7',
      question: 'Publicar às 09:00 — café ☕?\nLinha "dois"',
      options: ['Sim', 'Não'],
      iat: IAT,
      sig: 'e0e3a50468bb5e8de2a97706037d82110e07d92d8f8dbb0cdca0de8e01442136',
    },
  ],
] as const;

function verify(payload: unknown, key: string | null | undefined = KEY, now = IAT) {
  return verifyPushSignature(payload, key, nodeSha256, now);
}

describe('the five published v2 cases (W2 K9)', () => {
  it('pins 2026-10-21T00:00:00Z as their iat', () => {
    expect(new Date(IAT * 1000).toISOString()).toBe('2026-10-21T00:00:00.000Z');
  });

  it.each(CASES)('%s verifies at now = its iat', async (_name, payload) => {
    await expect(verify(payload)).resolves.toBe(true);
  });

  it.each(CASES)('%s: node:crypto createHmac over the message gives its sig', (_name, payload) => {
    const sig = createHmac('sha256', Buffer.from(KEY, 'utf8'))
      .update(Buffer.from(signedMessage(payload), 'utf8'))
      .digest('hex');
    expect(sig).toBe(payload.sig);
  });

  it.each(CASES)('%s fails with another key', async (_name, payload) => {
    await expect(verify(payload, `${KEY}x`)).resolves.toBe(false);
  });
});

describe('a change to any signed field fails', () => {
  it.each([
    ['type', { type: 'review' }],
    ['workspace_id', { workspace_id: '5b0c4c8e-2f6a-4d3e-9a7b-1c2d3e4f5a6c' }],
    ['notification_id', { notification_id: '1009' }],
    ['notification_id removed', { notification_id: undefined }],
    ['grant_id', { grant_id: '43' }],
    ['link_type', { link_type: 'task' }],
    ['link_id', { link_id: '43' }],
    ['ticket_number', { ticket_number: '419' }],
    ['question', { question: 'Ship the Lisbon deck? ' }],
    ['question removed', { question: undefined }],
    ['an option', { options: ['Yes', 'No', 'Later!'] }],
    ['the options order', { options: ['No', 'Yes', 'Later'] }],
    ['an option removed', { options: ['Yes', 'No'] }],
    ['iat', { iat: IAT + 1 }],
  ])('%s', async (_field, change) => {
    await expect(verify({ ...QUESTION, ...change })).resolves.toBe(false);
  });

  it('an unsigned extra key does not change the message (unknown keys ignored)', async () => {
    await expect(verify({ ...QUESTION, badge: 3, sound: 'default' })).resolves.toBe(true);
  });
});

describe('versions and types', () => {
  it.each([
    ['v 1', { ...QUESTION, v: 1 }],
    ['v 3', { ...QUESTION, v: 3 }],
    ['v as a string', { ...QUESTION, v: '2' }],
    ['no v', { ...QUESTION, v: undefined }],
    ['a numeric grant_id', { ...QUESTION, grant_id: 42 }],
    ['a numeric ticket_number', { ...QUESTION, ticket_number: 419 }],
    ['a string iat', { ...QUESTION, iat: String(IAT) }],
    ['a non-string option', { ...QUESTION, options: ['Yes', 2, 'Later'] }],
  ])('%s is refused', async (_name, payload) => {
    await expect(verify(payload)).resolves.toBe(false);
  });

  it.each([null, undefined, 'a string', 42, [QUESTION]])('%j is no payload', async (payload) => {
    await expect(verify(payload)).resolves.toBe(false);
  });
});

describe('the freshness window (604800 s back, 300 s ahead)', () => {
  it('names the window W2 K9 names', () => {
    expect([PUSH_SIG_MAX_AGE_SECONDS, PUSH_SIG_MAX_FUTURE_SECONDS]).toEqual([604800, 300]);
  });

  it.each([
    ['exactly 604800 s old', IAT + PUSH_SIG_MAX_AGE_SECONDS, true],
    ['604801 s old', IAT + PUSH_SIG_MAX_AGE_SECONDS + 1, false],
    ['exactly 300 s ahead', IAT - PUSH_SIG_MAX_FUTURE_SECONDS, true],
    ['301 s ahead', IAT - PUSH_SIG_MAX_FUTURE_SECONDS - 1, false],
    ['a fractional now inside the window', IAT + 0.5, true],
  ])('an iat %s → %s', async (_when, now, expected) => {
    await expect(verify(QUESTION, KEY, now)).resolves.toBe(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('a clock reading of %s fails', async (now) => {
    await expect(verify(QUESTION, KEY, now)).resolves.toBe(false);
  });
});

describe('the sig and the key', () => {
  it.each([
    ['empty', ''],
    ['63 characters', QUESTION.sig.slice(1)],
    ['65 characters', `${QUESTION.sig}0`],
    ['upper case', QUESTION.sig.toUpperCase()],
    ['not hex', `${QUESTION.sig.slice(0, 63)}g`],
    ['one bit off', `${QUESTION.sig.slice(0, 63)}b`],
  ])('a sig that is %s fails', async (_form, sig) => {
    await expect(verify({ ...QUESTION, sig })).resolves.toBe(false);
  });

  it.each([
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
  ])('a missing key (%s) fails', async (_form, key) => {
    await expect(verifyPushSignature(QUESTION, key, nodeSha256, IAT)).resolves.toBe(false);
  });

  it('keys with the push_key as UTF-8, never base64-decoded', async () => {
    // W1 mints secrets.token_urlsafe(32): 43 URL-safe characters that also read as base64.
    const pushKey = 'mF3k2b9QxV0aZpL7c1YdR8sTnUwE4gHjK6oPqXyBvC5';
    const sign = (key: Buffer) =>
      createHmac('sha256', key).update(signedMessage(QUESTION), 'utf8').digest('hex');
    const asText = { ...QUESTION, sig: sign(Buffer.from(pushKey, 'utf8')) };
    const asBase64 = { ...QUESTION, sig: sign(Buffer.from(pushKey, 'base64url')) };
    await expect(verify(asText, pushKey)).resolves.toBe(true);
    await expect(verify(asBase64, pushKey)).resolves.toBe(false);
  });
});

describe('never throws', () => {
  it('a digest that rejects → false', async () => {
    const failing: Sha256 = () => Promise.reject(new Error('digest unavailable'));
    await expect(verifyPushSignature(QUESTION, KEY, failing, IAT)).resolves.toBe(false);
  });

  it('a digest that throws synchronously → false', async () => {
    const throwing: Sha256 = () => {
      throw new Error('native module missing');
    };
    await expect(verifyPushSignature(QUESTION, KEY, throwing, IAT)).resolves.toBe(false);
  });

  it('a digest of the wrong length → false', async () => {
    const short: Sha256 = async (bytes) => (await nodeSha256(bytes)).slice(0, 31);
    await expect(verifyPushSignature(QUESTION, KEY, short, IAT)).resolves.toBe(false);
  });
});
