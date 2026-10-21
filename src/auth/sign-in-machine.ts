// The sign-in step machine (PRD-001 §4.5, D-SIGNIN): identify → (emailCode | password | passkey) →
// secondFactor → complete | error. Pure TypeScript over SignInPort, the slice of @clerk/expo's
// signals sign-in (useSignIn().signIn, SignInFutureResource) the screens use; that resource fits
// the port as it is, so the screen passes it straight in. Ported from the academy's step machine
// (academy-app app/sign-in.tsx: pickSecondFactor, needsDelivery, advance) without its social and
// Apple branches (D6), and with no sign-up transition: an unknown account is Clerk's refusal, shown
// in Clerk's words (server-words.ts).
//
// finalize() runs only once Clerk reads 'complete'; earlier it throws "Cannot finalize sign-in
// without a created session", which is how a tenant-required second factor once surfaced as a dead
// end. 'needs_client_trust' (a new device under Device Trust) asks for a second factor the same way.
// A Clerk call either returns { error } or throws (passkeys unsupported, a missing identifier):
// both land on the step as the error's words, and the machine itself never throws.

import { logger } from '../lib/logger';
import { clerkCode, clerkWords, serverWords } from './server-words';
import { SIGN_IN_COPY } from './strings';

/** Second-factor strategies the app has a screen for, in preference order. */
export const SECOND_FACTORS = ['email_code', 'phone_code', 'totp', 'backup_code'] as const;
export type SecondFactor = (typeof SECOND_FACTORS)[number];

type ClerkResult = Promise<{ readonly error: unknown }>;
type CodeParams = { readonly code: string };

export interface SignInPort {
  /** Read after every call: Clerk's resource answers its latest status. */
  readonly status: string;
  readonly supportedSecondFactors?: readonly { readonly strategy: string }[] | null;
  password(params: { identifier: string; password: string }): ClerkResult;
  readonly emailCode: {
    /** With an address: starts a sign-in for it; without: sends again for the current one. */
    sendCode(params?: { emailAddress: string }): ClerkResult;
    verifyCode(params: CodeParams): ClerkResult;
  };
  passkey(params: { flow: 'discoverable' }): ClerkResult;
  readonly mfa: {
    sendEmailCode(): ClerkResult;
    sendPhoneCode(): ClerkResult;
    verifyEmailCode(params: CodeParams): ClerkResult;
    verifyPhoneCode(params: CodeParams): ClerkResult;
    verifyTOTP(params: CodeParams): ClerkResult;
    verifyBackupCode(params: CodeParams): ClerkResult;
  };
  finalize(): ClerkResult;
  reset(): ClerkResult;
}

export type SignInNote = { readonly tone: 'error' | 'info'; readonly text: string };

/** Every step but complete keeps the address typed, so starting again starts from it. */
export type SignInState =
  | { readonly step: 'identify'; readonly identifier: string; readonly note?: SignInNote }
  | { readonly step: 'emailCode'; readonly identifier: string; readonly note?: SignInNote }
  | { readonly step: 'password'; readonly identifier: string; readonly note?: SignInNote }
  /** The system's passkey sheet is up. */
  | { readonly step: 'passkey'; readonly identifier: string }
  | {
      readonly step: 'secondFactor';
      readonly identifier: string;
      readonly factor: SecondFactor;
      readonly note?: SignInNote;
    }
  | { readonly step: 'complete' }
  /** Nothing more this sign-in can do: the screen offers Start again. */
  | { readonly step: 'error'; readonly identifier: string; readonly message: string };

export type SignInEvent =
  | { readonly type: 'sendEmailCode'; readonly identifier: string }
  | { readonly type: 'choosePassword'; readonly identifier: string }
  | { readonly type: 'usePasskey' }
  | { readonly type: 'submitPassword'; readonly password: string }
  | { readonly type: 'verifyCode'; readonly code: string }
  | { readonly type: 'resendCode' }
  | { readonly type: 'startOver' };

export const INITIAL_SIGN_IN: SignInState = Object.freeze({ step: 'identify', identifier: '' });

type Attempt = { readonly ok: true } | { readonly ok: false; readonly error: unknown };

async function attempt(call: () => ClerkResult): Promise<Attempt> {
  try {
    const { error } = await call();
    return error === null || error === undefined ? { ok: true } : { ok: false, error };
  } catch (error) {
    return { ok: false, error };
  }
}

/** The step's words for a refusal; the log gets Clerk's code only, never the address or a code. */
function refusal(error: unknown, words: string = serverWords(error)): SignInNote {
  logger.warn('[auth] a sign-in step was refused', clerkCode(error) ?? 'no code');
  return { tone: 'error', text: words };
}

function errorNote(text: string): SignInNote {
  return { tone: 'error', text };
}

/** The first strategy the tenant offers that the app has a screen for, else null. */
export function pickSecondFactor(
  supported: readonly { readonly strategy: string }[],
): SecondFactor | null {
  return SECOND_FACTORS.find((factor) => supported.some((f) => f.strategy === factor)) ?? null;
}

