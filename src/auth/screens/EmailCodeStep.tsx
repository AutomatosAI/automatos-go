// The email-code step: Clerk has emailed a sign-in code to the address; Verify signs in (or moves
// on to a second factor), Send a new code asks Clerk for another.

import type { SignInEvent, SignInState } from '../sign-in-machine';
import { CodeEntry } from './CodeEntry';

export type EmailCodeStepProps = {
  readonly state: Extract<SignInState, { step: 'emailCode' }>;
  readonly busy: boolean;
  readonly send: (event: SignInEvent) => void;
};

export function EmailCodeStep({ state, busy, send }: EmailCodeStepProps) {
  return <CodeEntry state={state} busy={busy} send={send} />;
}
