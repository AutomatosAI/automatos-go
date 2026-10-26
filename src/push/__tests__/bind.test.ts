// Into the shell (US-014h): the push session built from the merged code — the connect kit's current
// server (hosted, or the paired own server in words), its ONE install id (the connect kit's own
// getInstallId, mocked here and seen in the POST), the provider, and push.expo and the capabilities
// from discovery (an own server whose operator said no is operator_off and registers nothing; a
// later launch's 'Yes' registers) — and Remove this phone (KP16) over the real registrar and key
// store: hold, the run under way ends, DELETE the row read after it, teardown, 'ask'; a failed
// DELETE still tears down and says Studio may still list the phone; logs carry kinds only. Then the
// shell's two seam edits, read as source: PushRoot mounted once, the Notifications row and Remove
// this phone after the rows already on Account.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { jsonReply } from '../../api/__tests__/fake-transport';
import { ownServerFrom } from '../../api/server';
import type { AuthProvider } from '../../auth/providers/types';
import { revokeDevice } from '../api';
import { buildPushSession, serverNameOf, type SessionInput } from '../bind/build-session';
import {
  phoneRemovalFor,
  removalNotice,
  removePhone,
  removeShown,
  type RemovalDeps,
} from '../bind/remove-phone';
import { register } from '../registration/register';
import { createRegistrar } from '../registration/registrar';
import type { RecordScope } from '../registration/record';
import { removalHoldOver } from '../registration/removal-hold';
import { registrationSessionOf } from '../session';
import { PUSH_ACCOUNT_COPY } from '../strings';
import { DEVICE_ID, WS, sent } from './data-fixtures';
import { spyOnLogger } from './handler-fixtures';
import { fakePort } from './platform-fixtures';
import {
  KEY,
  NEW_KEY,
  ORIGIN,
  OTHER_DEVICE_ID,
  TOKEN,
  answering,
  facts,
  holding,
  minted,
  offline,
  setup,
  storedRecord,
  type Answer,
  type Script,
} from './registration-fixtures';

// The registration fixtures build the real key store over a fake SecureStore.
vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const CONNECT_INSTALL_ID = 'connect-install-id-0001';
const connect = vi.hoisted(() => ({ getInstallId: vi.fn() }));
vi.mock('../../connect/install-id', () => connect);

const OWN_ORIGIN = 'http://192.168.1.20:8000';
const SCOPE: RecordScope = Object.freeze({ serverOrigin: ORIGIN, workspaceId: WS });

const provider: AuthProvider = {
  kind: 'clerk',
  getToken: async () => null,
  signOut: async () => undefined,
  onExpired: () => () => undefined,
};

const HOSTED_INPUT: SessionInput = {
  server: { apiUrl: ORIGIN, source: 'hosted' },
  own: null,
  discovery: { push: { expo: true }, capabilities: ['push', 'digest'] },
  provider,
};

const OWN = { serverName: 'Automatos', server: ownServerFrom({ origin: OWN_ORIGIN, webUrl: '' }) };

function ownInput(expo: boolean): SessionInput {
  return {
    server: { apiUrl: OWN_ORIGIN, source: 'own' },
    own: OWN,
    discovery: { push: { expo }, capabilities: ['push'] },
    provider,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  connect.getInstallId.mockReset();
});

describe('the push session, from the connect kit, the provider and discovery', () => {
  it('a hosted session: the hosted server by name, push.expo and the capabilities as discovered', () => {
    const session = buildPushSession(HOSTED_INPUT);
    expect(session).toMatchObject({
      serverOrigin: ORIGIN,
      serverName: 'Automatos',
      source: 'hosted',
      pushExpo: true,
      capabilities: ['push', 'digest'],
      provider,
    });
    expect(Object.isFrozen(session)).toBe(true);
  });

  it("an own session: the paired server's name and address; a hosted server never takes them", () => {
    expect(buildPushSession(ownInput(true))).toMatchObject({
      serverOrigin: OWN_ORIGIN,
      serverName: 'Automatos (192.168.1.20:8000)',
      source: 'own',
    });
    expect(buildPushSession({ ...HOSTED_INPUT, own: OWN }).serverName).toBe('Automatos');
    expect(serverNameOf(null)).toBe('Automatos');
  });

  it("the install id is the connect kit's getInstallId, one reference for every session", async () => {
    connect.getInstallId.mockResolvedValue(CONNECT_INSTALL_ID);
    const first = buildPushSession(HOSTED_INPUT);
    await expect(first.getInstallId()).resolves.toBe(CONNECT_INSTALL_ID);
    expect(connect.getInstallId).toHaveBeenCalledTimes(1);
    expect(connect.getInstallId).toHaveBeenCalledWith();
    expect(buildPushSession(ownInput(true)).getInstallId).toBe(first.getInstallId);
  });

  it('an own server with push.expo false: operator_off, nothing sent, no install id read', async () => {
    const world = setup({ session: registrationSessionOf(buildPushSession(ownInput(false)), WS) });
    const outcome = await register(world.deps);
    expect(outcome.status).toEqual({ kind: 'operator_off' });
    expect(world.api.calls).toHaveLength(0);
    expect(world.device.state.tokenReads).toBe(0);
    expect(connect.getInstallId).not.toHaveBeenCalled();
  });

  it("the operator's later 'Yes' (a later launch's discovery) registers with the connect install id", async () => {
    connect.getInstallId.mockResolvedValue(CONNECT_INSTALL_ID);
    const session = registrationSessionOf(buildPushSession(ownInput(true)), WS);
    const world = setup({ session, script: { register: [minted(KEY)] } });
    const outcome = await register(world.deps);
    expect(outcome.status).toEqual({ kind: 'on' });
    expect(world.api.routes()).toEqual(['POST /api/v1/mobile/devices']);
    expect(sent(world.api.calls[0]).body).toMatchObject({ install_id: CONNECT_INSTALL_ID });
  });
});

