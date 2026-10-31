// Push for the signed-in session, in ONE mount (PRD-001 §4.8, KP3): the shell mounts <PushRoot
// session={…}/> once, under the gate's ready session (US-014h). On mount it sets the notification
// platform up (channels, then categories), clears a push record of another server (one forgotten
// while push was not mounted, US-014i) and then runs the session's one registrar, which runs
// again on each resume (the person may have changed the permission in the phone's Settings), on a
// new token and after the in-context ask; it sets the foreground handler (receive.ts: verified
// within FOREGROUND_VERIFY_TIMEOUT_MS, or nothing is shown), handles notification responses
// (useNotificationResponses), keeps the badge on the needs-you number, and attaches the registrar,
// Remove this phone and the session's leave (sign-out, Forget this server, a new pairing: US-014i)
// to the phone link. It listens to the provider's onExpired: an own server that ended the pairing
// leaves push, a hosted session that expired clears the badge and the delivered notifications.
// Unmount takes every listener, the handler and the link away and closes the registrar. It renders
// only the in-context ask, never while the person's Remove this phone holds (promptStatusOf), and the
// approval sheet a tap on an approval's push opens (PRD-268 US-G08: where discovery lists
// approval_view and the role may approve; src/approvals/PushApprovalSheet.tsx). Push is wired again
// only when the session's server or push gates change (sessionKeyOf), never for a rebuilt object.

import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { canApprovalView } from '../api/capabilities';
import { workspaceIdStore } from '../api/workspace';
import { useAppSession } from '../app-state/session';
import { PushApprovalSheet } from '../approvals/PushApprovalSheet';
import { pushApprovals } from '../approvals/push-sheet';
import { roleCan } from '../auth/role';
import { logger } from '../lib/logger';
import { appStorage } from '../storage/mmkv';
import { useAppBadge } from './badge';
import type { PushApprovalSheet as ApprovalSheetPort } from './inbound/handler';
import { handleIncoming } from './inbound/receive';
import { useNotificationResponses } from './inbound/use-notification-responses';
import { pushNatives } from './natives';
import type { ListenerHandle } from './platform/port';
import { setupNotificationPlatform } from './platform/setup';
import { NO_PROMPT_COUNTS, type PromptCounts } from './prompt/memory';
import { promptStatusOf } from './prompt/policy';
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

/**
 * A tap on an approval's push opens its sheet (PRD-268 US-G08) where discovery lists approval_view
 * and the role may approve, both read when the tap lands; elsewhere the tap opens what it did.
 */
function useApprovalSheet(): ApprovalSheetPort {
  const { discovery, workspace } = useAppSession();
  const gate = useLatest(canApprovalView(discovery) && roleCan(workspace.role, 'approve'));
  return useMemo(
    () => Object.freeze({ offered: () => gate.current, open: pushApprovals.open }),
    [gate],
  );
}

function useWiring(given: PushSession, onOutcome: (outcome: RegistrationOutcome) => void) {
  const session = useStableSession(given);
  const { client, workspace } = useAppSession();
  const queryClient = useQueryClient();
  const route = useLatest<string | null>(usePathname());
  const role = useLatest(workspace.role);
  const approvals = useApprovalSheet();
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
          approvals,
        },
        NATIVES,
      ),
    [session, workspaceId, client, queryClient, onOutcome, role, route, approvals],
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

/** Setup and a leftover cleared, then the launch run; again on resume and on a new token. */
function useRegistration(wiring: PushWiring): void {
  const { registrar, askPermission, removal, leave, clearLeftover } = wiring;
  useEffect(() => {
    const { port } = NATIVES;
    void setupNotificationPlatform(port, Platform.OS)
      .then(clearLeftover)
      .then(() => registrar.run());
    const resume = AppState.addEventListener('change', (state) => {
      if (state === 'active') void registrar.run();
    });
    const token = listenSafely(() => watchPushToken(port, registrar), 'a new push token');
    const detach = phoneLinks.attach({ registrar, askPermission, removal, leave });
    return () => {
      detach();
      token.remove();
      resume.remove();
      void registrar.close();
    };
  }, [registrar, askPermission, removal, leave, clearLeftover]);
}

/** The session the server or Clerk no longer accepts (the foundation's onExpired). */
function useExpiry(provider: PushSession['provider'], { expired }: PushWiring): void {
  useEffect(() => {
    try {
      return provider.onExpired(() => void expired());
    } catch {
      logger.warn('[push] could not listen for an ended session');
      return undefined;
    }
  }, [provider, expired]);
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
  const onOutcome = useCallback(
    (outcome: RegistrationOutcome) => setStatus(promptStatusOf(outcome)),
    [],
  );
  const wiring = useWiring(session, onOutcome);
  useRegistration(wiring);
  useExpiry(session.provider, wiring);
  useForegroundHandler(wiring);
  useNotificationResponses(wiring.responses);
  useAppBadge(NATIVES.port);
  const { counts, decline } = usePromptCounts(wiring);
  const { askPermission, registrar } = wiring;
  const turnOn = useCallback(async () => {
    await askPermission();
    await registrar.run(FORCED);
  }, [askPermission, registrar]);
  return (
    <>
      <PushPrompt status={status} counts={counts} onDecline={decline} onTurnOn={turnOn} />
      <PushApprovalSheet />
    </>
  );
}
