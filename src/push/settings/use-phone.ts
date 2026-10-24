// This phone on Settings → Notifications: the session's registrar (through the phone link PushRoot
// attaches) runs when the screen opens and again when the app comes back — the person may have
// changed the permission in the phone's Settings — and after each answer GET /devices is read again
// so the server's reason for an off push shows. A tap runs the registrar once (runPhoneAction) or
// opens the phone's Settings. The device facts (the build's project id, the time zone) are read
// again on resume too. Only wiring: the words are view-model.ts's.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Linking } from 'react-native';

import { useAppSession } from '../../app-state/session';
import { ownServer } from '../../connect/current-server';
import { ownServerInWords } from '../../connect/edges';
import { SERVER_SECTION_COPY } from '../../connect/strings';
import { useCurrentServer } from '../../connect/use-current-server';
import { logger } from '../../lib/logger';
import { listDevices } from '../api';
import { pushQueryKeys } from '../query-keys';
import { readDeviceFacts, type DeviceFacts } from '../registration/device-facts';
import type { RegistrationOutcome } from '../registration/register';
import { phoneLinks, runPhoneAction, type PhoneLink } from './phone-link';
import {
  phoneStatusOf,
  phoneStatusView,
  sectionsShown,
  thisPhoneRow,
  type PhoneAction,
} from './view-model';

type Taken = Readonly<{ outcome: RegistrationOutcome; at: number }>;

/** Runs each time the app comes back to the front. */
function useOnResume(run: () => void): void {
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => listener.remove();
  }, [run]);
}

/** Runs on mount (and when run changes) and on each resume. */
function useOnOpenAndResume(run: () => void): void {
  useEffect(run, [run]);
  useOnResume(run);
}

/** GET /api/v1/mobile/devices, read only where the server pushes through Expo. */
export function useDevices() {
  const { client, discovery } = useAppSession();
  return useQuery({
    queryKey: pushQueryKeys.devices(),
    queryFn: ({ signal }) => listDevices(client, signal),
    enabled: sectionsShown(discovery).pushTypes,
  });
}

function usePhoneFacts(): DeviceFacts {
  const [facts, setFacts] = useState<DeviceFacts>(readDeviceFacts);
  const read = useCallback(() => setFacts(readDeviceFacts()), []);
  useOnResume(read);
  return facts;
}

/** The registrar's answers this screen took: on open, on resume and after a tap. */
function useOutcome(link: PhoneLink | null) {
  const queryClient = useQueryClient();
  const [taken, setTaken] = useState<Taken | null>(() => {
    const latest = link?.registrar.latest();
    return latest ? { outcome: latest, at: Date.now() } : null;
  });
  const take = useCallback(
    (outcome: RegistrationOutcome | null) => {
      if (!outcome) return;
      setTaken({ outcome, at: Date.now() });
      void queryClient.invalidateQueries({ queryKey: pushQueryKeys.devices() });
    },
    [queryClient],
  );
  const refresh = useCallback(() => {
    if (link) void link.registrar.run().then(take);
  }, [link, take]);
  useOnOpenAndResume(refresh);
  // a link detached (sign-out) leaves no answer behind
  return { taken: link ? taken : null, take };
}

function openPhoneSettings(): void {
  Linking.openSettings().catch(() => {
    logger.warn("[push] could not open the phone's Settings");
  });
}

function useServerName(): string {
  const own = ownServer(useCurrentServer());
  return own ? ownServerInWords(own) : SERVER_SECTION_COPY.hostedName;
}

/** The status card's words and button, this phone's device row and its time zone. */
export function usePhone() {
  const { server, discovery } = useAppSession();
  const link = useSyncExternalStore(phoneLinks.subscribe, phoneLinks.current, phoneLinks.current);
  const facts = usePhoneFacts();
  const devices = useDevices();
  const { taken, take } = useOutcome(link);
  const serverName = useServerName();
  const [busy, setBusy] = useState(false);
  const outcome = taken?.outcome ?? null;
  const rows = devices.data?.devices ?? null;
  const status = phoneStatusOf({
    discovery,
    projectId: facts.projectId,
    outcome,
    outcomeAt: taken?.at ?? 0,
    devices: rows,
    devicesAt: devices.dataUpdatedAt,
  });
  const act = useCallback(
    async (action: PhoneAction) => {
      if (action === 'open_settings') return openPhoneSettings();
      if (!link) return;
      setBusy(true);
      try {
        take(await runPhoneAction(link, action));
      } finally {
        setBusy(false);
      }
    },
    [link, take],
  );
  return {
    view: phoneStatusView(status, { source: server.source, serverName }),
    busy,
    act,
    row: thisPhoneRow(outcome, rows),
    timeZone: facts.timeZone,
  };
}

export type PhoneState = ReturnType<typeof usePhone>;
