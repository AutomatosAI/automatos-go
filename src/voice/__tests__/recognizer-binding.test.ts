import { beforeEach, describe, expect, it, vi } from 'vitest';

// The native modules, replaced: recognizer.ts binds ExpoSpeechRecognitionModule, Platform and the
// phone's locale (locale.ts, expo-localization).
const native = vi.hoisted(() => ({
  platform: { OS: 'ios' as string, Version: '17.4' as string | number },
  locales: [{ languageTag: 'en-GB' }] as { languageTag?: string }[],
  module: {
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    addListener: vi.fn(() => ({ remove: vi.fn() })),
    supportsOnDeviceRecognition: vi.fn(() => true),
    isRecognitionAvailable: vi.fn(() => true),
    getSupportedLocales: vi.fn(async () => ({ locales: ['en-GB'], installedLocales: ['en-GB'] })),
    androidTriggerOfflineModelDownload: vi.fn(async () => ({
      status: 'opened_dialog',
      message: '',
    })),
  },
}));
vi.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: native.module }));
vi.mock('react-native', () => ({ Platform: native.platform }));
vi.mock('expo-localization', () => ({ getLocales: () => native.locales }));

const { recognizer } = await import('../quick-ask/recognizer');
const { phoneLocale } = await import('../quick-ask/locale');

beforeEach(() => {
  vi.clearAllMocks();
  native.platform.OS = 'ios';
  native.platform.Version = '17.4';
  native.locales = [{ languageTag: 'en-GB' }];
});

describe('phoneLocale', () => {
  it("reads the phone's first locale", () => {
    native.locales = [{ languageTag: 'fr-FR' }, { languageTag: 'en-GB' }];
    expect(phoneLocale()).toBe('fr-FR');
  });

  it('falls back to en-US when the phone reports none', () => {
    for (const locales of [[], [{ languageTag: '  ' }], [{}]]) {
      native.locales = locales;
      expect(phoneLocale()).toBe('en-US');
    }
  });
});

describe('recognizer (the binding)', () => {
  it("starts the module on the phone, in the phone's language, with the module's own option shapes", async () => {
    const policy = await recognizer.policy();
    expect(recognizer.start(policy)).toEqual({ kind: 'started' });
    expect(native.module.start).toHaveBeenCalledTimes(1);
    const options = native.module.start.mock.calls[0]?.[0] as Record<string, unknown> & {
      iosCategory: { categoryOptions: string[] };
    };
    expect(options.requiresOnDeviceRecognition).toBe(true);
    expect(options.lang).toBe('en-GB');
    expect(options).not.toHaveProperty('androidRecognitionServicePackage');
    expect(options).not.toHaveProperty('recordingOptions');
    expect(options).not.toHaveProperty('audioSource');
    // A plain array the module may hold, not the policy's frozen one.
    expect(Object.isFrozen(options.iosCategory.categoryOptions)).toBe(false);
    expect(options.iosCategory.categoryOptions).toEqual(['defaultToSpeaker', 'allowBluetooth']);
  });

  it('never starts on an iPhone without on-device recognition', async () => {
    native.module.supportsOnDeviceRecognition.mockReturnValueOnce(false);
    const policy = await recognizer.policy();
    expect(recognizer.start(policy).kind).toBe('refused');
    expect(native.module.start).not.toHaveBeenCalled();
    expect(native.module.getSupportedLocales).not.toHaveBeenCalled();
  });

  it("reads Android's API level and the on-device languages with no service package", async () => {
    native.platform.OS = 'android';
    native.platform.Version = 34;
    const probe = await recognizer.probe();
    expect(probe).toMatchObject({ platform: 'android', androidApiLevel: 34, locale: 'en-GB' });
    expect(native.module.getSupportedLocales).toHaveBeenCalledWith({});
  });

  it('refuses Android 12 without asking for the languages', async () => {
    native.platform.OS = 'android';
    native.platform.Version = 32;
    expect(await recognizer.policy()).toEqual({ kind: 'unavailable', reason: 'android-too-old' });
  });

  it('passes stop, abort, the download and the listeners to the module', async () => {
    recognizer.stop();
    recognizer.abort();
    expect(await recognizer.downloadModel('fr-FR')).toBe('opened');
    const unlisten = recognizer.listen(() => undefined);
    unlisten();
    expect(native.module.stop).toHaveBeenCalledTimes(1);
    expect(native.module.abort).toHaveBeenCalledTimes(1);
    expect(native.module.androidTriggerOfflineModelDownload).toHaveBeenCalledWith({
      locale: 'fr-FR',
    });
    expect(native.module.addListener).toHaveBeenCalledTimes(8);
  });
});
