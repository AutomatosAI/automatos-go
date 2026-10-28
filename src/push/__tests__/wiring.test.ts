// One session's push, wired (US-014g): the session's two views (registration, responses) and its
// key, the registrar that reports every run's outcome to PushRoot, and pushWiringFor over fakes — ONE
// handled store shared by the responses and the teardown, the clock in seconds for the signature,
// the ask through the port's permission request (badge included), a refresh that invalidates the
// needs-you and questions families, and a registrar bound to this server and workspace that waits
// at 'ask' until a person's tap, sending nothing.

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthProvider } from '../../auth/providers/types';
import { queryKeys } from '../../api/query-keys';
import type { RegistrationOutcome } from '../registration/register';
import type { Registrar } from '../registration/registrar';
import {
  registrationSessionOf,
  responseSessionOf,
  sessionKeyOf,
  type PushSession,
} from '../session';
import { pushQueryKeys } from '../query-keys';
import { pushWiringFor, reportingRegistrar, type PushNatives } from '../wiring';
import { DEVICE_ID, WS } from './data-fixtures';
import { memoryStorage, nodeSha256 } from './handler-fixtures';
import {
  GRANTED,
  INSTALL_ID,
  ORIGIN,
  T0,
  UNDETERMINED,
  facts,
  setup,
  storedRecord,
} from './registration-fixtures';

// The registration fixtures build the real key store over a fake SecureStore.
vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const provider: AuthProvider = {
  kind: 'clerk',
  getToken: async () => null,
  signOut: async () => undefined,
  onExpired: () => () => undefined,
};

const SESSION: PushSession = Object.freeze({
  serverOrigin: ORIGIN,
  serverName: 'Automatos',
  source: 'hosted',
  getInstallId: async () => INSTALL_ID,
  pushExpo: true,
  capabilities: Object.freeze(['push', 'digest']),
  provider,
});

const OUTCOME: RegistrationOutcome = Object.freeze({
  step: 'none',
  status: Object.freeze({ kind: 'ask' }),
  facts: facts(),
});

afterEach(() => vi.restoreAllMocks());

describe("the session's views", () => {
  it('registration: this server and workspace, the push capability and push.expo', () => {
    expect(registrationSessionOf(SESSION, WS)).toEqual({
      source: 'hosted',
      serverOrigin: ORIGIN,
      workspaceId: WS,
      capabilityPush: true,
      pushExpo: true,
      getInstallId: SESSION.getInstallId,
    });
    const own = { ...SESSION, source: 'own' as const, capabilities: ['digest'], pushExpo: false };
    expect(registrationSessionOf(own, WS)).toMatchObject({
      source: 'own',
      capabilityPush: false,
      pushExpo: false,
    });
  });

  it('a rebuilt session with the same server and gates keeps its key; a change makes another', () => {
    const rebuilt = {
      ...SESSION,
      capabilities: ['digest', 'push'],
      getInstallId: async () => INSTALL_ID,
    };
    expect(sessionKeyOf(rebuilt)).toBe(sessionKeyOf(SESSION));
    expect(sessionKeyOf({ ...SESSION, pushExpo: false })).not.toBe(sessionKeyOf(SESSION));
    expect(sessionKeyOf({ ...SESSION, capabilities: ['digest'] })).not.toBe(sessionKeyOf(SESSION));
    expect(sessionKeyOf({ ...SESSION, source: 'own' })).not.toBe(sessionKeyOf(SESSION));
    expect(sessionKeyOf({ ...SESSION, serverOrigin: 'https://own.example.test' })).not.toBe(
      sessionKeyOf(SESSION),
    );
  });

  it('responses: the workspace and role read when a response arrives', () => {
    let workspaceId: string | null = WS;
    const view = responseSessionOf(
      SESSION,
      () => workspaceId,
      () => 'editor',
    );
    expect(view.serverOrigin).toBe(ORIGIN);
    workspaceId = null;
    expect(view.workspaceId()).toBeNull();
    expect(view.role()).toBe('editor');
  });
});

function fakeRegistrar(answer: RegistrationOutcome | null): Registrar {
  return {
    run: vi.fn(async () => answer),
    latest: () => answer,
    close: vi.fn(async () => undefined),
  };
}