/** totp and backup codes come off the user's own device: nothing to send. */
export function needsDelivery(factor: SecondFactor): factor is 'email_code' | 'phone_code' {
  return factor === 'email_code' || factor === 'phone_code';
}

function deliver(port: SignInPort, factor: 'email_code' | 'phone_code'): Promise<Attempt> {
  return attempt(() =>
    factor === 'email_code' ? port.mfa.sendEmailCode() : port.mfa.sendPhoneCode(),
  );
}

const VERIFIERS: Readonly<Record<SecondFactor, (port: SignInPort, code: string) => ClerkResult>> =
  Object.freeze({
    email_code: (port, code) => port.mfa.verifyEmailCode({ code }),
    phone_code: (port, code) => port.mfa.verifyPhoneCode({ code }),
    totp: (port, code) => port.mfa.verifyTOTP({ code }),
    backup_code: (port, code) => port.mfa.verifyBackupCode({ code }),
  });

const SECOND_FACTOR_STATUSES: ReadonlySet<string> = new Set([
  'needs_second_factor',
  'needs_client_trust',
]);

async function startSecondFactor(port: SignInPort, identifier: string): Promise<SignInState> {
  const factor = pickSecondFactor(port.supportedSecondFactors ?? []);
  if (!factor) {
    logger.warn('[auth] the tenant offers no second factor this app supports');
    return { step: 'error', identifier, message: SIGN_IN_COPY.unsupportedFactor };
  }
  const sent = needsDelivery(factor) ? await deliver(port, factor) : { ok: true as const };
  // a failed send still shows the code step: Send a new code is the way on from there
  return sent.ok
    ? { step: 'secondFactor', identifier, factor }
    : { step: 'secondFactor', identifier, factor, note: refusal(sent.error) };
}

/** Drives whatever the sign-in still owes once a factor has been accepted. */
async function advance(port: SignInPort, identifier: string): Promise<SignInState> {
  const status = port.status;
  if (status === 'complete') {
    const finalized = await attempt(() => port.finalize());
    if (finalized.ok) return { step: 'complete' };
    return { step: 'error', identifier, message: refusal(finalized.error).text };
  }
  if (SECOND_FACTOR_STATUSES.has(status)) return startSecondFactor(port, identifier);
  logger.warn('[auth] sign-in stopped at a step this app does not handle', status);
  return { step: 'error', identifier, message: SIGN_IN_COPY.incomplete };
}

async function sendEmailCode(port: SignInPort, typed: string): Promise<SignInState> {
  const identifier = typed.trim();
  if (!identifier) return { step: 'identify', identifier, note: errorNote(SIGN_IN_COPY.needEmail) };
  const sent = await attempt(() => port.emailCode.sendCode({ emailAddress: identifier }));
  return sent.ok
    ? { step: 'emailCode', identifier }
    : { step: 'identify', identifier, note: refusal(sent.error) };
}

function choosePassword(typed: string): SignInState {
  const identifier = typed.trim();
  return identifier
    ? { step: 'password', identifier }
    : { step: 'identify', identifier, note: errorNote(SIGN_IN_COPY.needEmail) };
}

async function submitPassword(
  port: SignInPort,
  state: Extract<SignInState, { step: 'password' }>,
  password: string,
): Promise<SignInState> {
  const { identifier } = state;
  if (!password) return { ...state, note: errorNote(SIGN_IN_COPY.needPassword) };
  const result = await attempt(() => port.password({ identifier, password }));
  return result.ok ? advance(port, identifier) : { ...state, note: refusal(result.error) };
}

/** The codes Clerk gives a passkey sheet the user closed (native, then web). */
const PASSKEY_CANCELLED: ReadonlySet<string> = new Set([
  'passkey_registration_cancelled',
  'passkey_retrieval_cancelled',
  'passkey_operation_aborted',
]);
const PASSKEY_CODE_PREFIX = 'passkey_';

function passkeyWords(error: unknown, code: string | undefined): string {
  if (code === 'passkey_not_supported') return SIGN_IN_COPY.passkeyUnavailable;
  const words = clerkWords(error);
  if (words) return words;
  return code?.startsWith(PASSKEY_CODE_PREFIX) ? SIGN_IN_COPY.passkeyFailed : serverWords(error);
}

async function signInWithPasskey(port: SignInPort, identifier: string): Promise<SignInState> {
  const result = await attempt(() => port.passkey({ flow: 'discoverable' }));
  if (result.ok) return advance(port, identifier);
  const code = clerkCode(result.error);
  // closing the system sheet is the user's choice, not a failure: back to the choice, no note
  if (code && PASSKEY_CANCELLED.has(code)) return { step: 'identify', identifier };
  return {
    step: 'identify',
    identifier,
    note: refusal(result.error, passkeyWords(result.error, code)),
  };
}

