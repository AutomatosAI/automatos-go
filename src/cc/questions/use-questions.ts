// The Questions' hooks: they read the open questions and the role, and run an answer or a dismiss
// through the calls in api.ts; the decisions are answer.ts's and controls.ts's. A call is sent at
// once, never queued (the client's mutations run networkMode 'always'). Once the server has answered
// the card leaves the list and its toast says what the server said; a refusal says why in the toast
// and the list, needs-you and the Board are read again either way (the stream would follow). An
// answer asks for Face ID first (gated.ts, A4): a refused check sends and reads nothing, and the card
// stays as it was. Dismiss never asks (KP13).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { queryKeys } from '../../api/query-keys';
import { useAppSession } from '../../app-state/session';
import { useStepUp } from '../../step-up/use-step-up';
import { useToast } from '../../ui';
import { usePullRefresh } from '../use-pull-refresh';
import {
  answeredMessage,
  dismissedMessage,
  mayAnswer,
  readOnlyReason,
  refusalMessage,
  withoutQuestion,
  type AnswerChoice,
} from './answer';
import { dismissQuestion, QUESTIONS_KEY, questionsQuery } from './api';
import { questionControls, sendingOf } from './controls';
import { answerGated } from './gated';
import type { Questions } from './schemas';
import { questionCardView, type QuestionCardView } from './view-model';

export function useQuestionsTab() {
  const { client, workspace } = useAppSession();
  const query = useQuery(questionsQuery(client));
  const pull = usePullRefresh(query.refetch);
  const grants = query.data?.grants;
  const cards = useMemo(() => (grants ? grants.map(questionCardView) : null), [grants]);
  return {
    query,
    cards,
    pull,
    mayAnswer: mayAnswer(workspace.role),
    readOnly: readOnlyReason(workspace.role),
  };
}

/** After the server's answer: the card leaves at once; the list, needs-you and the Board reread. */
function useAfterDecision(id: number) {
  const queryClient = useQueryClient();
  return {
    drop: () =>
      queryClient.setQueryData<Questions>(
        QUESTIONS_KEY,
        (list) => list && withoutQuestion(list, id),
      ),
    refresh: () =>
      Promise.all(
        [QUESTIONS_KEY, queryKeys.needsYou(), queryKeys.board()].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  };
}

/** The answer, Face ID first (gated.ts): a refused check sends and reads nothing. */
function useAnswer(card: QuestionCardView, after: ReturnType<typeof useAfterDecision>) {
  const { client } = useAppSession();
  const { guard } = useStepUp();
  const toast = useToast();
  return useMutation({
    mutationFn: (choice: AnswerChoice) => answerGated(guard, client, card.id, choice, card.options),
    onSuccess: (sent, choice) => {
      if (!sent.ran) return;
      after.drop();
      toast.show(answeredMessage(sent.value, choice));
    },
    onError: (error: unknown) => toast.show(refusalMessage(error)),
    onSettled: (sent) => (sent?.ran === false ? undefined : after.refresh()),
  });
}

/** One card's answer and dismiss: the field, the confirm, the two calls and their toasts. */
export function useQuestionCard(card: QuestionCardView, allowed: boolean) {
  const { client } = useAppSession();
  const toast = useToast();
  const after = useAfterDecision(card.id);
  const [wordsOpen, setWordsOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState('');
  const answer = useAnswer(card, after);
  const dismiss = useMutation({
    mutationFn: () => dismissQuestion(client, card.id),
    onSuccess: () => {
      after.drop();
      toast.show(dismissedMessage(card.stoppedRun));
    },
    onError: (error: unknown) => {
      setConfirming(false);
      toast.show(refusalMessage(error));
    },
    onSettled: after.refresh,
  });
  const controls = questionControls({
    mayAnswer: allowed,
    options: card.options,
    effect: card.dismissEffect,
    wordsOpen,
    confirming,
    text,
    sending: sendingOf(answer.isPending ? answer.variables : null, dismiss.isPending),
  });
  return {
    controls,
    text,
    setText,
    toggleWords: () => setWordsOpen((open) => !open),
    choose: (option: string) => answer.mutate({ kind: 'option', option }),
    sendWords: () => answer.mutate({ kind: 'words', text }),
    askDismiss: () => setConfirming(true),
    keep: () => setConfirming(false),
    dismiss: () => dismiss.mutate(),
  };
}

export type QuestionCardState = ReturnType<typeof useQuestionCard>;
