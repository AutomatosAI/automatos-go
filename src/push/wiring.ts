// One signed-in session's push, wired (PRD-001 §4.8): PushRoot builds it once per session and
// workspace (memoised), so there is ONE registrar, ONE handled-response store and ONE set of ask
// counters per session (two live handled stores could both pass a claim). Every registrar run —
// launch, resume, a new token, the in-context ask, Settings → Notifications — reports its outcome
// to PushRoot through reportingRegistrar, so the ask sees the status the screen just changed. Remove
// this phone (KP16) runs over that same registrar, the session's client and its teardown, with the
// removal hold the registrar reads. Pure over the natives (natives.ts and PushRoot bind the app's;
// tests pass fakes).

import type { QueryClient } from '@tanstack/react-query';

import type { ApiClient } from '../api/client';
import type { WorkspaceRole } from '../api/workspace';
import { logger } from '../lib/logger';
import type { KeyValueStorage } from '../storage/encrypted-storage';
import { revokeDevice } from './api';
import { phoneRemovalFor, type PhoneRemoval } from './bind/remove-phone';
import { MS_PER_SECOND } from './config';
import { handledStoreOver, type HandledStore } from './inbound/handled-store';
import { refreshAfterPush, type IncomingDeps } from './inbound/receive';
import type { NotificationResponsesDeps } from './inbound/use-notification-responses';
import { staleChecksFor } from './links/stale';
import type { NotificationsPort } from './platform/expo';
import { promptMemoryOver, type PromptMemory } from './prompt/memory';
import type { DeviceSource } from './registration/device-facts';
import type { PushKeyStore } from './registration/key-store';
import { askPermission } from './registration/permission';
import { recoveryLogOver } from './registration/recovery-log';
import type { RegistrationOutcome } from './registration/register';
import { createRegistrar, type Registrar } from './registration/registrar';
import { removalHoldOver, type RemovalHold } from './registration/removal-hold';
import type { PermissionState } from './registration/state';
import { registrationSessionOf, responseSessionOf, type PushSession } from './session';
import type { Sha256 } from './signature/hmac';
import type { TeardownDeps } from './teardown';

/** The native modules push runs over, each behind its one adapter. */
export type PushNatives = Readonly<{
  port: NotificationsPort;
  store: PushKeyStore;
  /** The app's MMKV store (appStorage), opened on first use. */
  storage: () => KeyValueStorage;
  device: DeviceSource;
  sha256: Sha256;
  /** The phone's clock, epoch milliseconds. */
  now: () => number;
}>;

export type WiringInput = Readonly<{
  session: PushSession;
  /** The workspace this session was bootstrapped into (useAppSession().workspace.id). */
  workspaceId: string;
  /** The workspace the client sends now (workspaceIdStore.get). */
  currentWorkspaceId: () => string | null;
  role: () => WorkspaceRole | null;
  client: ApiClient;
  queryClient: Pick<QueryClient, 'invalidateQueries'>;
  /** The path on screen now. */
  currentRoute: () => string | null;
  /** Told each registrar run's outcome. */
  onOutcome: (outcome: RegistrationOutcome) => void;
}>;

export type PushWiring = Readonly<{
  registrar: Registrar;
  /** permission.ts askPermission over the app's port: only from a person's tap (KP11). */
  askPermission: () => Promise<PermissionState>;
  responses: NotificationResponsesDeps;
  incoming: IncomingDeps;
  prompt: PromptMemory;
  teardown: TeardownDeps;
  /** Remove this phone, for a hosted phone's Account (through the phone link). */
  removal: PhoneRemoval;
}>;

/** The registrar, with each run's outcome reported; a report that throws changes nothing. */
export function reportingRegistrar(
  registrar: Registrar,
  report: (outcome: RegistrationOutcome) => void,
): Registrar {
  return Object.freeze({
    run: async (options) => {
      const outcome = await registrar.run(options);
      try {
        if (outcome) report(outcome);
      } catch {
        logger.warn('[push] could not take a registration outcome');
      }
      return outcome;
    },
    latest: registrar.latest,
    close: registrar.close,
  });
}

function registrarFor(
  input: WiringInput,
  natives: PushNatives,
  storage: KeyValueStorage,
  hold: RemovalHold,
) {
  const registrar = createRegistrar({
    session: registrationSessionOf(input.session, input.workspaceId),
    client: input.client,
    port: natives.port,
    device: natives.device,
    store: natives.store,
    recoveries: recoveryLogOver(storage),
    hold,
    now: natives.now,
  });
  return reportingRegistrar(registrar, input.onOutcome);
}

type Shared = Readonly<{ handled: HandledStore; refresh: () => void }>;

function responsesFor(
  input: WiringInput,
  natives: PushNatives,
  shared: Shared,
): NotificationResponsesDeps {
  return Object.freeze({
    session: responseSessionOf(input.session, input.currentWorkspaceId, input.role),
    client: input.client,
    store: natives.store,
    handled: shared.handled,
    checks: staleChecksFor(input.client),
    port: natives.port,
    sha256: natives.sha256,
    nowSeconds: () => Math.floor(natives.now() / MS_PER_SECOND),
    refresh: shared.refresh,
  });
}

type RemovalParts = Readonly<{ hold: RemovalHold; registrar: Registrar; teardown: TeardownDeps }>;

/** Remove this phone in this session's server and workspace (KP16). */
function removalFor(input: WiringInput, natives: PushNatives, parts: RemovalParts): PhoneRemoval {
  return phoneRemovalFor({
    ...parts,
    scope: Object.freeze({
      serverOrigin: input.session.serverOrigin,
      workspaceId: input.workspaceId,
    }),
    store: natives.store,
    revoke: (deviceId) => revokeDevice(input.client, deviceId),
  });
}

export function pushWiringFor(input: WiringInput, natives: PushNatives): PushWiring {
  const storage = natives.storage();
  const handled = handledStoreOver(storage);
  const refresh = () => refreshAfterPush(input.queryClient);
  const responses = responsesFor(input, natives, { handled, refresh });
  const prompt = promptMemoryOver(storage);
  const hold = removalHoldOver(storage);
  const registrar = registrarFor(input, natives, storage, hold);
  const teardown: TeardownDeps = Object.freeze({
    store: natives.store,
    port: natives.port,
    handled,
    prompt,
  });
  return Object.freeze({
    registrar,
    askPermission: () => askPermission(natives.port),
    responses,
    incoming: Object.freeze({
      session: responses.session,
      store: natives.store,
      sha256: natives.sha256,
      nowSeconds: responses.nowSeconds,
      currentRoute: input.currentRoute,
      refresh,
    }),
    prompt,
    teardown,
    removal: removalFor(input, natives, { hold, registrar, teardown }),
  });
}
