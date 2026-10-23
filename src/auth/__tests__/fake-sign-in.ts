// A fake of Clerk's signals sign-in resource for the step machine's tests: every call answers OK
// and moves `status` the way Clerk does, so nothing loads @clerk/expo or reaches Clerk.

import { vi } from 'vitest';

import {
  createSignInMachine,
  type SecondFactor,
  type SignInEvent,
  type SignInPort,
  type SignInState,
} from '../sign-in-machine';

type Result = { readonly error: unknown };
const OK: Result = Object.freeze({ error: null });

/** A ClerkAPIResponseError as the FAPI answers a refused step: the words are in errors[]. */
export function refusal(code: string, longMessage: string) {
  return Object.assign(new Error('api_response_error'), {
    clerkError: true,
    code: 'api_response_error',
    status: 422,
    errors: [{ code, message: 'is incorrect', longMessage }],
  });
}

/** ClerkWebAuthnError: a code and a developer message, no words for the user. */
export function webAuthnError(code: string) {
  return Object.assign(new Error('The operation couldn’t be completed.'), {
    clerkError: true,
    code,
  });
}

/**
 * A stand-in for Clerk's signIn resource. A first factor moves `status` to afterFirstFactor and
 * a second factor to 'complete'; a test swaps a call's behaviour with mockImplementationOnce.
 * finalize refuses, as Clerk's does, unless the status reads 'complete'.
 */
export function fakeClerk(afterFirstFactor = 'complete', secondFactors: readonly string[] = []) {
  const port = {
    status: 'needs_identifier',
    supportedSecondFactors: secondFactors.map((strategy) => ({ strategy })),
    password: vi.fn(async (): Promise<Result> => firstFactor()),
    emailCode: {
      sendCode: vi.fn(async (): Promise<Result> => {
        port.status = 'needs_first_factor';
        return OK;
      }),
      verifyCode: vi.fn(async (): Promise<Result> => firstFactor()),
    },
    passkey: vi.fn(async (): Promise<Result> => firstFactor()),
    mfa: {
      sendEmailCode: vi.fn(async (): Promise<Result> => OK),
      sendPhoneCode: vi.fn(async (): Promise<Result> => OK),
      verifyEmailCode: vi.fn(async (): Promise<Result> => complete()),
      verifyPhoneCode: vi.fn(async (): Promise<Result> => complete()),
      verifyTOTP: vi.fn(async (): Promise<Result> => complete()),
      verifyBackupCode: vi.fn(async (): Promise<Result> => complete()),
    },
    finalize: vi.fn(async (): Promise<Result> => {
      if (port.status !== 'complete') {
        throw new Error('Cannot finalize sign-in without a created session');
      }
      return OK;
    }),
    reset: vi.fn(async (): Promise<Result> => OK),
  };
  function firstFactor(): Result {
    port.status = afterFirstFactor;
    return OK;
  }
  function complete(): Result {
    port.status = 'complete';
    return OK;
  }
  return port;
}

export type FakeClerk = ReturnType<typeof fakeClerk>;

/** Sends each event in turn; answers the last state and every state the screen was shown. */
export async function run(port: SignInPort, events: readonly SignInEvent[]) {
  const machine = createSignInMachine(() => port);
  const seen: SignInState[] = [];
  machine.subscribe(() => seen.push(machine.getSnapshot().state));
  for (const event of events) await machine.send(event);
  return { state: machine.getSnapshot().state, seen, busy: machine.getSnapshot().busy };
}

export const EMAIL = 'ada@example.com';

/** Choose password with the address padded, then a password with spaces (kept as typed). */
export const PASSWORD: readonly [SignInEvent, SignInEvent] = [
  { type: 'choosePassword', identifier: `  ${EMAIL} ` },
  { type: 'submitPassword', password: ' s3cret pass ' },
];

export const VERIFY_METHOD: Readonly<Record<SecondFactor, keyof FakeClerk['mfa']>> = {
  email_code: 'verifyEmailCode',
  phone_code: 'verifyPhoneCode',
  totp: 'verifyTOTP',
  backup_code: 'verifyBackupCode',
};

/** true when finalize ran, and ran after the last call of `call`. */
export function finalizedAfter(port: FakeClerk, call: { mock: { invocationCallOrder: number[] } }) {
  const [finalized] = port.finalize.mock.invocationCallOrder;
  const last = call.mock.invocationCallOrder.at(-1) ?? Infinity;
  return finalized !== undefined && finalized > last;
}
