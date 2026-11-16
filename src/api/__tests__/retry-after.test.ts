import { describe, expect, it } from 'vitest';

import { RETRY_AFTER_MAX_MS } from '../config';
import {
  boundedRetryAfterSeconds,
  headerWaitMs,
  httpDateMs,
  limitWaitMs,
  saneWaitMs,
} from '../retry-after';

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);
const MINUTE = 60_000;

describe('Retry-After as a wait', () => {
  it('reads whole seconds, with the space a header may carry', () => {
    expect(headerWaitMs('120', NOW)).toBe(2 * MINUTE);
    expect(headerWaitMs(' 0 ', NOW)).toBe(0);
    expect(headerWaitMs('60', undefined)).toBe(MINUTE);
  });

  it('reads an HTTP date against the clock it is given', () => {
    expect(headerWaitMs('Sun, 15 Nov 2026 12:05:00 GMT', NOW)).toBe(5 * MINUTE);
    expect(headerWaitMs('Sun, 15 Nov 2026 12:00:30 GMT', NOW)).toBe(30_000);
  });

  it('cannot read a date without a clock', () => {
    expect(headerWaitMs('Sun, 15 Nov 2026 12:05:00 GMT', undefined)).toBeNull();
  });

  it('is unknown when missing or unparseable', () => {
    for (const header of [null, undefined, '', 'soon', '1.5', '2e3', '0x10', '60 seconds']) {
      expect(headerWaitMs(header, NOW)).toBeNull();
    }
  });

  it('is unknown when negative: a sign, or a date already past', () => {
    expect(headerWaitMs('-5', NOW)).toBeNull();
    expect(headerWaitMs('Sun, 15 Nov 2026 11:59:00 GMT', NOW)).toBeNull();
  });

  it('is unknown when absurd: further off than a day', () => {
    expect(headerWaitMs(String(RETRY_AFTER_MAX_MS / 1000), NOW)).toBe(RETRY_AFTER_MAX_MS);
    expect(headerWaitMs(String(RETRY_AFTER_MAX_MS / 1000 + 1), NOW)).toBeNull();
    expect(headerWaitMs('9999999999', NOW)).toBeNull();
    expect(headerWaitMs('Mon, 16 Nov 2026 12:00:01 GMT', NOW)).toBeNull();
  });
});

describe('httpDateMs', () => {
  it('reads the IMF-fixdate a server sends', () => {
    expect(httpDateMs('Sun, 06 Nov 1994 08:49:37 GMT')).toBe(Date.UTC(1994, 10, 6, 8, 49, 37));
  });

  it('refuses another form, a day that does not exist and a time out of range', () => {
    for (const text of [
      'Sunday, 06-Nov-94 08:49:37 GMT',
      'Sun Nov  6 08:49:37 1994',
      '2026-11-15T12:00:00Z',
      'Sun, 31 Feb 2026 08:49:37 GMT',
      'Sun, 06 Nov 1994 24:00:00 GMT',
      'Sun, 06 Nov 1994 08:60:00 GMT',
      'Sun, 06 Nov 1994 08:49:37 UTC',
      'Sun, 06 Foo 1994 08:49:37 GMT',
    ]) {
      expect(httpDateMs(text), text).toBeNull();
    }
  });
});

describe('limitWaitMs', () => {
  it('takes the header first, then the body', () => {
    expect(limitWaitMs('30', 600, NOW)).toBe(30_000);
    expect(limitWaitMs(null, 600, NOW)).toBe(10 * MINUTE);
    expect(limitWaitMs('later', 90, NOW)).toBe(90_000);
  });

  it('believes no body wait past the cap, and none at all when neither says', () => {
    expect(limitWaitMs(null, RETRY_AFTER_MAX_MS, NOW)).toBeNull();
    expect(limitWaitMs(null, undefined, NOW)).toBeNull();
  });

  it('saneWaitMs keeps a wait from now up to the cap only', () => {
    expect([0, 1, RETRY_AFTER_MAX_MS].map(saneWaitMs)).toEqual([0, 1, RETRY_AFTER_MAX_MS]);
    expect(
      [-1, RETRY_AFTER_MAX_MS + 1, Number.NaN, Infinity, null, undefined].map(saneWaitMs),
    ).toEqual([null, null, null, null, null, null]);
  });
});

describe('boundedRetryAfterSeconds', () => {
  it('keeps a wait from now up to a day, and nothing else', () => {
    expect([0, 12.5, RETRY_AFTER_MAX_MS / 1000].map(boundedRetryAfterSeconds)).toEqual([
      0,
      12.5,
      RETRY_AFTER_MAX_MS / 1000,
    ]);
    expect(
      [RETRY_AFTER_MAX_MS / 1000 + 1, 1e12, -1, Number.NaN, Infinity, null, undefined].map(
        boundedRetryAfterSeconds,
      ),
    ).toEqual([null, null, null, null, null, null, null]);
  });
});
