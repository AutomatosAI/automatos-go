// One card action at a time (D-CARDS): busy while the call is out, the refusal's words when the
// server says no (refusalText: never a status code), and the outcome handed to the thread when it
// agrees, so the card keeps it however often it is drawn again. Who may act comes from the session's
// role (cardAccess). It only wires: the payloads, the gate and the words are actions.ts.

import { useCallback, useRef, useState } from 'react';

import type { ApiClient } from '../../api/client';
import type { RoleAction } from '../../auth/role';
import { useApiClient, useAppSession } from '../../app-state/session';
import { logger } from '../../lib/logger';
import { cardAccess, refusalText, type CardAccess } from './actions';
import type { CardOutcome, SettleCard } from './model';

export type CardCall = (client: ApiClient) => Promise<CardOutcome>;

export type CardRequest = {
  readonly busy: boolean;
  /** The refusal's words; null before a try and after one the server agreed to. */
  readonly error: string | null;
  readonly run: (call: CardCall) => void;
};

/** Whether this session's role may act on a card, and the D17 words when it may not. */
export function useCardAccess(action: RoleAction): CardAccess {
  return cardAccess(useAppSession().workspace.role, action);
}

export function useCardRequest(key: string, onSettled: SettleCard): CardRequest {
  const client = useApiClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // a second tap while the first call is out sends nothing
  const out = useRef(false);
  const run = useCallback(
    (call: CardCall) => {
      if (out.current) return;
      out.current = true;
      setBusy(true);
      setError(null);
      call(client)
        .then((outcome) => onSettled(key, outcome))
        .catch((caught: unknown) => {
          logger.warn('[chat] a card action was refused', caught);
          setError(refusalText(caught));
        })
        .finally(() => {
          out.current = false;
          setBusy(false);
        });
    },
    [client, key, onSettled],
  );
  return { busy, error, run };
}