type Removal = Readonly<{
  world: ReturnType<typeof setup>;
  registrar: ReturnType<typeof createRegistrar>;
  hold: ReturnType<typeof removalHoldOver>;
  steps: string[];
  deps: RemovalDeps;
}>;

/** A hosted phone holding its record, the real registrar, and Remove this phone over them. */
function removal(script: Script = {}, stored = holding(storedRecord())): Removal {
  const world = setup({ stored, script });
  const registrar = createRegistrar(world.deps);
  const hold = removalHoldOver(world.storage);
  const steps: string[] = [];
  const { port } = fakePort({
    setBadgeCountAsync: async (count) => {
      steps.push(`badge:${count}`);
      return true;
    },
    dismissAllNotificationsAsync: async () => {
      steps.push('dismiss');
    },
  });
  const deps: RemovalDeps = {
    scope: SCOPE,
    hold,
    registrar,
    store: world.keys.store,
    revoke: (deviceId) => revokeDevice(world.api.client, deviceId),
    teardown: {
      store: world.keys.store,
      port,
      handled: { clear: () => void steps.push('handled') },
      prompt: { clear: () => void steps.push('prompt') },
    },
  };
  return { world, registrar, hold, steps, deps };
}

describe('Remove this phone (KP16): DELETE, then teardown, then ask', () => {
  it('holds first, DELETEs its own row, clears the phone, and answers ask; nothing registers after', async () => {
    let heldAtDelete = false;
    const removed: Answer = () => {
      heldAtDelete = hold.held(SCOPE);
      return jsonReply(200, {});
    };
    const { world, registrar, hold, steps, deps } = removal({ revoke: [removed] });
    const link = phoneRemovalFor(deps);
    await expect(link.deviceId()).resolves.toBe(DEVICE_ID);
    await expect(link.remove()).resolves.toEqual({ removed: true, status: { kind: 'ask' } });
    expect(heldAtDelete).toBe(true);
    expect(world.api.routes()).toEqual([`DELETE /api/v1/mobile/devices/${DEVICE_ID}`]);
    expect(world.keys.held()).toBeNull();
    expect(steps).toEqual(['badge:0', 'dismiss', 'handled', 'prompt']);
    await expect(link.deviceId()).resolves.toBeNull();
    // a resume, a new token or the next launch: still 'ask', nothing sent
    expect((await registrar.run())?.status).toEqual({ kind: 'ask' });
    expect(world.api.calls).toHaveLength(1);
  });

  it("'Turn on notifications' (a forced run) releases the hold and registers afresh", async () => {
    const { world, registrar, hold, deps } = removal({
      revoke: [answering(200, {})],
      register: [minted(NEW_KEY)],
    });
    await removePhone(deps);
    const outcome = await registrar.run({ force: true });
    expect(outcome?.status).toEqual({ kind: 'on' });
    expect(world.api.routes()).toEqual([
      `DELETE /api/v1/mobile/devices/${DEVICE_ID}`,
      'POST /api/v1/mobile/devices',
    ]);
    expect(hold.held(SCOPE)).toBe(false);
    expect(world.keys.held()).toMatchObject({ deviceId: DEVICE_ID, pushKey: NEW_KEY });
  });

  it.each<[string, Answer]>([
    ['a refusal', answering(500, {})],
    ['no network', offline],
  ])(
    'a failed DELETE (%s) still tears down, answers ask and says Studio may still list it',
    async (_, answer) => {
      const lines = spyOnLogger();
      const { world, steps, deps } = removal({ revoke: [answer] });
      const outcome = await removePhone(deps);
      expect(outcome).toEqual({ removed: false, status: { kind: 'ask' } });
      expect(world.keys.held()).toBeNull();
      expect(steps).toEqual(['badge:0', 'dismiss', 'handled', 'prompt']);
      expect(removalNotice(outcome)).toBe(PUSH_ACCOUNT_COPY.removeFailed);
      expect(PUSH_ACCOUNT_COPY.removeFailed).toContain('Studio may still list this phone.');
      const logged = lines.join(' ');
      for (const secret of [DEVICE_ID, KEY, TOKEN]) expect(logged).not.toContain(secret);
    },
  );

  it('a row already gone (404) counts as removed', async () => {
    const { deps } = removal({ revoke: [answering(404, { detail: 'Not found' })] });
    expect(await removePhone(deps)).toEqual({ removed: true, status: { kind: 'ask' } });
    expect(removalNotice({ removed: true })).toBe(PUSH_ACCOUNT_COPY.removed);
  });

  it('the run under way ends before the row goes, and the row is the one read after it', async () => {
    const order: string[] = [];
    let record = storedRecord();
    const deps: RemovalDeps = {
      scope: SCOPE,
      hold: { hold: () => void order.push('hold') },
      registrar: {
        run: async () => {
          order.push('run');
          // the run under way registered again, under another row
          record = storedRecord({ deviceId: OTHER_DEVICE_ID });
          return { step: 'none', status: { kind: 'ask' }, facts: facts({ held: true }) };
        },
      },
      store: { load: async () => (order.push('load'), record) },
      revoke: async (deviceId) => void order.push(`revoke:${deviceId}`),
      teardown: {
        store: { clear: async () => void order.push('clear') },
        port: {
          setBadgeCountAsync: async () => (order.push('badge'), true),
          dismissAllNotificationsAsync: async () => void order.push('dismiss'),
        },
        handled: { clear: () => void order.push('handled') },
        prompt: { clear: () => void order.push('prompt') },
      },
    };
    await removePhone(deps);
    expect(order).toEqual([
      'hold',
      'run',
      'load',
      `revoke:${OTHER_DEVICE_ID}`,
      'clear',
      'badge',
      'dismiss',
      'handled',
      'prompt',
      'run',
    ]);
  });

  it("no record for this session (another workspace's, or a keychain that refused): no DELETE, still torn down", async () => {
    const other = removal({}, holding(storedRecord({ workspaceId: 'another-workspace' })));
    expect(await removePhone(other.deps)).toEqual({ removed: false, status: { kind: 'ask' } });
    expect(other.world.api.calls).toHaveLength(0);
    const refused = removal();
    const failing = { load: async () => Promise.reject(new Error('keychain locked')) };
    const lines = spyOnLogger();
    await expect(
      phoneRemovalFor({ ...refused.deps, store: failing }).deviceId(),
    ).resolves.toBeNull();
    expect(lines.join(' ')).not.toContain('keychain locked');
  });

  it('shown only to a hosted phone with a push record while PushRoot is linked', () => {
    expect(removeShown({ source: 'hosted', linked: true, deviceId: DEVICE_ID })).toBe(true);
    expect(removeShown({ source: 'own', linked: true, deviceId: DEVICE_ID })).toBe(false);
    expect(removeShown({ source: 'hosted', linked: true, deviceId: null })).toBe(false);
    expect(removeShown({ source: 'hosted', linked: false, deviceId: DEVICE_ID })).toBe(false);
  });
});

