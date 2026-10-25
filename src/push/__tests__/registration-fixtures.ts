// Shared fixtures of the registration tests: the facts, a session, a fake phone (DeviceSource), a
// fake permission port, the real key store over a fake key registry and a fake SecureStore, a fake
// MMKV for the recovery log, and a client over the foundation's fake transport that answers each
// device route from a script. A test file that imports this mocks expo-secure-store first.

import type { StreamingResponse, TransportRequest } from '../../api/transport-types';
import { jsonReply, reply } from '../../api/__tests__/fake-transport';
import { fakeSecureStore, KEYCHAIN_OPTIONS } from '../../lib/__tests__/fake-secure-store';
import { createSecureKeyRegistry } from '../../lib/secure-keys';
import { PUSH_RECORD_ITEM } from '../config';
import type { DeviceFacts, DeviceSource } from '../registration/device-facts';
import { createPushKeyStore } from '../registration/key-store';
import type { PushRecord } from '../registration/record';
import { recoveryLogOver } from '../registration/recovery-log';
import { removalHoldOver } from '../registration/removal-hold';
import type { RegisterDeps, RegistrationSession } from '../registration/register';
import type { PushFacts } from '../registration/state';
import type { PermissionAnswer } from '../platform/port';
import { DEVICE_ID, WS, harness } from './data-fixtures';
import { fakePort } from './platform-fixtures';

export const ORIGIN = 'https://api.example.test';
export const INSTALL_ID = 'install-abc-123';
export const OTHER_DEVICE_ID = '7c6b5a49-3e2d-4c1b-9a08-f7e6d5c4b3a2';
export const OTHER_WORKSPACE = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
export const PROJECT_ID = '7b4ae66f-9733-4d53-a221-182c1692d574';
export const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
export const NEW_TOKEN = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';
export const KEY = `minted-${'k'.repeat(36)}`;
export const NEW_KEY = `minted-${'n'.repeat(36)}`;
export const T0 = 1_792_540_800_000;

export const GRANTED: PermissionAnswer = {
  status: 'granted',
  canAskAgain: true,
  provisional: false,
};
export const DENIED: PermissionAnswer = {
  status: 'denied',
  canAskAgain: false,
  provisional: false,
};
export const UNDETERMINED: PermissionAnswer = {
  status: 'undetermined',
  canAskAgain: true,
  provisional: false,
};

export const HOSTED: RegistrationSession = Object.freeze({
  source: 'hosted',
  serverOrigin: ORIGIN,
  workspaceId: WS,
  capabilityPush: true,
  pushExpo: true,
  getInstallId: async () => INSTALL_ID,
});
export const OWN: RegistrationSession = Object.freeze({ ...HOSTED, source: 'own' });

export const PHONE: DeviceFacts = Object.freeze({
  projectId: PROJECT_ID,
  platform: 'ios',
  appVersion: '1.0.0',
  locale: 'en-IE',
  timeZone: 'Europe/Dublin',
  name: 'iPhone 16 Pro',
});

/** A stored record for DEVICE_ID, registered at T0 with PHONE's facts (fingerprint filled in). */
export function storedRecord(overrides: Partial<PushRecord> = {}): PushRecord {
  return {
    serverOrigin: ORIGIN,
    workspaceId: WS,
    deviceId: DEVICE_ID,
    pushKey: KEY,
    expoToken: TOKEN,
    fingerprint: JSON.stringify([
      ORIGIN,
      WS,
      INSTALL_ID,
      TOKEN,
      'en-IE',
      'Europe/Dublin',
      '1.0.0',
      'iPhone 16 Pro',
    ]),
    registeredAt: T0,
    switchedOff: false,
    ...overrides,
  };
}

/** Facts for the pure tests: a hosted phone, granted, registered and on. */
export function facts(overrides: Partial<PushFacts> = {}): PushFacts {
  return {
    capabilityPush: true,
    pushExpo: true,
    source: 'hosted',
    projectId: PROJECT_ID,
    permission: 'granted',
    record: storedRecord(),
    serverRow: null,
    lastConflict: null,
    held: false,
    ...overrides,
  };
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export type Answer = () => StreamingResponse | Promise<StreamingResponse>;

/** What the server answers each device route; a route left out answers 500. */
export type Script = { register?: Answer[]; update?: Answer[]; revoke?: Answer[] };

export const minted =
  (key: string | null, deviceId = DEVICE_ID): Answer =>
  () =>
    jsonReply(200, { device_id: deviceId, push_key: key });
export const conflict =
  (code: string): Answer =>
  () =>
    jsonReply(409, { detail: { code } });
export const answering =
  (status: number, body: unknown): Answer =>
  () =>
    jsonReply(status, body);
export const ok: Answer = answering(200, {});
export const offline: Answer = () => {
  throw new TypeError('Network request failed');
};

function routeOf(request: TransportRequest): keyof Script {
  if (request.method === 'POST') return 'register';
  return request.method === 'PATCH' ? 'update' : 'revoke';
}

/** A client whose device routes answer from the script, in order. */
export function server(script: Script = {}) {
  const queues = {
    register: [...(script.register ?? [])],
    update: [...(script.update ?? [])],
    revoke: [...(script.revoke ?? [])],
  };
  const { client, calls } = harness((request) =>
    (queues[routeOf(request)].shift() ?? (() => reply(500)))(),
  );
  const routes = () => calls.map((call) => `${call.method} ${new URL(call.url).pathname}`);
  return { client, calls, routes };
}

/** The real key store over the app's registry rules, on a fake SecureStore. */
export function keychain(initial: Record<string, string> = {}) {
  const secure = fakeSecureStore(initial);
  const registry = createSecureKeyRegistry({ store: secure, options: KEYCHAIN_OPTIONS });
  const store = createPushKeyStore({ keys: registry, deviceOnly: true });
  const held = (): unknown => JSON.parse(secure.items.get(PUSH_RECORD_ITEM) ?? 'null');
  return { secure, registry, store, held };
}

export const holding = (record: PushRecord) => ({ [PUSH_RECORD_ITEM]: JSON.stringify(record) });

/** A fake phone: its facts, and the token it answers (null: none this time). */
export function phone(overrides: Partial<DeviceFacts> = {}, token: string | null = TOKEN) {
  const state = { facts: { ...PHONE, ...overrides }, token, tokenReads: 0 };
  const source: DeviceSource = {
    read: () => state.facts,
    expoToken: async () => {
      state.tokenReads += 1;
      return state.token;
    },
  };
  return { state, source };
}

/** An MMKV stand-in for the recovery log. */
export function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
}

export type Setup = {
  session?: RegistrationSession;
  permission?: PermissionAnswer;
  script?: Script;
  stored?: Record<string, string>;
  device?: ReturnType<typeof phone>;
  storage?: ReturnType<typeof memoryStorage>;
};

/** Everything register() takes, with handles to look at each fake afterwards. */
export function setup(options: Setup = {}) {
  const clock = { now: T0 };
  const permission = { answer: options.permission ?? GRANTED };
  const api = server(options.script);
  const keys = keychain(options.stored);
  const device = options.device ?? phone();
  const storage = options.storage ?? memoryStorage();
  const { port, calls: portCalls } = fakePort({
    getPermissionsAsync: async () => permission.answer,
  });
  const deps: RegisterDeps = {
    session: options.session ?? HOSTED,
    client: api.client,
    port,
    device: device.source,
    store: keys.store,
    recoveries: recoveryLogOver(storage),
    hold: removalHoldOver(storage),
    now: () => clock.now,
  };
  return { deps, clock, permission, api, keys, device, storage, portCalls };
}
