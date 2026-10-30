// "What Auto depends on" on a screen (US-G07): the server's Readiness@1 through the one client and
// cache (memory only: query-keys.ts), this phone's facts read on open, when the app comes back (the
// person may have changed a permission in the phone's Settings), when "I speak" changes and on
// Check again; and Check again itself: one POST per press, never while one is out, never retried
// (D-WRITES), its answer put in the cache and announced to VoiceOver, a refusal kept as the line
// under the rows and announced too (iOS has no live regions). Nothing runs where discovery does
// not list readiness. Only wiring: the rows, the marks and the words are view-model.ts's and
// client-rows.ts's.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';

import { canReadiness } from '../api/capabilities';
import { useAppSession } from '../app-state/session';
import { ownServer } from '../connect/current-server';
import { useCurrentServer } from '../connect/use-current-server';
import { logger } from '../lib/logger';
import { serverNameOf } from '../push/bind/build-session';
import type { PhoneContext } from '../push/settings/view-model';
import { useVoiceSetting } from '../voice/settings/use-voice-setting';
import { checkReadiness, fetchReadiness } from './api';
import { NO_CLIENT_FACTS, readClientFacts, type ClientFacts } from './client-facts';
import { clientPorts } from './client-ports';
import { clientRows } from './client-rows';
import { readinessQueryKeys } from './query-keys';
import { READINESS_COPY } from './strings';
import { readinessView, refusalLine, type ReadinessView } from './view-model';

type CheckState = Readonly<{ sending: boolean; refusal: string | null }>;

const CHECK_IDLE: CheckState = Object.freeze({ sending: false, refusal: null });
const CHECK_SENDING: CheckState = Object.freeze({ sending: true, refusal: null });

/** This phone's facts; `read(fresh)` reads them again (the latest read wins). */
function useClientFacts(shown: boolean) {
  const { discovery, client } = useAppSession();
  const { language } = useVoiceSetting();
  const ports = useMemo(() => clientPorts({ discovery, client }), [discovery, client]);
  const [facts, setFacts] = useState<ClientFacts>(NO_CLIENT_FACTS);
  const latest = useRef(0);
  const read = useCallback(
    (fresh: boolean) => {
      latest.current += 1;
      const run = latest.current;
      void readClientFacts(ports, { fresh }).then((next) => {
        if (run === latest.current) setFacts(next);
      });
    },
    [ports],
  );
  useEffect(() => {
    if (!shown) return undefined;
    read(false);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') read(false);
    });
    return () => listener.remove();
  }, [shown, read, language]);
  return { facts, read };
}

function announce(line: string): void {
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(line);
}

/** Check again: the POST, this phone's facts read afresh beside it, and the refusal's line. */
function useCheckAgain(key: readonly unknown[], readPhone: (fresh: boolean) => void) {
  const { client } = useAppSession();
  const queryClient = useQueryClient();
  const [state, setState] = useState<CheckState>(CHECK_IDLE);
  const out = useRef(false);
  const run = useCallback(() => {
    if (out.current) return;
    out.current = true;
    setState(CHECK_SENDING);
    readPhone(true);
    checkReadiness(client)
      .then((readiness) => {
        queryClient.setQueryData(key, readiness);
        setState(CHECK_IDLE);
        announce(READINESS_COPY.checkedNow);
      })
      .catch((error: unknown) => {
        logger.warn('[readiness] Check again was refused or failed', error);
        const line = refusalLine(error);
        setState(Object.freeze({ sending: false, refusal: line }));
        announce(line);
      })
      .finally(() => {
        out.current = false;
      });
  }, [client, queryClient, key, readPhone]);
  return { state, run };
}

function usePhoneContext(): PhoneContext {
  const { server } = useAppSession();
  const serverName = serverNameOf(ownServer(useCurrentServer()));
  return useMemo(() => ({ source: server.source, serverName }), [server.source, serverName]);
}

export type ReadinessState = Readonly<{
  /** Discovery lists readiness: an older server shows Settings as it was. */
  shown: boolean;
  view: ReadinessView;
  checkAgain: () => void;
}>;

export function useReadiness(): ReadinessState {
  const { discovery, client, server, workspace } = useAppSession();
  const shown = canReadiness(discovery);
  const key = useMemo(
    () => readinessQueryKeys.current(server.apiUrl, workspace.id),
    [server.apiUrl, workspace.id],
  );
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchReadiness(client, signal),
    enabled: shown,
  });
  const { facts, read } = useClientFacts(shown);
  const check = useCheckAgain(key, read);
  const context = usePhoneContext();
  const view = readinessView({
    items: query.data?.items ?? null,
    client: clientRows(facts, context),
    checking: check.state.sending || query.isLoading,
    readError: query.error,
    refusal: check.state.refusal,
  });
  return { shown, view, checkAgain: check.run };
}
