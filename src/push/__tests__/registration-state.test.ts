// The pure half of registration (PRD-001 §4.8, KP10, KP11): every status and step from frozen
// facts, the permission's three words, and the once-a-day recovery log. The fixtures build the
// real key store, so the native module is replaced.

import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { KEY_RECOVERY_ITEM, RECOVERY_MIN_INTERVAL_MS, RECOVERY_SCOPES_MAX } from '../config';
import { askPermission, permissionOf, readPermission } from '../registration/permission';
import { recoveryAllowed, recoveryLogOver, withRecovery } from '../registration/recovery-log';
import { nextStep, pushStatus, serverRowOf, type PushFacts } from '../registration/state';
import { deviceSchema } from '../schemas/server';
import { DEVICE_ID, DEVICE_ROW } from './data-fixtures';
import { fakePort } from './platform-fixtures';
import { importsOf, sources } from './source-files';
import {
  DENIED,
  GRANTED,
  OTHER_DEVICE_ID,
  T0,
  UNDETERMINED,
  deepFreeze,
  facts,
  memoryStorage,
  storedRecord,
} from './registration-fixtures';

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const A = { serverOrigin: 'https://api.example.test', workspaceId: 'workspace-a' };
const B = { ...A, workspaceId: 'workspace-b' };
const keyless = (deviceId = DEVICE_ID) => ({ deviceId, pushEnabled: null, disabledReason: null });
const rowOff = (disabledReason: string | null) => ({
  deviceId: DEVICE_ID,
  pushEnabled: false,
  disabledReason,
});

