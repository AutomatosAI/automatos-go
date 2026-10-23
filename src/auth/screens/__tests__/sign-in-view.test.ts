// What the sign-in screens show for a machine state: each code step's prompt, field and resend, the
// tone of a step's note, and the choice staying up while the passkey sheet is.

import { describe, expect, it } from 'vitest';

import {
  SECOND_FACTORS,
  needsDelivery,
  pendingState,
  type SignInState,
} from '../../sign-in-machine';
import { SECOND_FACTOR_PROMPTS, SIGN_IN_SCREEN_COPY } from '../../strings';
import { codeEntryFor, isChoice, noteTone } from '../sign-in-view';

const EMAIL = 'ada@example.com';

describe('codeEntryFor', () => {
  it('the email code: its prompt, a digit field, and Send a new code', () => {
    expect(codeEntryFor({ step: 'emailCode', identifier: EMAIL })).toEqual({
      prompt: SIGN_IN_SCREEN_COPY.emailCodePrompt,
      label: SIGN_IN_SCREEN_COPY.codeLabel,
      keyboard: 'number-pad',
      canResend: true,
    });
  });

  it.each(SECOND_FACTORS)('the %s second factor asks in its own words', (factor) => {
    const entry = codeEntryFor({ step: 'secondFactor', identifier: EMAIL, factor });
    expect(entry.prompt).toBe(SECOND_FACTOR_PROMPTS[factor]);
  });

  it('offers Send a new code only where Clerk delivers the code (email, text)', () => {
    const resendable = SECOND_FACTORS.filter(
      (factor) => codeEntryFor({ step: 'secondFactor', identifier: EMAIL, factor }).canResend,
    );
    expect(resendable).toEqual(['email_code', 'phone_code']);
    expect(resendable.every(needsDelivery)).toBe(true);
  });

  it('a backup code takes letters under its own label; every other code is digits', () => {
    const backup = codeEntryFor({ step: 'secondFactor', identifier: EMAIL, factor: 'backup_code' });
    expect(backup).toMatchObject({
      label: SIGN_IN_SCREEN_COPY.backupCodeLabel,
      keyboard: 'default',
      canResend: false,
    });
    for (const factor of ['email_code', 'phone_code', 'totp'] as const) {
      expect(codeEntryFor({ step: 'secondFactor', identifier: EMAIL, factor })).toMatchObject({
        label: SIGN_IN_SCREEN_COPY.codeLabel,
        keyboard: 'number-pad',
      });
    }
  });

  it('totp comes off the user’s own device: no resend', () => {
    expect(
      codeEntryFor({ step: 'secondFactor', identifier: EMAIL, factor: 'totp' }).canResend,
    ).toBe(false);
  });
});

describe('noteTone', () => {
  it('a refusal reads as a field error (accent)', () => {
    expect(noteTone({ tone: 'error', text: 'Incorrect code' })).toBe('accent');
  });

  it("'A new code is on its way' is muted", () => {
    expect(noteTone({ tone: 'info', text: 'A new code is on its way.' })).toBe('muted');
  });
});

describe('the pending snapshot (PasswordStep clears a refused password once per refusal)', () => {
  it('keeps the step and its note object while Sign in runs', () => {
    const state: SignInState = {
      step: 'password',
      identifier: EMAIL,
      note: { tone: 'error', text: 'Password is incorrect.' },
    };
    const pending = pendingState(state, { type: 'submitPassword', password: 'again' });
    expect(pending).toBe(state);
  });
});

describe('isChoice', () => {
  it('the choice, and the choice behind the passkey sheet', () => {
    expect(isChoice({ step: 'identify', identifier: '' })).toBe(true);
    expect(isChoice({ step: 'passkey', identifier: EMAIL })).toBe(true);
  });

  it('no other step', () => {
    const others: readonly SignInState[] = [
      { step: 'password', identifier: EMAIL },
      { step: 'emailCode', identifier: EMAIL },
      { step: 'secondFactor', identifier: EMAIL, factor: 'totp' },
      { step: 'complete' },
      { step: 'error', identifier: EMAIL, message: 'No.' },
    ];
    for (const state of others) expect(isChoice(state), state.step).toBe(false);
  });
});