type CodeStep = Extract<SignInState, { step: 'emailCode' | 'secondFactor' }>;

async function verifyCode(port: SignInPort, state: CodeStep, typed: string): Promise<SignInState> {
  const code = typed.trim();
  if (!code) return { ...state, note: errorNote(SIGN_IN_COPY.needCode) };
  const result = await attempt(() =>
    state.step === 'emailCode'
      ? port.emailCode.verifyCode({ code })
      : VERIFIERS[state.factor](port, code),
  );
  return result.ok ? advance(port, state.identifier) : { ...state, note: refusal(result.error) };
}

function withSent(state: CodeStep, sent: Attempt): SignInState {
  const note: SignInNote = sent.ok
    ? { tone: 'info', text: SIGN_IN_COPY.codeResent }
    : refusal(sent.error);
  return { ...state, note };
}

async function resendCode(port: SignInPort, state: CodeStep): Promise<SignInState> {
  if (state.step === 'emailCode')
    return withSent(state, await attempt(() => port.emailCode.sendCode()));
  if (!needsDelivery(state.factor)) return state;
  return withSent(state, await deliver(port, state.factor));
}

function identifierOf(state: SignInState): string {
  return state.step === 'complete' ? '' : state.identifier;
}

/** Clears Clerk's attempt (local state only, no request) and goes back to the choice. */
async function startOver(port: SignInPort, state: SignInState): Promise<SignInState> {
  const cleared = await attempt(() => port.reset());
  if (!cleared.ok) logger.warn('[auth] Clerk could not clear the sign-in attempt', cleared.error);
  return { step: 'identify', identifier: identifierOf(state) };
}

function isCodeStep(state: SignInState): state is CodeStep {
  return state.step === 'emailCode' || state.step === 'secondFactor';
}

/**
 * One event against one state. An event the state does not take (a code on the choice, anything
 * once complete) changes nothing and calls nothing.
 */
export async function transition(
  port: SignInPort,
  state: SignInState,
  event: SignInEvent,
): Promise<SignInState> {
  if (event.type === 'startOver') return startOver(port, state);
  if (state.step === 'identify') return fromIdentify(port, state, event);
  if (state.step === 'password' && event.type === 'submitPassword') {
    return submitPassword(port, state, event.password);
  }
  if (!isCodeStep(state)) return state;
  if (event.type === 'verifyCode') return verifyCode(port, state, event.code);
  return event.type === 'resendCode' ? resendCode(port, state) : state;
}

function fromIdentify(
  port: SignInPort,
  state: Extract<SignInState, { step: 'identify' }>,
  event: SignInEvent,
): SignInState | Promise<SignInState> {
  switch (event.type) {
    case 'sendEmailCode':
      return sendEmailCode(port, event.identifier);
    case 'choosePassword':
      return choosePassword(event.identifier);
    case 'usePasskey':
      return signInWithPasskey(port, state.identifier);
    default:
      return state;
  }
}

/** What the screen shows while an event runs: the passkey sheet has a step of its own. */
export function pendingState(state: SignInState, event: SignInEvent): SignInState {
  return state.step === 'identify' && event.type === 'usePasskey'
    ? { step: 'passkey', identifier: state.identifier }
    : state;
}

/** transition() catches every Clerk failure; this catches the rest, so busy always clears. */
async function settle(
  getPort: () => SignInPort,
  from: SignInState,
  event: SignInEvent,
): Promise<SignInState> {
  try {
    return await transition(getPort(), from, event);
  } catch (error) {
    logger.error('[auth] a sign-in step failed outside Clerk', error);
    return { step: 'error', identifier: identifierOf(from), message: serverWords(error) };
  }
}

export type SignInSnapshot = { readonly state: SignInState; readonly busy: boolean };

export type SignInMachine = {
  /** A new object on every change (useSyncExternalStore's contract). */
  readonly getSnapshot: () => SignInSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  /** Runs one event; while one runs, another is dropped (a double tap never sends twice). */
  readonly send: (event: SignInEvent) => Promise<void>;
};

/**
 * The step machine the screen holds. getPort answers the latest useSignIn().signIn; each event
 * reads it once and keeps it to the end, so a re-render mid-step never mixes two resources.
 */
export function createSignInMachine(getPort: () => SignInPort): SignInMachine {
  let snapshot: SignInSnapshot = Object.freeze({ state: INITIAL_SIGN_IN, busy: false });
  let listeners: readonly (() => void)[] = [];
  const publish = (state: SignInState, busy: boolean) => {
    snapshot = Object.freeze({ state, busy });
    for (const listener of listeners) listener();
  };
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((listed) => listed !== listener);
      };
    },
    send: async (event: SignInEvent) => {
      if (snapshot.busy) return;
      const from = snapshot.state;
      publish(pendingState(from, event), true);
      publish(await settle(getPort, from, event), false);
    },
  });
}
