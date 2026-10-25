// The edge screens' copy (US-017f, D-NO-SIGNUP, D8): every string EDGE_COPY holds — each function
// called with sample words — and every edge view's words are free of a pointer to making an
// account and of plans, credits and prices.

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../../api/errors';
import { EDGE_COPY } from '../../strings';
import { STARTERS, notRunningEdge, somethingWrongEdge } from '../edges';

const SIGN_UP = /sign[ -]?up|create (an|one|your) account|no account|register|join now/i;
const BILLING = /plan\b(?! my)|plans|credit|pric|upgrade|subscri|billing|trial|\$|£|€/i;
const SAMPLE = 'example.com';

/** Every string under a copy object, its functions called with sample words. */
function strings(value: unknown): readonly string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return strings((value as (...args: string[]) => unknown)(SAMPLE));
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const EDGE_STRINGS = [
  ...strings(EDGE_COPY),
  ...strings(notRunningEdge({ apiUrl: 'https://api.automatos.app', source: 'hosted' })),
  ...strings(notRunningEdge({ apiUrl: 'http://192.168.1.20:8000', source: 'own' })),
  ...strings(somethingWrongEdge(new ApiError('server'))),
  ...strings(STARTERS),
];

describe('the edge copy', () => {
  it('reaches every string (the walk is not empty)', () => {
    expect(EDGE_STRINGS.length).toBeGreaterThan(30);
    expect(EDGE_STRINGS).toContain('This page wandered off.');
  });

  it('never points at making an account (D-NO-SIGNUP)', () => {
    const found = EDGE_STRINGS.filter((text) => SIGN_UP.test(text));
    expect(found).toEqual([]);
  });

  it('says nothing about plans, credits or prices (D8)', () => {
    const found = EDGE_STRINGS.filter((text) => BILLING.test(text));
    expect(found).toEqual([]);
  });

  it('catches the phrases it guards against', () => {
    for (const text of ['Sign up', 'Create an account', 'No account? Join', 'signup']) {
      expect({ text, caught: SIGN_UP.test(text) }).toEqual({ text, caught: true });
    }
    for (const text of ['Upgrade your plan', '10 credits', 'Pricing']) {
      expect({ text, caught: BILLING.test(text) }).toEqual({ text, caught: true });
    }
  });
});
