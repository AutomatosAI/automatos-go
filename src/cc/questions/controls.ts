// A question card's controls, pure (handoff §2 'Questions', D-QUESTIONS): the offered options answer
// at once; 'Answer in your own words instead' opens the field and its Answer (always open when no
// option is offered); Dismiss first says what dismissing does, then Keep the question or Dismiss.
// While a call is out every control is disabled and the one sent shows busy. A role that may not
// answer gets no controls at all (the tab says why).

import { QUESTIONS_COPY } from '../strings';
import type { AnswerChoice } from './answer';

/** What is on its way to the server for this card, or null. */
export type Sending =
  | { readonly kind: 'option'; readonly option: string }
  | { readonly kind: 'words' }
  | { readonly kind: 'dismiss' }
  | null;

/** What the card is sending, from its two calls: the answer's choice, or the dismiss. */
export function sendingOf(
  answering: AnswerChoice | null | undefined,
  dismissing: boolean,
): Sending {
  if (answering?.kind === 'option') return { kind: 'option', option: answering.option };
  if (answering?.kind === 'words') return { kind: 'words' };
  return dismissing ? { kind: 'dismiss' } : null;
}

export type ControlButton = {
  readonly label: string;
  readonly disabled: boolean;
  readonly busy: boolean;
};

export type OptionButton = ControlButton & { readonly option: string };

export type DismissConfirm = {
  readonly effect: string;
  readonly keep: ControlButton;
  readonly dismiss: ControlButton;
};

export type QuestionControls = {
  readonly options: readonly OptionButton[];
  /** Opens or hides the field; only when options are offered. */
  readonly toggle: ControlButton | null;
  /** The own-words field, while it is open. */
  readonly field: { readonly disabled: boolean } | null;
  readonly answer: ControlButton | null;
  /** Opens the confirm; null while it is open. */
  readonly dismiss: ControlButton | null;
  readonly confirm: DismissConfirm | null;
};

export type ControlsInput = {
  readonly mayAnswer: boolean;
  readonly options: readonly string[];
  readonly effect: string;
  /** The person opened the own-words field. */
  readonly wordsOpen: boolean;
  /** The person pressed Dismiss and is asked to confirm. */
  readonly confirming: boolean;
  readonly text: string;
  readonly sending: Sending;
};

const button = (label: string, disabled: boolean, busy = false): ControlButton => ({
  label,
  disabled,
  busy,
});

function confirmControls(input: ControlsInput, busy: boolean): QuestionControls {
  return {
    options: [],
    toggle: null,
    field: null,
    answer: null,
    dismiss: null,
    confirm: {
      effect: input.effect,
      keep: button(QUESTIONS_COPY.keep, busy),
      dismiss: button(QUESTIONS_COPY.dismiss, busy, input.sending?.kind === 'dismiss'),
    },
  };
}

function optionButtons(input: ControlsInput, busy: boolean): OptionButton[] {
  const sent = input.sending?.kind === 'option' ? input.sending.option : null;
  return input.options.map((option) => ({
    option,
    ...button(option, busy, option === sent),
  }));
}

/** The card's controls, or null for a role that may not answer. */
export function questionControls(input: ControlsInput): QuestionControls | null {
  if (!input.mayAnswer) return null;
  const busy = input.sending !== null;
  if (input.confirming) return confirmControls(input, busy);
  const offered = input.options.length > 0;
  const open = !offered || input.wordsOpen;
  return {
    options: optionButtons(input, busy),
    toggle: offered
      ? button(open ? QUESTIONS_COPY.hideOwnWords : QUESTIONS_COPY.ownWords, busy)
      : null,
    field: open ? { disabled: busy } : null,
    answer: open
      ? button(QUESTIONS_COPY.answer, busy || !input.text.trim(), input.sending?.kind === 'words')
      : null,
    dismiss: button(QUESTIONS_COPY.dismiss, busy),
    confirm: null,
  };
}
