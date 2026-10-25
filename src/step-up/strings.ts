// The step-up gate's copy (PRD-001 §4.11: one strings.ts per feature). Honest copy (D-FACE-ID):
// the check runs on this phone only, and every refusal says nothing was sent.

import type { Outcome, PromptedAction, Refusal } from './policy';

/** The line the system prompt shows under Face ID (iOS needs one: an empty reason is refused). */
export const STEP_UP_PROMPT_COPY: Readonly<Record<PromptedAction, string>> = Object.freeze({
  answer: "Confirm it's you to send your answer",
  approve_ticket: "Confirm it's you to approve this ticket",
  approve_plan: "Confirm it's you to approve this Mission plan",
  grant_tool: "Confirm it's you to allow this tool",
  approve_social: "Confirm it's you to approve this post",
  settings_off: "Confirm it's you to stop asking before approvals and answers",
});

/** The prompt's cancel button (D19: the passcode is the fallback, offered by the system). */
export const STEP_UP_CANCEL_LABEL = 'Cancel';

/** What the person sees after the prompt; only 'passed' lets the write go. */
export const STEP_UP_OUTCOME_COPY: Readonly<Record<Outcome, string>> = Object.freeze({
  passed: 'Confirmed.',
  cancelled: 'Cancelled. Nothing was sent.',
  failed: "That didn't match. Nothing was sent. Try again.",
  locked_out:
    'Face ID is locked after too many tries. Unlock your phone with its passcode, then try again. Nothing was sent.',
  unavailable: "This phone couldn't check it's you. Nothing was sent.",
});

/** The switch on Settings → Notifications (PRD-001 §4.7; US-014f renders it). */
export const STEP_UP_SETTING_COPY = Object.freeze({
  label: 'Face ID before approve or answer',
  detail:
    'Asks for Face ID, or your passcode, before you approve or answer in the app. Checked on this phone only.',
  noSecurity: 'This phone has no passcode or Face ID, so nothing is asked.',
});

/** Turning the switch off was refused: it stays on, and this line says why. */
export const STEP_UP_SETTING_REFUSAL_COPY: Readonly<Record<Refusal, string>> = Object.freeze({
  cancelled: 'Cancelled. Face ID before approve or answer is still on.',
  failed: "That didn't match. Face ID before approve or answer is still on.",
  locked_out:
    'Face ID is locked after too many tries. Unlock your phone with its passcode, then try again.',
  unavailable: "This phone couldn't check it's you. Face ID before approve or answer is still on.",
});
