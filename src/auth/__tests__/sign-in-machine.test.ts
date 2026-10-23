// The step machine's flows over a fake of Clerk's signIn: password, email code, passkey, every
// second factor, and finalize only once Clerk reads 'complete'. The store the screen holds (one
// event at a time, listeners, ignored events) is in sign-in-machine.store.test.ts.

import type { useSignIn } from '@clerk/expo';
import { describe, expect, it } from 'vitest';

import {
  needsDelivery,
  pickSecondFactor,
  SECOND_FACTORS,
  transition,
  type SignInPort,
} from '../sign-in-machine';
import { SIGN_IN_COPY } from '../strings';
import {
  EMAIL,
  fakeClerk,
  finalizedAfter,
  PASSWORD,
  refusal,
  run,
  VERIFY_METHOD,
  webAuthnError,
} from './fake-sign-in';

// Compile-time: @clerk/expo's signals sign-in resource IS a SignInPort, so the screen passes
// useSignIn().signIn straight in. npm run typecheck fails here if Clerk's shape moves.
type ClerkSignIn = ReturnType<typeof useSignIn>['signIn'];
const clerkFitsThePort = (signIn: ClerkSignIn): SignInPort => signIn;

describe('the sign-in machine: password', () => {
  it("Clerk's resource fits the port as it is (no adapter)", () => {
    expect(typeof clerkFitsThePort).toBe('function');
  });

  it('signs in: the trimmed address, the password as typed, then finalize', async () => {
    const port = fakeClerk();
    const { state, busy } = await run(port, PASSWORD);
    expect(state).toEqual({ step: 'complete' });
    expect(busy).toBe(false);
    expect(port.password).toHaveBeenCalledWith({ identifier: EMAIL, password: ' s3cret pass ' });
    expect(port.finalize).toHaveBeenCalledTimes(1);
  });

  it('choosing password with no address stays on the choice and asks for it', async () => {
    const { state } = await run(fakeClerk(), [{ type: 'choosePassword', identifier: '  ' }]);
    expect(state).toEqual({
      step: 'identify',
      identifier: '',
      note: { tone: 'error', text: SIGN_IN_COPY.needEmail },
    });
  });

  it('an empty password asks for it and calls nothing', async () => {
    const port = fakeClerk();
    const { state } = await run(port, [PASSWORD[0], { type: 'submitPassword', password: '' }]);
    expect(state).toMatchObject({ step: 'password', note: { text: SIGN_IN_COPY.needPassword } });
    expect(port.password).not.toHaveBeenCalled();
  });

  it("a wrong password stays on the step in Clerk's words, never finalizing", async () => {
    const port = fakeClerk();
    port.password.mockImplementationOnce(async () => ({
      error: refusal('form_password_incorrect', 'Password is incorrect. Try again.'),
    }));
    const { state } = await run(port, PASSWORD);
    expect(state).toEqual({
      step: 'password',
      identifier: EMAIL,
      note: { tone: 'error', text: 'Password is incorrect. Try again.' },
    });
    expect(port.finalize).not.toHaveBeenCalled();
  });

  it("an unknown account is refused in Clerk's words: there is no sign-up step", async () => {
    const port = fakeClerk();
    port.password.mockImplementationOnce(async () => ({
      error: refusal('form_identifier_not_found', "Couldn't find your account."),
    }));
    const { state, seen } = await run(port, PASSWORD);
    expect(state).toMatchObject({
      step: 'password',
      note: { text: "Couldn't find your account." },
    });
    const steps = new Set(seen.map((shown) => shown.step));
    expect([...steps].every((step) => step === 'password' || step === 'identify')).toBe(true);
  });
});

