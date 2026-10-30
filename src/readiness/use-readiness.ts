// "What Auto depends on" on a screen (US-G07): the server's Readiness@1 through the one client and
// cache (memory only: query-keys.ts), this phone's facts read each time Settings comes into view
// (back from Notifications or Voice too), when the app comes back (the person may have changed a
// permission in the phone's Settings), when the voice setting changes and on Check again; and
// Check again itself: one POST per press, never while one is out, never retried (D-WRITES). Its
// answer replaces any read still out and is announced to VoiceOver once this phone's facts are
// read again too; a refusal is kept as the line under the rows and announced (iOS has no live
// regions). Nothing runs where discovery does not list readiness. Only wiring: the rows, the
// marks and the words are view-model.ts's and client-rows.ts's.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
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

/**
 * This phone's facts; `read(fresh)` reads them again and resolves once they are in (the latest
 * read wins; it never rejects). A new voice setting makes new ports, so it reads again.
 */
function useClientFacts(shown: boolean) {
  const { discovery, client } = useAppSession();
  const setting = useVoiceSetting();
  const ports = useMemo(
    () => clientPorts({ discovery, client, setting }),
    [discovery, client, setting],
  );
  const [facts, setFacts] = useState<ClientFacts>(NO_CLIENT_FACTS);
  const latest = useRef(0);
  const read = useCallback(
    (fresh: boolean): Promise<void> => {
      latest.current += 1;
      const run = latest.current;
      return readClientFacts(ports, { fresh }).then((next) => {
        if (run === latest.current) setFacts(next);
      });
    },
    [ports],
  );
  useFocusEffect(
    useCallback(() => {
      if (shown) void read(false);
    }, [shown, read]),
  );
  useEffect(() => {
    if (!shown) return undefined;
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void read(false);
    });
    return () => listener.remove();
  }, [shown, read]);
  return { facts, read };
}

function announce(line: string): void {
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(line);
}

/** Check again: the POST, this phone's facts read afresh beside it, and the refusal's line. */
function useCheckAgain(key: readonly unknown[], readPhone: (fresh: boolean) => Promise<void>) {
  const { client } = useAppSession();
  const queryClient = useQueryClient();
  const [state, setState] = useState<CheckState>(CHECK_IDLE);
  const out = useRef(false);
  const run = useCallback(() => {
    if (out.current) return;
    out.current = true;
    setState(CHECK_SENDING);
    const phone = readPhone(true);
    checkReadiness(client)
      .then(async (readiness) => {
        // a GET still out would answer an older check over this one
        await queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData(key, readiness);
        await phone;
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
