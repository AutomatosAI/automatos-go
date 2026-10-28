// Try again on a row (PRD-268 §6.12.3): offered only to a role that may run work (D16: owners,
// admins and editors, the line Pause and Resume follow), behind Face ID first (gated.ts: it starts
// work, as PRD-268's Start does), sent at once and never queued (the client's
// mutations run networkMode 'always'). A refused check sends and reads nothing; the gate's toast
// says why. Once sent, the toast says the server's words, or why it refused (ticket/actions.ts
// refusalMessage), and needs-you, the Board and the open ticket are read again, so the row shows
// its new state. Only wiring: the choice of route is row-status.ts's, the call api.ts's.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { matchesFamily, type KeyFamilyName } from '../../api/query-keys';
import { useAppSession } from '../../app-state/session';
import { roleCan, type RoleAction } from '../../auth/role';
import { useStepUp } from '../../step-up/use-step-up';
import { useToast } from '../../ui';
import { refusalMessage } from '../ticket/actions';
import { retriedMessage } from './api';
import { retryGated } from './gated';
import type { RetryAction } from './row-status';

/** The role line Try again follows: running work, as Pause and Resume do (D16). */
export const RETRY_ROLE_ACTION: RoleAction = 'pause';

/** What a retry changes: the rows that show its state. */
const REREAD: readonly KeyFamilyName[] = ['needsYou', 'board', 'ticket'];

export type RetryControl = {
  /** The row offers it and the role may send it. */
  readonly offered: boolean;
  readonly busy: boolean;
  readonly run: () => void;
};

export function useRetry(action: RetryAction | null): RetryControl {
  const { client, workspace } = useAppSession();
  const { guard } = useStepUp();
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (sent: RetryAction) => retryGated(guard, client, sent),
    onSuccess: (sent, request) => {
      if (sent.ran) toast.show(retriedMessage(sent.value, request.kind));
    },
    onError: (error: unknown) => toast.show(refusalMessage(error)),
    onSettled: (sent) =>
      sent?.ran === false
        ? undefined
        : queryClient.invalidateQueries({
            predicate: (query) => REREAD.some((name) => matchesFamily(name, query.queryKey)),
          }),
  });
  const offered = action !== null && roleCan(workspace.role, RETRY_ROLE_ACTION);
  return {
    offered,
    busy: mutation.isPending,
    run: () => {
      if (action && offered && !mutation.isPending) mutation.mutate(action);
    },
  };
}