describe('the sign-in machine: email code', () => {
  it('sends a code to the trimmed address, then verifies it and signs in', async () => {
    const port = fakeClerk();
    const sent = await run(port, [{ type: 'sendEmailCode', identifier: ` ${EMAIL}` }]);
    expect(sent.state).toEqual({ step: 'emailCode', identifier: EMAIL });
    expect(port.emailCode.sendCode).toHaveBeenCalledWith({ emailAddress: EMAIL });
    expect(port.finalize).not.toHaveBeenCalled();

    const done = await transition(port, sent.state, { type: 'verifyCode', code: ' 123456 ' });
    expect(done).toEqual({ step: 'complete' });
    expect(port.emailCode.verifyCode).toHaveBeenCalledWith({ code: '123456' });
    expect(finalizedAfter(port, port.emailCode.verifyCode)).toBe(true);
  });

  it('a refused send stays on the choice with the address kept', async () => {
    const port = fakeClerk();
    port.emailCode.sendCode.mockImplementationOnce(async () => ({
      error: refusal('form_identifier_not_found', "Couldn't find your account."),
    }));
    const { state } = await run(port, [{ type: 'sendEmailCode', identifier: EMAIL }]);
    expect(state).toEqual({
      step: 'identify',
      identifier: EMAIL,
      note: { tone: 'error', text: "Couldn't find your account." },
    });
  });

  it('an empty address asks for it and sends nothing', async () => {
    const port = fakeClerk();
    const { state } = await run(port, [{ type: 'sendEmailCode', identifier: '' }]);
    expect(state).toMatchObject({ step: 'identify', note: { text: SIGN_IN_COPY.needEmail } });
    expect(port.emailCode.sendCode).not.toHaveBeenCalled();
  });

  it('Send a new code sends again for the same sign-in and says so', async () => {
    const port = fakeClerk();
    const { state } = await run(port, [
      { type: 'sendEmailCode', identifier: EMAIL },
      { type: 'resendCode' },
    ]);
    expect(port.emailCode.sendCode).toHaveBeenCalledTimes(2);
    expect(port.emailCode.sendCode).toHaveBeenLastCalledWith();
    expect(state).toEqual({
      step: 'emailCode',
      identifier: EMAIL,
      note: { tone: 'info', text: SIGN_IN_COPY.codeResent },
    });
  });

  it('a wrong code stays on the step, and the right one then signs in', async () => {
    const port = fakeClerk();
    port.emailCode.verifyCode.mockImplementationOnce(async () => ({
      error: refusal('form_code_incorrect', 'Incorrect code'),
    }));
    const wrong = await run(port, [
      { type: 'sendEmailCode', identifier: EMAIL },
      { type: 'verifyCode', code: '000000' },
    ]);
    expect(wrong.state).toMatchObject({ step: 'emailCode', note: { text: 'Incorrect code' } });
    expect(port.finalize).not.toHaveBeenCalled();
    const right = await transition(port, wrong.state, { type: 'verifyCode', code: '123456' });
    expect(right).toEqual({ step: 'complete' });
  });

  it('an empty code asks for it and verifies nothing', async () => {
    const port = fakeClerk();
    const { state } = await run(port, [
      { type: 'sendEmailCode', identifier: EMAIL },
      { type: 'verifyCode', code: ' ' },
    ]);
    expect(state).toMatchObject({ step: 'emailCode', note: { text: SIGN_IN_COPY.needCode } });
    expect(port.emailCode.verifyCode).not.toHaveBeenCalled();
  });
});