describe('the copy on Account (KP8, D63, D-NO-SIGNUP, D-NO-BILLING)', () => {
  it("asks with the AC's words; nothing deletes an account or a workspace; no sign-up, no plan", () => {
    expect(PUSH_ACCOUNT_COPY.removeQuestion).toBe(
      "Remove this phone from your workspace's devices? Notifications stop here until you turn them on again. You stay signed in.",
    );
    for (const line of Object.values(PUSH_ACCOUNT_COPY)) {
      expect(line).not.toMatch(/delet|sign up|create an account|resum|plan|credit|price/i);
    }
  });
});

describe('the shell (seam edits, read as source)', () => {
  const app = path.resolve(__dirname, '../../../app/(app)');
  const read = (file: string) => readFileSync(path.join(app, file), 'utf8');

  it('the signed-in layout mounts PushRoot once, with the session usePushSession builds', () => {
    const layout = read('_layout.tsx');
    expect(layout.match(/<PushRoot\b/g)).toHaveLength(1);
    expect(layout).toContain('<PushRoot session={usePushSession()} />');
    expect(layout.indexOf('<SessionPush />')).toBeGreaterThan(layout.indexOf('<Stack'));
  });

  it('Account: the Notifications row and Remove this phone come after the rows already there', () => {
    const account = read('settings/index.tsx');
    const server = account.indexOf('<ServerSection');
    const rows = account.indexOf('<InfoRow row={row} />');
    const notifications = account.indexOf('router.push(pushScreens.notifications)');
    expect(server).toBeGreaterThan(-1);
    expect(notifications).toBeGreaterThan(rows);
    expect(account.indexOf('<RemovePhone />')).toBeGreaterThan(notifications);
  });
});
