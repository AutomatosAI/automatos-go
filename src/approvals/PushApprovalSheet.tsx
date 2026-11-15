// The approval sheet a push opens (PRD-268 §6.11.4, §6.12.5, US-G08), wired (the state is
// push-sheet.ts's): mounted once beside push (PushRoot), over whatever screen the tap opened, in every
// layout. It reads the grant's ApprovalView@1 (api.ts) and shows the US-G08 sheet (ApprovalSheet.tsx)
// with a tool approval's own answers: Approve & run behind Face ID (the cards' grantToolGated, from
// src/step-up) and Deny never gated (denyCall); or, for a Mission plan (`kind` 'plan', from its push or
// its inbox row), the plan card's: Approve & run behind Face ID and Reject asking its reason in place. Once the server agreed it closes and says what the
// click did, in the card's words, and needs-you, the questions and the chats are read again. A view
// that cannot be read (decided, lapsed, refused, offline) says one line and closes. Only for a role
// that may approve; the thread's card stays the record (D30). Memory only.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { matchesFamily, type KeyFamilyName } from '../api/query-keys';
import { useAppSession } from '../app-state/session';
import { CARD_COPY } from '../chat/strings';
import { grantRefusalText, planRefusalText, rejectBody } from '../chat/cards/actions';
import { rejectMission } from '../chat/cards/api';
import { approvePlanGated, grantToolGated } from '../chat/cards/gated';
import { denyCall } from '../chat/cards/grants';
import type { CardOutcome } from '../chat/cards/model';
import { RejectForm } from '../chat/cards/PlanApprovalCard';
import { useCardAccess, useCardRequest, type CardRequest } from '../chat/cards/use-card-request';
import { useStepUp } from '../step-up/use-step-up';
import { useToast } from '../ui';
import { fetchApprovalView } from './api';
import { ApprovalSheet } from './ApprovalSheet';
import { approvalViewKey, decidedPlan, pushApprovals, settledLine, viewFailureLine } from './push-sheet';
import type { SheetKind } from './sheet-view';

/** What an answer changes: what counts it, the questions list, and the chats it was asked in. */
const AFTER_ANSWER: readonly KeyFamilyName[] = ['needsYou', 'questions', 'chat.messages'];

const REJECTED: CardOutcome = Object.freeze({ state: 'rejected' });

/**
 * The view, read afresh each time the sheet opens; one that cannot be read says so and closes, and so
 * does a Mission plan already decided (core's plan view names no answers once it stops waiting).
 */
function useSheetView(grantId: string, kind: SheetKind, visible: boolean) {
  const { client } = useAppSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = useMemo(() => approvalViewKey(grantId), [grantId]);
  // never an earlier answer: gone once the sheet goes, and read afresh when it opens again
  const view = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchApprovalView(client, grantId, signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const { error, isError, isFetching } = view;
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (visible && !wasVisible.current) void queryClient.resetQueries({ queryKey: key });
    wasVisible.current = visible;
  }, [visible, queryClient, key]);
  useEffect(() => {
    if (!isError || isFetching) return;
    toast.show(viewFailureLine(error));
    pushApprovals.close();
  }, [isError, isFetching, error, toast]);
  const decided = decidedPlan(kind, view.data);
  useEffect(() => {
    if (!decided || isFetching) return;
    toast.show(CARD_COPY.alreadyDecided);
    pushApprovals.close();
  }, [decided, isFetching, toast]);
  return { view, decided };
}

/**
 * The sheet's writes: a tool approval's Approve & run behind Face ID and Deny never gated; a Mission
 * plan's Approve & run behind Face ID and Reject with its reason (never gated), the plan card's own.
 */
type SheetAnswers =
  | Readonly<{ kind: 'plan'; allow: () => void; reject: (reason: string) => void }>
  | Readonly<{ kind: 'tool'; allow: () => void; deny: () => void }>;

function useAnswers(grantId: string, kind: SheetKind, request: CardRequest): SheetAnswers {
  const { guard } = useStepUp();
  if (kind === 'plan') {
    return {
      kind,
      allow: () => request.run(approvePlanGated(guard, grantId)),
      reject: (reason: string) => {
        const body = rejectBody(reason);
        if (!body) return;
        request.run(async (client) => {
          await rejectMission(client, grantId, body);
          return REJECTED;
        });
      },
    };
  }
  const id = Number(grantId);
  return {
    kind,
    allow: () => request.run(grantToolGated(guard, id)),
    deny: () => request.run(denyCall(id)),
  };
}

type GrantSheetProps = {
  readonly grantId: string;
  readonly kind: SheetKind;
  readonly visible: boolean;
};

function GrantSheet({ grantId, kind, visible }: GrantSheetProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { view, decided } = useSheetView(grantId, kind, visible);
  const [rejecting, setRejecting] = useState(false);
  useEffect(() => {
    if (!visible) setRejecting(false);
  }, [visible]);
  const settled = useCallback(
    (_key: string, outcome: CardOutcome) => {
      pushApprovals.close();
      toast.show(settledLine(kind, outcome));
      void queryClient.invalidateQueries({
        predicate: (query) => AFTER_ANSWER.some((name) => matchesFamily(name, query.queryKey)),
      });
    },
    [kind, queryClient, toast],
  );
  const refusal = kind === 'plan' ? planRefusalText : grantRefusalText;
  const request = useCardRequest(`push-approval:${grantId}`, settled, refusal);
  const answers = useAnswers(grantId, kind, request);
  if (!view.data || decided) return null;
  const close = () => {
    setRejecting(false);
    pushApprovals.close();
  };
  const onRefuse = answers.kind === 'plan' ? () => setRejecting(true) : answers.deny;
  const refuseForm =
    rejecting && answers.kind === 'plan' ? (
      <RejectForm request={request} onCancel={() => setRejecting(false)} onReject={answers.reject} />
    ) : undefined;
  return (
    <ApprovalSheet
      visible={visible}
      onClose={close}
      view={view.data}
      kind={kind}
      busy={request.busy}
      error={request.error}
      onAllow={answers.allow}
      onRefuse={onRefuse}
      refuseForm={refuseForm}
    />
  );
}

export function PushApprovalSheet() {
  const sheet = useSyncExternalStore(pushApprovals.subscribe, pushApprovals.current);
  const access = useCardAccess('approve');
  if (sheet.grantId === null || !access.canAct) return null;
  // a tool approval's id is its grant's row number; anything else is no grant to answer
  if (sheet.kind === 'tool' && !Number.isInteger(Number(sheet.grantId))) return null;
  const key = `${sheet.kind}:${sheet.grantId}`;
  return <GrantSheet key={key} grantId={sheet.grantId} kind={sheet.kind} visible={sheet.visible} />;
}