describe('the sign-in machine: passkey', () => {
  it('shows the passkey step while the sheet is up, then signs in', async () => {
    const port = fakeClerk();
    const { state, seen } = await run(port, [{ type: 'usePasskey' }]);
    expect(seen[0]).toEqual({ step: 'passkey', identifier: '' });
    expect(state).toEqual({ step: 'complete' });
    expect(port.passkey).toHaveBeenCalledWith({ flow: 'discoverable' });
    expect(finalizedAfter(port, port.passkey)).toBe(true);
  });

  it.each([
    'passkey_registration_cancelled',
    'passkey_retrieval_cancelled',
    'passkey_operation_aborted',
  ])('a closed sheet (%s) goes back to the choice with no note and no finalize', async (code) => {
    const port = fakeClerk();
    port.passkey.mockImplementationOnce(async () => ({ error: webAuthnError(code) }));
    const { state } = await run(port, [{ type: 'usePasskey' }]);
    expect(state).toEqual({ step: 'identify', identifier: '' });
    expect(port.finalize).not.toHaveBeenCalled();
  });

  it('a phone without passkeys (Clerk throws) says so plainly', async () => {
    const port = fakeClerk();
    port.passkey.mockImplementationOnce(async () => {
      throw webAuthnError('passkey_not_supported');
    });
    const { state } = await run(port, [{ type: 'usePasskey' }]);
    expect(state).toMatchObject({
      step: 'identify',
      note: { text: SIGN_IN_COPY.passkeyUnavailable },
    });
  });

  it("a failed passkey without Clerk words has honest copy; with words, Clerk's", async () => {
    const port = fakeClerk();
    port.passkey.mockImplementationOnce(async () => ({
      error: webAuthnError('passkey_retrieval_failed'),
    }));
    const failed = await run(port, [{ type: 'usePasskey' }]);
    expect(failed.state).toMatchObject({ note: { text: SIGN_IN_COPY.passkeyFailed } });

    port.passkey.mockImplementationOnce(async () => ({
      error: refusal('passkey_not_found', "This passkey isn't registered to an account."),
    }));
    const refused = await run(port, [{ type: 'usePasskey' }]);
    expect(refused.state).toMatchObject({
      note: { text: "This passkey isn't registered to an account." },
    });
  });
});

describe('the sign-in machine: second factor', () => {
  it.each(SECOND_FACTORS)(
    '%s: asks for it, verifies it, and only then finalizes',
    async (factor) => {
      const port = fakeClerk('needs_second_factor', [factor]);
      const asked = await run(port, PASSWORD);
      expect(asked.state).toEqual({ step: 'secondFactor', identifier: EMAIL, factor });
      expect(port.finalize).not.toHaveBeenCalled();
      expect(port.mfa.sendEmailCode).toHaveBeenCalledTimes(factor === 'email_code' ? 1 : 0);
      expect(port.mfa.sendPhoneCode).toHaveBeenCalledTimes(factor === 'phone_code' ? 1 : 0);

      const done = await transition(port, asked.state, { type: 'verifyCode', code: ' 424242 ' });
      const verify = port.mfa[VERIFY_METHOD[factor]];
      expect(done).toEqual({ step: 'complete' });
      expect(verify).toHaveBeenCalledWith({ code: '424242' });
      expect(finalizedAfter(port, verify)).toBe(true);
    },
  );

  it('needs_client_trust (a new device) asks for the second factor the same way', async () => {
    const port = fakeClerk('needs_client_trust', ['email_code']);
    const { state } = await run(port, PASSWORD);
    expect(state).toEqual({ step: 'secondFactor', identifier: EMAIL, factor: 'email_code' });
    expect(port.finalize).not.toHaveBeenCalled();
  });

  it('picks the first factor in the app order that the tenant offers', () => {
    expect(pickSecondFactor([{ strategy: 'backup_code' }, { strategy: 'totp' }])).toBe('totp');
    expect(pickSecondFactor([{ strategy: 'phone_code' }, { strategy: 'email_code' }])).toBe(
      'email_code',
    );
    expect(pickSecondFactor([])).toBeNull();
    expect(SECOND_FACTORS.filter(needsDelivery)).toEqual(['email_code', 'phone_code']);
  });

  it('a tenant offering only an unsupported factor gets the honest copy and no send', async () => {
    const port = fakeClerk('needs_second_factor', ['email_link', 'passkey']);
    const { state } = await run(port, PASSWORD);
    expect(state).toEqual({
      step: 'error',
      identifier: EMAIL,
      message: SIGN_IN_COPY.unsupportedFactor,
    });
    expect(port.mfa.sendEmailCode).not.toHaveBeenCalled();
    expect(port.finalize).not.toHaveBeenCalled();
  });

  it.each([
    ['email_code', 'sendEmailCode'],
    ['phone_code', 'sendPhoneCode'],
  ] as const)('%s: Send a new code sends again and says so', async (factor, send) => {
    const port = fakeClerk('needs_second_factor', [factor]);
    const { state } = await run(port, [...PASSWORD, { type: 'resendCode' }]);
    expect(port.mfa[send]).toHaveBeenCalledTimes(2);
    expect(state).toMatchObject({ factor, note: { tone: 'info', text: SIGN_IN_COPY.codeResent } });
  });

  it('totp and backup codes have nothing to resend', async () => {
    const port = fakeClerk('needs_second_factor', ['totp']);
    const asked = await run(port, PASSWORD);
    const after = await transition(port, asked.state, { type: 'resendCode' });
    expect(after).toBe(asked.state);
    expect(port.mfa.sendEmailCode).not.toHaveBeenCalled();
    expect(port.mfa.sendPhoneCode).not.toHaveBeenCalled();
  });

  it("a refused resend stays on the step in Clerk's words", async () => {
    const port = fakeClerk('needs_second_factor', ['phone_code']);
    const asked = await run(port, PASSWORD);
    port.mfa.sendPhoneCode.mockImplementationOnce(async () => ({
      error: refusal('too_many_requests', 'Too many requests. Try again in a bit.'),
    }));
    const after = await transition(port, asked.state, { type: 'resendCode' });
    expect(after).toMatchObject({
      step: 'secondFactor',
      note: { tone: 'error', text: 'Too many requests. Try again in a bit.' },
    });
  });

  it("a failed first send still shows the code step, with Clerk's words", async () => {
    const port = fakeClerk('needs_second_factor', ['email_code']);
    port.mfa.sendEmailCode.mockImplementationOnce(async () => ({
      error: refusal('too_many_requests', 'Too many requests.'),
    }));
    const { state } = await run(port, PASSWORD);
    expect(state).toMatchObject({
      step: 'secondFactor',
      factor: 'email_code',
      note: { text: 'Too many requests.' },
    });
  });

  it('a wrong code stays on the step and never finalizes', async () => {
    const port = fakeClerk('needs_second_factor', ['totp']);
    port.mfa.verifyTOTP.mockImplementationOnce(async () => ({
      error: refusal('form_code_incorrect', 'Incorrect code'),
    }));
    const { state } = await run(port, [...PASSWORD, { type: 'verifyCode', code: '111111' }]);
    expect(state).toEqual({
      step: 'secondFactor',
      identifier: EMAIL,
      factor: 'totp',
      note: { tone: 'error', text: 'Incorrect code' },
    });
    expect(port.finalize).not.toHaveBeenCalled();
  });
});

