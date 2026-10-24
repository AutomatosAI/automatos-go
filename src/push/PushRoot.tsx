// Push for the signed-in session, in ONE mount (PRD-001 §4.8, KP3): the shell mounts <PushRoot
// session={…}/> once, under the gate's ready session (US-014h). On mount it sets the notification
// platform up (channels, then categories) and then runs the session's one registrar, which runs
// again on each resume (the person may have changed the permission in the phone's Settings), on a
// new token and after the in-context ask; it sets the foreground handler (receive.ts: verified
// within FOREGROUND_VERIFY_TIMEOUT_MS, or nothing is shown), handles notification responses
// (useNotificationResponses), keeps the badge on the needs-you number, and attaches the registrar
// for Settings → Notifications. Unmount takes every listener, the handler and the link away and
// closes the registrar. It renders only the in-context ask. Push is wired again only when the
// session's server or push gates change (sessionKeyOf), never for a rebuilt object.

import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { workspaceIdStore } from '../api/workspace';
import { useAppSession } from '../app-state/session';
import { logger } from '../lib/logger';
import { appStorage } from '../storage/mmkv';
import { useAppBadge } from './badge';
import { handleIncoming } from './inbound/receive';
import { useNotificationResponses } from './inbound/use-notification-responses';
import { pushNatives } from './natives';
import type { ListenerHandle } from './platform/port';
import { setupNotificationPlatform } from './platform/setup';
import { NO_PROMPT_COUNTS, type PromptCounts } from './prompt/memory';
import { PushPrompt } from './prompt/PushPrompt';
import type { RegistrationOutcome } from './registration/register';
import { watchPushToken } from './registration/registrar';
import type { PushStatus } from './registration/state';
import { sessionKeyOf, type PushSession } from './session';
import { phoneLinks } from './settings/phone-link';
import { pushWiringFor, type PushNatives, type PushWiring } from './wiring';

/** The natives, with the app's MMKV for the handled keys, the counters and the recovery log. */
const NATIVES: PushNatives = Object.freeze({ ...pushNatives, storage: appStorage });

const FORCED = Object.freeze({ force: true });

const NOT_LISTENING: ListenerHandle = Object.freeze({ remove: () => undefined });

export type PushRootProps = { readonly session: PushSession };

/** A ref that holds the latest value (read later by a callback, never during render). */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/** The session as first seen, until its key changes (React's derived-state update in render). */
function useStableSession(session: PushSession): PushSession {
  const key = sessionKeyOf(session);
  const [held, setHeld] = useState({ key, session });
  if (held.key === key) return held.session;
  setHeld({ key, session });
  return session;
}

function useWiring(given: PushSession, onOutcome: (outcome: RegistrationOutcome) => void) {
  const session = useStableSession(given);
  const { client, workspace } = useAppSession();
  const queryClient = useQueryClient();
  const route = useLatest<string | null>(usePathname());
  const role = useLatest(workspace.role);
  const workspaceId = workspace.id;
  return useMemo(
    () =>
      pushWiringFor(
        {
          session,
          workspaceId,
          currentWorkspaceId: workspaceIdStore.get,
          role: () => role.current,
          client,
          queryClient,
          currentRoute: () => route.current,
          onOutcome,
        },
        NATIVES,
      ),
    [session, workspaceId, client, queryClient, onOutcome, role, route],
  );
}

/** A native listener, or none when the module refuses it (logged; push carries on without it). */
function listenSafely(listen: () => ListenerHandle, what: string): ListenerHandle {
  try {
    return listen();
  } catch {
    logger.warn(`[push] could not listen for ${what}`);
    return NOT_LISTENING;
  }
}

/** Setup, then the launch run; again on resume and on a new token. Settings reads the registrar. */
function useRegistration({ registrar, askPermission }: PushWiring): void {
  useEffect(() => {
    const { port } = NATIVES;
    void setupNotificationPlatform(port, Platform.OS).then(() => registrar.run());
    const resume = AppState.addEventListener('change', (state) => {
      if (state === 'active') void registrar.run();
    });
    const token = listenSafely(() => watchPushToken(port, registrar), 'a new push token');
    const detach = phoneLinks.attach({ registrar, askPermission });
    return () => {
      detach();
      token.remove();
      resume.remove();
      void registrar.close();
    };
  }, [registrar, askPermission]);
}

/** While the app is open, a push shows only once it verifies (receive.ts). */
function useForegroundHandler({ incoming }: PushWiring): void {
  useEffect(() => {
    const { port } = NATIVES;
    try {
      port.setNotificationHandler({
        handleNotification: (notification) => handleIncoming(notification, incoming),
      });
    } catch {
      logger.warn('[push] could not set the foreground handler');
    }
    return () => {
      try {
        port.setNotificationHandler(null);
      } catch {
        logger.warn('[push] could not remove the foreground handler');
      }
    };
  }, [incoming]);
}

/** This session counted once, and each 'Not now' noted (prompt/memory.ts). */
function usePromptCounts({ prompt }: PushWiring) {
  const [counts, setCounts] = useState<PromptCounts>(NO_PROMPT_COUNTS);
  useEffect(() => setCounts(prompt.countSession()), [prompt]);
  const decline = useCallback(() => setCounts(prompt.noteDecline(Date.now())), [prompt]);
  return { counts, decline };
}

export function PushRoot({ session }: PushRootProps) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const onOutcome = useCallback((outcome: RegistrationOutcome) => setStatus(outcome.status), []);
  const wiring = useWiring(session, onOutcome);
  useRegistration(wiring);
  useForegroundHandler(wiring);
  useNotificationResponses(wiring.responses);
  useAppBadge(NATIVES.port);
  const { counts, decline } = usePromptCounts(wiring);
  const { askPermission, registrar } = wiring;
  const turnOn = useCallback(async () => {
    await askPermission();
    await registrar.run(FORCED);
  }, [askPermission, registrar]);
  return <PushPrompt status={status} counts={counts} onDecline={decline} onTurnOn={turnOn} />;
}