describe('pushStatus and nextStep: every status, from frozen facts', () => {
  const cases: [string, Partial<PushFacts>, unknown, string][] = [
    ['no push capability', { capabilityPush: false }, { kind: 'unsupported' }, 'none'],
    ['push.expo false', { pushExpo: false }, { kind: 'operator_off' }, 'none'],
    ['no EAS projectId', { projectId: null }, { kind: 'not_configured' }, 'none'],
    ['never asked', { permission: 'undetermined', record: null }, { kind: 'ask' }, 'none'],
    [
      'denied, nothing registered',
      { permission: 'denied', record: null },
      { kind: 'denied' },
      'none',
    ],
    ['denied after a registration', { permission: 'denied' }, { kind: 'denied' }, 'switch_off'],
    [
      'denied, already told',
      { permission: 'denied', record: storedRecord({ switchedOff: true }) },
      { kind: 'denied' },
      'none',
    ],
    ['granted, registered', {}, { kind: 'on' }, 'register'],
    ['granted, not registered yet', { record: null }, { kind: 'off', reason: 'other' }, 'register'],
    [
      'granted again after a switch-off',
      { record: storedRecord({ switchedOff: true }) },
      { kind: 'off', reason: 'other' },
      'register',
    ],
    ...(['DeviceNotRegistered', 'token_moved', 'device_revoked'] as const).map(
      (reason): [string, Partial<PushFacts>, unknown, string] => [
        `row off: ${reason}`,
        { serverRow: rowOff(reason) },
        { kind: 'off', reason },
        'register',
      ],
    ),
    [
      'row off, no reason',
      { serverRow: rowOff(null) },
      { kind: 'off', reason: 'other' },
      'register',
    ],
    ['admin revoked', { lastConflict: 'device_revoked' }, { kind: 'revoked_by_admin' }, 'none'],
    ['token elsewhere', { lastConflict: 'push_token_in_use' }, { kind: 'token_elsewhere' }, 'none'],
    ['device limit', { lastConflict: 'device_limit_reached' }, { kind: 'device_limit' }, 'none'],
    [
      'install mismatch',
      { lastConflict: 'install_id_mismatch' },
      { kind: 'off', reason: 'other' },
      'none',
    ],
    [
      'install paired',
      { lastConflict: 'install_id_paired' },
      { kind: 'off', reason: 'other' },
      'none',
    ],
    [
      'hosted, no key for its row',
      { record: null, serverRow: keyless() },
      { kind: 'key_missing' },
      'recover_key',
    ],
    [
      'hosted, a key for another row',
      { serverRow: keyless(OTHER_DEVICE_ID) },
      { kind: 'key_missing' },
      'recover_key',
    ],
    [
      'own server, no key for its row',
      { source: 'own', record: null, serverRow: keyless() },
      { kind: 'key_missing' },
      'none',
    ],
  ];

  it.each(cases)('%s', (_name, overrides, status, step) => {
    const input = deepFreeze(facts(overrides));
    const before = JSON.stringify(input);
    expect(pushStatus(input)).toEqual(status);
    expect(nextStep(input)).toBe(step);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('the server gates come first: no permission or record makes them register', () => {
    for (const gate of [{ capabilityPush: false }, { pushExpo: false }, { projectId: null }]) {
      const input = deepFreeze(facts({ ...gate, permission: 'denied', serverRow: keyless() }));
      expect(nextStep(input)).toBe('none');
    }
  });

  it("reads a row of GET /devices as the server's word on this phone", () => {
    const row = deviceSchema.parse({
      ...DEVICE_ROW,
      push_enabled: false,
      push_disabled_reason: 'token_moved',
    });
    expect(serverRowOf(row)).toEqual({
      deviceId: DEVICE_ID,
      pushEnabled: false,
      disabledReason: 'token_moved',
    });
  });
});

describe('the OS permission (KP11)', () => {
  it.each([
    ['granted', GRANTED, 'granted'],
    [
      'iOS provisional',
      { status: 'undetermined', canAskAgain: true, provisional: true },
      'granted',
    ],
    ['denied', DENIED, 'denied'],
    [
      'never askable again',
      { status: 'undetermined', canAskAgain: false, provisional: false },
      'denied',
    ],
    ['not asked yet', UNDETERMINED, 'undetermined'],
  ] as const)('%s → %s', (_name, answer, state) => {
    expect(permissionOf(deepFreeze({ ...answer }))).toBe(state);
  });

  it('reading never asks; a failing read is not a yes', async () => {
    const { port, calls } = fakePort({ getPermissionsAsync: async () => GRANTED });
    expect(await readPermission(port)).toBe('granted');
    expect(calls).toEqual([]);
    const broken = fakePort({ getPermissionsAsync: () => Promise.reject(new Error('native')) });
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    expect(await readPermission(broken.port)).toBe('undetermined');
  });

  it('asking requests alerts, the badge and sounds on iOS', async () => {
    const asked: unknown[] = [];
    const { port } = fakePort({
      requestPermissionsAsync: async (request) => {
        asked.push(request);
        return GRANTED;
      },
    });
    expect(await askPermission(port)).toBe('granted');
    expect(asked).toEqual([{ ios: { allowAlert: true, allowBadge: true, allowSound: true } }]);
  });

  it('a failed request reads the permission instead', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { port } = fakePort({
      requestPermissionsAsync: () => Promise.reject(new Error('native')),
      getPermissionsAsync: async () => DENIED,
    });
    expect(await askPermission(port)).toBe('denied');
  });
});

describe('the key recovery log (KP10: at most once a day)', () => {
  it('allows a recovery never tried, a day after the last, or when the clock was set back', () => {
    expect(recoveryAllowed(null, T0)).toBe(true);
    expect(recoveryAllowed(T0, T0 + RECOVERY_MIN_INTERVAL_MS - 1)).toBe(false);
    expect(recoveryAllowed(T0, T0 + RECOVERY_MIN_INTERVAL_MS)).toBe(true);
    expect(recoveryAllowed(T0, T0 - 1)).toBe(true);
  });

  it('keeps one date per server and workspace in ONE MMKV item; junk reads as never', () => {
    const storage = memoryStorage();
    const log = recoveryLogOver(storage);
    expect(log.lastAt(A)).toBeNull();
    log.note(A, T0);
    log.note(B, T0 + 1);
    expect(log.lastAt(A)).toBe(T0);
    expect(log.lastAt(B)).toBe(T0 + 1);
    expect([...storage.items.keys()]).toEqual([KEY_RECOVERY_ITEM]);
    for (const junk of ['soon', '{"x": -5}', '[1]', '']) {
      storage.items.set(KEY_RECOVERY_ITEM, junk);
      expect(log.lastAt(A)).toBeNull();
    }
  });

  it('holds at most RECOVERY_SCOPES_MAX scopes, the oldest dropped; never changes its input', () => {
    const scopes = Array.from({ length: RECOVERY_SCOPES_MAX + 2 }, (_, n) => ({
      serverOrigin: 'https://api.example.test',
      workspaceId: `workspace-${n}`,
    }));
    const times = scopes.reduce<Record<string, number>>(
      (all, scope, n) => withRecovery(all, scope, T0 + n),
      {},
    );
    expect(Object.keys(times)).toHaveLength(RECOVERY_SCOPES_MAX);
    expect(Object.values(times)).not.toContain(T0);
    const frozen = deepFreeze({ ...times });
    expect(() => withRecovery(frozen, A, T0)).not.toThrow();
  });

  it('a failing store reads as never and a failed note is logged, never thrown', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const log = recoveryLogOver({
      getItem: () => {
        throw new Error('mmkv');
      },
      setItem: () => {
        throw new Error('mmkv');
      },
    });
    expect(log.lastAt(A)).toBeNull();
    expect(() => log.note(A, T0)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('the wave asks for the permission in one place (KP11)', () => {
  it('only registration/permission.ts and platform/expo.ts name the request', () => {
    const naming = sources(path.resolve(__dirname, '..'))
      .filter(({ file }) => !file.includes('__tests__'))
      .filter(({ text }) => text.includes('requestPermissionsAsync'))
      .map(({ file }) => path.relative(path.resolve(__dirname, '..'), file));
    expect(naming.sort()).toEqual(['platform/expo.ts', 'registration/permission.ts']);
  });

  it('the pure registration modules import no react, react-native or expo-*', () => {
    const adapters = ['device-facts.ts', 'key-store.ts'];
    const pure = sources(path.resolve(__dirname, '../registration')).filter(
      ({ file }) => !adapters.includes(path.basename(file)),
    );
    const native = /^(react|react-native|expo)(?:[-/].*)?$|^@expo\//;
    expect(pure.length).toBeGreaterThanOrEqual(6);
    expect(pure.filter(({ text }) => importsOf(text, native).length > 0)).toEqual([]);
  });
});