describe('the sign-in machine: finalize and the way back', () => {
  it.each(['needs_new_password', 'needs_protect_check', 'needs_identifier'])(
    'a status outside sign-in (%s) ends in the honest error, never finalizing',
    async (status) => {
      const port = fakeClerk(status);
      const { state } = await run(port, PASSWORD);
      expect(state).toEqual({ step: 'error', identifier: EMAIL, message: SIGN_IN_COPY.incomplete });
      expect(port.finalize).not.toHaveBeenCalled();
    },
  );

  it("a refused finalize ends in Clerk's words", async () => {
    const port = fakeClerk();
    port.finalize.mockImplementationOnce(async () => ({
      error: refusal('session_exists', "You're already signed in."),
    }));
    const { state } = await run(port, PASSWORD);
    expect(state).toEqual({
      step: 'error',
      identifier: EMAIL,
      message: "You're already signed in.",
    });
  });

  it("Start again clears Clerk's attempt and keeps the address typed", async () => {
    const port = fakeClerk('needs_second_factor', ['totp']);
    const { state } = await run(port, [...PASSWORD, { type: 'startOver' }]);
    expect(port.reset).toHaveBeenCalledTimes(1);
    expect(state).toEqual({ step: 'identify', identifier: EMAIL });
  });

  it('Start again still goes back when Clerk cannot clear its attempt', async () => {
    const port = fakeClerk('needs_new_password');
    port.reset.mockImplementationOnce(async () => {
      throw new Error('reset failed');
    });
    const { state } = await run(port, [...PASSWORD, { type: 'startOver' }]);
    expect(state).toEqual({ step: 'identify', identifier: EMAIL });
  });
});
