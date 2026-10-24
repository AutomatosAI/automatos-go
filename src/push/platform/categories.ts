// The notification categories the app registers before any push arrives (PRD-001 §4.8,
// D-LOCK-SCREEN, KP7 = W2 K9): W2 sends automatos.question.<n> (n = the options carried, 0–3) for a
// question and automatos.open for everything else. A question offers 'Reply…' (an unlocked phone
// only) and 'Open'; anything else offers 'Open'. No Approve and no option buttons: iOS draws the
// titles registered here, and W2 shares one category per option count, so a question's own option
// texts can only be answered in the app (Open lands on it). Every action opens the app.
// Pure data: setup.ts hands it to the port.

import { OPEN_ACTION_ID, REPLY_ACTION_ID } from '../config';
import { PUSH_CATEGORY_COPY } from '../strings';
import type { CategoryAction, PushCategory } from './port';

/** Every question category starts with this (W2's QUESTION_CATEGORY_FORMAT). */
export const QUESTION_CATEGORY_PREFIX = 'automatos.question.';

export const QUESTION_CATEGORY_IDS = Object.freeze([
  'automatos.question.0',
  'automatos.question.1',
  'automatos.question.2',
  'automatos.question.3',
] as const);

/** W2's OPEN_CATEGORY: every push that carries no question (a redacted question included). */
export const OPEN_CATEGORY_ID = 'automatos.open';

const REPLY_ACTION: CategoryAction = Object.freeze({
  identifier: REPLY_ACTION_ID,
  buttonTitle: PUSH_CATEGORY_COPY.reply,
  textInput: Object.freeze({
    submitButtonTitle: PUSH_CATEGORY_COPY.replySend,
    placeholder: PUSH_CATEGORY_COPY.replyPlaceholder,
  }),
  options: Object.freeze({ opensAppToForeground: true, isAuthenticationRequired: true }),
});

const OPEN_ACTION: CategoryAction = Object.freeze({
  identifier: OPEN_ACTION_ID,
  buttonTitle: PUSH_CATEGORY_COPY.open,
  options: Object.freeze({ opensAppToForeground: true }),
});

function questionCategory(identifier: string): PushCategory {
  return Object.freeze({
    identifier,
    actions: Object.freeze([REPLY_ACTION, OPEN_ACTION]),
    options: Object.freeze({ previewPlaceholder: PUSH_CATEGORY_COPY.questionPreview }),
  });
}

export const PUSH_CATEGORIES: readonly PushCategory[] = Object.freeze([
  ...QUESTION_CATEGORY_IDS.map(questionCategory),
  Object.freeze({
    identifier: OPEN_CATEGORY_ID,
    actions: Object.freeze([OPEN_ACTION]),
    options: Object.freeze({ previewPlaceholder: PUSH_CATEGORY_COPY.openPreview }),
  }),
]);

/** A question's category (the one that plays a sound in the foreground, KP15). */
export function isQuestionCategory(category: string | null): boolean {
  return category !== null && category.startsWith(QUESTION_CATEGORY_PREFIX);
}
