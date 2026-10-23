// P001N-SEAM-1: the session's refusal channel tells each refusal once. The same ApiError reported
// twice (the launch client, then the mutation cache) is one telling; two refusals are two; an
// unsubscribed listener hears nothing.

import { describe, expect, it } from 'vitest';

import { errorFromResponse } from '../../api/errors';
import { createRefusals } from '../refusals';

const forbidden = () => errorFromResponse(403, JSON.stringify({ detail: 'Not allowed' }));

function listening() {
  const refusals = createRefusals();
  let heard = 0;
  const stop = refusals.listen(() => {
    heard += 1;
  });
  return { refusals, heard: () => heard, stop };
}

describe('the refusal channel', () => {
  it('tells a refusal once, however many times the same error is reported', () => {
    const { refusals, heard } = listening();
    const error = forbidden();
    expect(refusals.report(error)).toBe(true);
    expect(refusals.report(error)).toBe(false);
    expect(heard()).toBe(1);
  });

  it('tells each distinct refusal', () => {
    const { refusals, heard } = listening();
    refusals.report(forbidden());
    refusals.report(forbidden());
    expect(heard()).toBe(2);
  });

  it('tells every listener, and none once unsubscribed', () => {
    const { refusals, heard, stop } = listening();
    let second = 0;
    refusals.listen(() => {
      second += 1;
    });
    refusals.report(forbidden());
    stop();
    refusals.report(forbidden());
    expect(heard()).toBe(1);
    expect(second).toBe(2);
  });

  it('a report with nobody listening is still remembered, so a later listener is not told it', () => {
    const refusals = createRefusals();
    const error = forbidden();
    expect(refusals.report(error)).toBe(true);
    let heard = 0;
    refusals.listen(() => {
      heard += 1;
    });
    expect(refusals.report(error)).toBe(false);
    expect(heard).toBe(0);
  });

  it('a non-object refusal cannot be remembered, so it is told every time', () => {
    const { refusals, heard } = listening();
    refusals.report('forbidden');
    refusals.report('forbidden');
    expect(heard()).toBe(2);
  });
});
