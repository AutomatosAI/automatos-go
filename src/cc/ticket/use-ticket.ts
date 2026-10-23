// The ticket sheet's hooks: they read the ticket, its Deliverables, the clock and the role, and run
// a verdict through the Board's calls (board/api.ts); the decisions are actions.ts's and the view
// sheet.ts's. A verdict is sent at once, never queued (the client's mutations run networkMode
// 'always'); its answer, a success or a refusal, refreshes the ticket, the Board and needs-you, so
// what the sheet shows next is the server's (the stream's board_changed would follow anyway).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { queryKeys } from '../../api/query-keys';
import { useAppSession } from '../../app-state/session';
import { useToast } from '../../ui';
import { approveTicket, sendBack, ticketQuery } from '../board/api';
import type { TicketDetail } from '../board/schemas';
import { useMinuteClock, usePhoneTimeZone } from '../shell/use-shell';
import {
  approvedMessage,
  refusalMessage,
  sentBackMessage,
  ticketActions,
  type VerdictMode,
} from './actions';
import { linkedDeliverablesQuery, linkedDeliverableViews } from './linked';
import { ticketSheetView } from './sheet';

/** The ticket and its Deliverables; nothing is asked for a route id that is not a row id. */
export function useTicketSheet(taskId: string | null) {
  const { client, workspace } = useAppSession();
  const enabled = taskId !== null;
  const ticket = useQuery({ ...ticketQuery(client, taskId ?? ''), enabled });
  const linked = useQuery({
    ...linkedDeliverablesQuery(client, workspace.id, taskId ?? ''),
    enabled,
  });
  const now = useMinuteClock();
  const timeZone = usePhoneTimeZone();
  const data = ticket.data;
  const view = useMemo(
    () => (data ? ticketSheetView(data, { now, timeZone }) : null),
    [data, now, timeZone],
  );
  const rows = linked.data;
  const deliverables = useMemo(() => (rows ? linkedDeliverableViews(rows) : []), [rows]);
  const actions = data ? ticketActions(data, workspace.role) : null;
  return { ticket, view, deliverables, actions, role: workspace.role };
}

/** After a verdict, right or refused: the ticket, the Board and needs-you read the server again. */
function useRefreshAfterVerdict(taskId: number) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [queryKeys.ticket(String(taskId)), queryKeys.board(), queryKeys.needsYou()].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
}

/** Approve and Send back on one ticket: the mode, the note, the refusal, and the two calls. */
export function useVerdict(ticket: TicketDetail, onDecided: () => void) {
  const { client } = useAppSession();
  const toast = useToast();
  const refresh = useRefreshAfterVerdict(ticket.id);
  const [mode, setMode] = useState<VerdictMode>('idle');
  const [note, setNote] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const settled = {
    onError: (error: unknown) => setRefusal(refusalMessage(error)),
    onSettled: refresh,
  };
  const approve = useMutation({
    mutationFn: () => approveTicket(client, ticket.id),
    onSuccess: (result) => {
      toast.show(approvedMessage(result, ticket));
      onDecided();
    },
    ...settled,
  });
  const sendItBack = useMutation({
    mutationFn: (feedback: string) => sendBack(client, ticket.id, feedback),
    onSuccess: () => {
      toast.show(sentBackMessage(ticket.agent?.name));
      onDecided();
    },
    ...settled,
  });
  const choose = (next: VerdictMode) => {
    setNote('');
    setRefusal(null);
    setMode(next);
  };
  return {
    mode,
    note,
    refusal,
    busy: approve.isPending || sendItBack.isPending,
    setNote,
    choose,
    approve: () => {
      setRefusal(null);
      approve.mutate();
    },
    sendBack: () => {
      setRefusal(null);
      sendItBack.mutate(note);
    },
  };
}
