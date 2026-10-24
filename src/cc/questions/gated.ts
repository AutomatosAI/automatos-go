// Face ID before an answer (D19, KP13; A4's US-015e): an offered option or the person's own words
// goes to POST /api/v1/approval-grants/{id}/answer only after guard('answer', …) from src/step-up
// passes, and exactly as before (answerQuestion's body). A blank or foreign choice is refused before
// anything is asked, as answerQuestion refuses it unsent. A refused check sends nothing: the card
// stays as it was and the gate's toast says why. Dismiss never asks (KP13). Pure: use-questions.ts
// hands in useStepUp().guard.

import type { ApiClient } from '../../api/client';
import type { Guard, GuardResult } from '../../step-up/guard';
import { AnswerInputError, answerBody, type AnswerChoice } from './answer';
import { answerQuestion } from './api';
import type { DecisionResult } from './schemas';

export async function answerGated(
  guard: Guard,
  client: ApiClient,
  id: number,
  choice: AnswerChoice,
  offered: readonly string[],
): Promise<GuardResult<DecisionResult>> {
  const checked = answerBody(choice, offered);
  if (!checked.ok) throw new AnswerInputError(checked.reason, checked.message);
  return guard('answer', () => answerQuestion(client, id, choice, offered));
}