describe('reportingRegistrar', () => {
  it('reports each run, passes its options and outcome on, and shares latest and close', async () => {
    const inner = fakeRegistrar(OUTCOME);
    const report = vi.fn();
    const registrar = reportingRegistrar(inner, report);
    expect(await registrar.run({ force: true })).toBe(OUTCOME);
    expect(inner.run).toHaveBeenCalledWith({ force: true });
    expect(report).toHaveBeenCalledWith(OUTCOME);
    expect(registrar.latest()).toBe(OUTCOME);
    await registrar.close();
    expect(inner.close).toHaveBeenCalledTimes(1);
  });

  it('reports nothing for a run that answered nothing; a report that throws changes nothing', async () => {
    const quiet = vi.fn();
    expect(await reportingRegistrar(fakeRegistrar(null), quiet).run()).toBeNull();
    expect(quiet).not.toHaveBeenCalled();
    const throwing = reportingRegistrar(fakeRegistrar(OUTCOME), () => {
      throw new Error('unmounted');
    });
    expect(await throwing.run()).toBe(OUTCOME);
  });
});

function wired(permission = UNDETERMINED) {
  const env = setup({ permission });
  const storage = memoryStorage();
  const requests: unknown[] = [];
  const port = {
    ...env.deps.port,
    requestPermissionsAsync: async (request: unknown) => {
      requests.push(request);
      return GRANTED;
    },
  } as unknown as PushNatives['port'];
  const natives: PushNatives = {
    port,
    store: env.keys.store,
    storage: () => storage,
    device: env.device.source,
    sha256: nodeSha256,
    now: () => T0 + 999,
  };
  const invalidateQueries = vi.fn(async () => undefined);
  const outcomes: RegistrationOutcome[] = [];
  const wiring = pushWiringFor(
    {
      session: SESSION,
      workspaceId: WS,
      currentWorkspaceId: () => WS,
      role: () => 'editor',
      client: env.api.client,
      queryClient: { invalidateQueries },
      currentRoute: () => '/',
      onOutcome: (outcome) => void outcomes.push(outcome),
    },
    natives,
  );
  return { env, wiring, requests, invalidateQueries, outcomes };
}

describe('pushWiringFor', () => {
  it('shares ONE handled store between the responses and the teardown', () => {
    const { wiring } = wired();
    expect(wiring.responses.handled.claim('a|open')).toBe(true);
    expect(wiring.responses.handled.claim('a|open')).toBe(false);
    wiring.teardown.handled.clear();
    expect(wiring.responses.handled.claim('a|open')).toBe(true);
    expect(wiring.teardown.prompt).toBe(wiring.prompt);
  });

  it('reads the clock in epoch seconds and binds the response session', () => {
    const { wiring } = wired();
    expect(wiring.responses.nowSeconds()).toBe(T0 / 1000);
    expect(wiring.incoming.nowSeconds()).toBe(T0 / 1000);
    expect(wiring.responses.session.serverOrigin).toBe(ORIGIN);
    expect(wiring.responses.session.workspaceId()).toBe(WS);
    expect(wiring.incoming.currentRoute()).toBe('/');
  });

  it('a refresh invalidates the needs-you and questions families, and the inbox', async () => {
    const { wiring, invalidateQueries } = wired();
    wiring.incoming.refresh();
    wiring.responses.refresh?.();
    // each refresh: the two families (one predicate) and the inbox (its key)
    expect(invalidateQueries).toHaveBeenCalledTimes(4);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: pushQueryKeys.inbox() });
    const [[filters]] = invalidateQueries.mock.calls as unknown as [
      [{ predicate: (query: { queryKey: readonly unknown[] }) => boolean }],
    ];
    expect(filters.predicate({ queryKey: queryKeys.needsYou() })).toBe(true);
    expect(filters.predicate({ queryKey: queryKeys.questions() })).toBe(true);
    expect(filters.predicate({ queryKey: queryKeys.board() })).toBe(false);
  });

  it('asks the OS through the port, for alerts, the badge and sounds', async () => {
    const { wiring, requests } = wired();
    expect(await wiring.askPermission()).toBe('granted');
    expect(requests).toEqual([{ ios: { allowAlert: true, allowBadge: true, allowSound: true } }]);
  });

  it("registers in this server and workspace: at 'ask' it sends nothing and reports the status", async () => {
    const { wiring, env, outcomes } = wired();
    const outcome = await wiring.registrar.run();
    expect(outcome?.status).toEqual({ kind: 'ask' });
    expect(outcomes).toEqual([outcome]);
    expect(env.api.routes()).toEqual([]);
    expect(env.device.state.tokenReads).toBe(0);
  });

  it('binds the leave and the leftover check to this server, workspace and client (US-014i)', async () => {
    const { wiring, env } = wired();
    await env.keys.store.save(storedRecord());
    expect(await wiring.clearLeftover()).toBe(false);
    await wiring.leave();
    expect(env.api.routes()).toEqual([`DELETE /api/v1/mobile/devices/${DEVICE_ID}`]);
    expect(await env.keys.store.load()).toBeNull();
    // the registrar is closed: a resume after the leave sends nothing
    await wiring.registrar.run();
    expect(env.api.calls).toHaveLength(1);
  });
});
