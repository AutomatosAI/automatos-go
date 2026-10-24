// Settings → Notifications' wiring, pure: the caches after a write hold what the server now has
// (the cached value untouched); the phone link PushRoot attaches and the screen reads (a later
// attach wins, a stale detach changes nothing; 'Turn on notifications' asks, then registers once);
// and, read from the source, the wave's own path, the route file, the feature-local switch and the
// one permission ask. (The settings logic modules' purity is prefs.test.ts's.)

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { pushScreens } from '../nav';
import type { RegistrationOutcome } from '../registration/register';
import type { PushStatus } from '../registration/state';
import { deviceSchema, preferencesSchema, type Device } from '../schemas/server';
import { devicesWith, preferencesAfter } from '../settings/cache';
import { createPhoneLinkStore, runPhoneAction, type PhoneLink } from '../settings/phone-link';
import { DEVICE_ID, DEVICE_ROW, PREFERENCES } from './data-fixtures';
import { deepFreeze } from './inbound-fixtures';
import { OTHER_DEVICE_ID, facts } from './registration-fixtures';
import { sources } from './source-files';

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const device = (overrides: Partial<Device> = {}): Device =>
  deepFreeze({ ...deviceSchema.parse(DEVICE_ROW), ...overrides });
const PREFS = deepFreeze(preferencesSchema.parse(PREFERENCES));

const ON: PushStatus = { kind: 'on' };
const OUTCOME: RegistrationOutcome = deepFreeze({ step: 'none', status: ON, facts: facts() });

describe('the caches after a write: what the server now holds, the cached value untouched', () => {
  it("a preference PUT replaces exactly its events' rows", () => {
    const after = preferencesAfter(PREFS, ['daily_digest'], true);
    expect(after.preferences.filter((row) => row.event_type === 'daily_digest')).toEqual([
      {
        event_type: 'daily_digest',
        destination: 'push',
        enabled: true,
        channel_connection_id: null,
      },
    ]);
    expect(after.preferences.filter((row) => row.event_type === 'question_pending')).toEqual(
      PREFS.preferences.filter((row) => row.event_type === 'question_pending'),
    );
    expect(after.push_types).toEqual(PREFS.push_types);
    expect(PREFS.preferences[2]?.enabled).toBe(false);
  });

  it('a digest time PATCH puts its row in place', () => {
    const list = deepFreeze({ devices: [device({ id: OTHER_DEVICE_ID }), device()] });
    const after = devicesWith(list, device({ digest_time: '07:00' }));
    expect(after.devices.map((row) => [row.id, row.digest_time])).toEqual([
      [OTHER_DEVICE_ID, '08:00'],
      [DEVICE_ID, '07:00'],
    ]);
  });
});

describe('the phone link: PushRoot attaches the registrar, the screen reads it', () => {
  function fakeLink(
    ask: () => Promise<'granted' | 'denied' | 'undetermined'> = async () => 'granted',
  ) {
    const calls: string[] = [];
    const link: PhoneLink = {
      registrar: {
        run: async (options) => {
          calls.push(`run:${options?.force === true}`);
          return OUTCOME;
        },
        latest: () => null,
      },
      askPermission: async () => {
        calls.push('ask');
        return ask();
      },
      removal: {
        deviceId: async () => null,
        remove: async () => ({ removed: true, status: { kind: 'ask' } }),
      },
      leave: async () => ({ revoked: false, failed: [] }),
    };
    return { link, calls };
  }

  it('attach tells the screen; a later attach wins; a stale detach changes nothing', () => {
    const store = createPhoneLinkStore();
    const heard = vi.fn();
    store.subscribe(heard);
    const first = fakeLink().link;
    const second = fakeLink().link;
    const detachFirst = store.attach(first);
    const detachSecond = store.attach(second);
    detachFirst();
    expect(store.current()).toBe(second);
    detachSecond();
    expect(store.current()).toBeNull();
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it("'Turn on notifications' asks the OS, then registers once, forced", async () => {
    const { link, calls } = fakeLink();
    expect((await runPhoneAction(link, 'turn_on'))?.status).toEqual(ON);
    expect(calls).toEqual(['ask', 'run:true']);
  });

  it("'Turn on again' and 'Try again' register once more without asking", async () => {
    for (const action of ['turn_on_again', 'try_again'] as const) {
      const { link, calls } = fakeLink();
      await runPhoneAction(link, action);
      expect(calls).toEqual(['run:true']);
    }
  });

  it('a failed ask still registers (the permission is read as it is), logged by kind', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { link, calls } = fakeLink(async () => {
      throw new Error('prompt failed');
    });
    await expect(runPhoneAction(link, 'turn_on')).resolves.not.toBeNull();
    expect(calls).toEqual(['ask', 'run:true']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('the source', () => {
  const root = path.resolve(__dirname, '..');

  it("the screen's path is the wave's own constant; the route file mounts the screen", () => {
    expect(pushScreens.notifications).toBe('/settings/notifications');
    const route = readFileSync(
      path.resolve(root, '../../app/(app)/settings/notifications.tsx'),
      'utf8',
    );
    expect(route).toContain('NotificationsScreen');
  });

  it('a settings switch says it is a switch (the feature-local Switch, no src/ui primitive)', () => {
    const switches = sources(path.join(root, 'settings/components')).filter((file) =>
      file.text.includes('NativeSwitch'),
    );
    expect(switches).toHaveLength(1);
    expect(switches[0]?.text).toContain('accessibilityRole="switch"');
  });

  it('only registration/permission.ts asks the OS (KP11): the screen goes through the link', () => {
    const screen = sources(path.join(root, 'settings'));
    expect(screen.some((file) => file.text.includes('requestPermissionsAsync'))).toBe(false);
  });
});
