// This phone as a registration describes it (W1 RegisterDeviceRequest, W2 US-009): the EAS
// projectId, the first locale and time zone (never 'UTC' as a guess), the model name or the
// platform's word, each within W1's limits; the Expo token through the port, checked and never
// logged. The native modules are replaced; the pure readers are tested on their own.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { fakePort } from './platform-fixtures';
import { PROJECT_ID, TOKEN } from './registration-fixtures';

const native = vi.hoisted(() => ({
  constants: {
    expoConfig: { version: '1.0.0', extra: { eas: { projectId: '' } } },
    easConfig: null,
  } as Record<string, unknown>,
  device: { modelName: 'iPhone 16 Pro' as string | null },
  locales: [{ languageTag: 'en-IE' }] as unknown[],
  calendars: (): unknown[] => [{ timeZone: 'Europe/Dublin' }],
  os: 'ios',
}));

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));
vi.mock('expo-constants', () => ({ default: native.constants }));
vi.mock('expo-device', () => native.device);
vi.mock('expo-localization', () => ({
  getLocales: () => native.locales,
  getCalendars: () => native.calendars(),
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return native.os;
    },
  },
}));

const facts = await import('../registration/device-facts');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the pure readers', () => {
  it("projectId: app.json's extra.eas.projectId, else EAS's config, else null", () => {
    expect(facts.projectIdOf({ expoConfig: { extra: { eas: { projectId: PROJECT_ID } } } })).toBe(
      PROJECT_ID,
    );
    expect(
      facts.projectIdOf({ expoConfig: null, easConfig: { projectId: ` ${PROJECT_ID} ` } }),
    ).toBe(PROJECT_ID);
    for (const absent of [{}, { expoConfig: { extra: {} } }, { easConfig: { projectId: 7 } }]) {
      expect(facts.projectIdOf(absent)).toBeNull();
    }
    expect(facts.projectIdOf({ expoConfig: { extra: { eas: { projectId: '  ' } } } })).toBeNull();
  });

  it("locale: the first preferred tag, cut to W1's 35 characters", () => {
    expect(facts.localeOf([{ languageTag: 'ga-IE' }, { languageTag: 'en-IE' }])).toBe('ga-IE');
    expect(facts.localeOf([{ languageTag: `en-${'x'.repeat(60)}` }])).toHaveLength(35);
    expect(facts.localeOf([])).toBeNull();
    expect(facts.localeOf([{ languageTag: '' }])).toBeNull();
  });

  it("time zone: the first calendar's, or null — never a guess", () => {
    expect(facts.timeZoneOf([{ timeZone: 'America/Argentina/Buenos_Aires' }])).toBe(
      'America/Argentina/Buenos_Aires',
    );
    for (const none of [
      [],
      [{ timeZone: null }],
      [{ timeZone: '' }],
      [{ timeZone: 'x'.repeat(65) }],
    ]) {
      expect(facts.timeZoneOf(none)).toBeNull();
    }
  });

  it("name: the phone's model, else the platform's word; trimmed, at most 120 characters", () => {
    expect(facts.phoneNameOf(' iPhone 16 Pro ', 'ios')).toBe('iPhone 16 Pro');
    expect(facts.phoneNameOf(null, 'ios')).toBe('iPhone');
    expect(facts.phoneNameOf('', 'android')).toBe('Android phone');
    expect(facts.phoneNameOf('P'.repeat(130), 'android')).toHaveLength(120);
  });

  it("token: W1's ExponentPushToken[…] rule, at most 255 characters", () => {
    expect(facts.expoTokenOf(TOKEN)).toBe(TOKEN);
    for (const bad of [
      '',
      'abc',
      'ExponentPushToken[a b]',
      `ExponentPushToken[${'a'.repeat(240)}]`,
      7,
    ]) {
      expect(facts.expoTokenOf(bad)).toBeNull();
    }
  });
});

describe('readDeviceFacts: the phone, read natively', () => {
  it('reads every fact', () => {
    native.constants.expoConfig = { version: '1.0.0', extra: { eas: { projectId: PROJECT_ID } } };
    expect(facts.readDeviceFacts()).toEqual({
      projectId: PROJECT_ID,
      platform: 'ios',
      appVersion: '1.0.0',
      locale: 'en-IE',
      timeZone: 'Europe/Dublin',
      name: 'iPhone 16 Pro',
    });
  });

  it('an Android phone with no model name; a calendar that throws is no time zone', () => {
    native.os = 'android';
    native.device.modelName = null;
    native.calendars = () => {
      throw new Error('native');
    };
    expect(facts.readDeviceFacts()).toMatchObject({
      platform: 'android',
      name: 'Android phone',
      timeZone: null,
    });
    native.os = 'ios';
    native.device.modelName = 'iPhone 16 Pro';
    native.calendars = () => [{ timeZone: 'Europe/Dublin' }];
  });

  it('a build with no version or projectId leaves them null', () => {
    native.constants.expoConfig = null;
    expect(facts.readDeviceFacts()).toMatchObject({ projectId: null, appVersion: null });
  });
});

describe('the Expo token through the port', () => {
  it("asks for the build's projectId and checks the answer", async () => {
    const asked: unknown[] = [];
    const { port } = fakePort({
      getExpoPushTokenAsync: async (options) => {
        asked.push(options);
        return TOKEN;
      },
    });
    const source = facts.nativeDeviceSource(port);
    expect(await source.expoToken(PROJECT_ID)).toBe(TOKEN);
    expect(asked).toEqual([{ projectId: PROJECT_ID }]);
    expect(source.read).toBe(facts.readDeviceFacts);
  });

  it('a failure or a malformed token is none this time, and the log carries no token', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const failing = fakePort({
      getExpoPushTokenAsync: () => Promise.reject(new Error(`no ${TOKEN}`)),
    });
    expect(await facts.readExpoToken(failing.port, PROJECT_ID)).toBeNull();
    const malformed = fakePort({ getExpoPushTokenAsync: async () => 'ExponentPushToken[]' });
    expect(await facts.readExpoToken(malformed.port, PROJECT_ID)).toBeNull();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('ExponentPushToken');
  });
});
