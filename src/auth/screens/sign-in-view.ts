// What the sign-in screens show for a machine state, pure (D-PURE): the code step's prompt, field
// and resend; the tone of a step's note; whether the choice is waiting on the passkey sheet. The
// components in this folder only wire these to the primitives.

import {
  needsDelivery,
  type SecondFactor,
  type SignInNote,
  type SignInState,
} from '../sign-in-machine';
import { SECOND_FACTOR_PROMPTS, SIGN_IN_SCREEN_COPY } from '../strings';

export type CodeStepState = Extract<SignInState, { step: 'emailCode' | 'secondFactor' }>;

export type CodeKeyboard = 'number-pad' | 'default';

export type CodeEntry = {
  readonly prompt: string;
  readonly label: string;
  /** Sent and authenticator codes are digits; backup codes carry letters. */
  readonly keyboard: CodeKeyboard;
  /** Send a new code: only where Clerk delivers the code (email or text). */
  readonly canResend: boolean;
};

const DIGITS: CodeKeyboard = 'number-pad';

function secondFactorEntry(factor: SecondFactor): CodeEntry {
  const backup = factor === 'backup_code';
  return {
    prompt: SECOND_FACTOR_PROMPTS[factor],
    label: backup ? SIGN_IN_SCREEN_COPY.backupCodeLabel : SIGN_IN_SCREEN_COPY.codeLabel,
    keyboard: backup ? 'default' : DIGITS,
    canResend: needsDelivery(factor),
  };
}

/** The email-code step (a first factor) or the second-factor step, by its strategy. */
export function codeEntryFor(state: CodeStepState): CodeEntry {
  if (state.step === 'secondFactor') return secondFactorEntry(state.factor);
  return {
    prompt: SIGN_IN_SCREEN_COPY.emailCodePrompt,
    label: SIGN_IN_SCREEN_COPY.codeLabel,
    keyboard: DIGITS,
    canResend: true,
  };
}

export type NoteTone = 'accent' | 'muted';

/** A refusal reads as a field error does (accent); 'A new code is on its way' is muted. */
export function noteTone(note: SignInNote): NoteTone {
  return note.tone === 'error' ? 'accent' : 'muted';
}

/**
 * The choice stays on screen while the passkey sheet is up (step 'passkey'), so the address typed
 * there survives a cancel; its passkey button shows busy.
 */
export function isChoice(
  state: SignInState,
): state is Extract<SignInState, { step: 'identify' | 'passkey' }> {
  return state.step === 'identify' || state.step === 'passkey';
}
