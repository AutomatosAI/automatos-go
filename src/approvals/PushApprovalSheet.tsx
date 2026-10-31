// The approval sheet a push opens (PRD-268 §6.11.4, §6.12.5, US-G08), wired (the state is
// push-sheet.ts's): mounted once beside push (PushRoot), over whatever screen the tap opened, in every
// layout. It reads the grant's ApprovalView@1 (api.ts) and shows the US-G08 sheet (ApprovalSheet.tsx)
// with a tool approval's own answers: Approve & run behind Face ID (the cards' grantToolGated, from
// src/step-up) and Deny never gated (denyCall). Once the server agreed it closes and says what the
// click did, in the card's words, and needs-you, the questions and the chats are read again. A view
// that cannot be read (decided, lapsed, refused, offline) says one line and closes. Only for a role
// that may approve; the thread's card stays the record (D30). Memory only.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { matchesFamily, type KeyFamilyName } from '../api/query-keys';
import { useAppSession } from '../app-state/session';
import { grantRefusalText } from '../chat/cards/actions';
import { grantToolGated } from '../chat/cards/gated';
import { denyCall, toolLine } from '../chat/cards/grants';
import type { CardOutcome } from '../chat/cards/model';
import { useCardAccess, useCardRequest } from '../chat/cards/use-card-request';
import { useStepUp } from '../step-up/use-step-up';
import { useToast } from '../ui';
import { fetchApprovalView } from './api';
import { ApprovalSheet } from './ApprovalSheet';
import { approvalViewKey, pushApprovals, viewFailureLine } from './push-sheet';

/** What an answer changes: what counts it, the questions list, and the chats it was asked in. */
const AFTER_ANSWER: readonly KeyFamilyName[] = ['needsYou', 'questions', 'chat.messages'];

function GrantSheet({ grantId, visible }: { readonly grantId: string; readonly visible: boolean }) {
  const { client } = useAppSession();
  const { guard } = useStepUp();
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
  const settled = useCallback(
    (_key: string, outcome: CardOutcome) => {
      pushApprovals.close();
      toast.show(toolLine(outcome).text);
      void queryClient.invalidateQueries({
        predicate: (query) => AFTER_ANSWER.some((name) => matchesFamily(name, query.queryKey)),
      });
    },
    [queryClient, toast],
  );
  const request = useCardRequest(`push-approval:${grantId}`, settled, grantRefusalText);
  if (!view.data) return null;
  const id = Number(grantId);
  return (
    <ApprovalSheet
      visible={visible}
      onClose={pushApprovals.close}
      view={view.data}
      kind="tool"
      busy={request.busy}
      error={request.error}
      onAllow={() => request.run(grantToolGated(guard, id))}
      onRefuse={() => request.run(denyCall(id))}
    />
  );
}

export function PushApprovalSheet() {
  const sheet = useSyncExternalStore(pushApprovals.subscribe, pushApprovals.current);
  const access = useCardAccess('approve');
  if (sheet.grantId === null || !access.canAct) return null;
  return <GrantSheet key={sheet.grantId} grantId={sheet.grantId} visible={sheet.visible} />;
}
