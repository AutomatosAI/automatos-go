import { describe, expect, it } from 'vitest';

import { VOLUME_INTERVAL_MS } from '../config';
import {
  languageName,
  languageOf,
  matchLocale,
  onDeviceOptions,
  recognitionPolicy,
  refusalCopyKey,
  type RecognitionPolicy,
  type RecognitionProbe,
} from '../quick-ask/recognition-policy';
import { DOWNLOAD_ACTION, RECOGNITION_COPY } from '../strings';

const IOS: RecognitionProbe = {
  platform: 'ios',
  supportsOnDevice: true,
  recognitionAvailable: true,
  locale: 'en-GB',
};

const ANDROID: RecognitionProbe = {
  platform: 'android',
  androidApiLevel: 34,
  supportsOnDevice: true,
  recognitionAvailable: true,
  locale: 'en-GB',
  supportedLocales: ['de-DE', 'en-GB', 'en-US', 'fr-FR'],
  installedLocales: ['en-GB'],
};

const FORBIDDEN_KEYS = ['androidRecognitionServicePackage', 'recordingOptions', 'audioSource'];

function expectOnDevice(policy: RecognitionPolicy, lang: string): void {
  expect(policy.kind).toBe('ready');
  if (policy.kind !== 'ready') return;
  expect(policy.options.requiresOnDeviceRecognition).toBe(true);
  expect(policy.options.lang).toBe(lang);
  for (const key of FORBIDDEN_KEYS) expect(policy.options).not.toHaveProperty(key);
}

describe('recognitionPolicy — iOS', () => {
  it('is ready only when the recognizer works on the phone', () => {
    expectOnDevice(recognitionPolicy(IOS), 'en-GB');
  });

  it('is unavailable when on-device recognition is not supported, never a server fallback', () => {
    expect(recognitionPolicy({ ...IOS, supportsOnDevice: false })).toEqual({
      kind: 'unavailable',
      reason: 'no-on-device',
    });
  });

  it('names no recognizer when there is none for the language', () => {
    for (const supportsOnDevice of [true, false]) {
      expect(recognitionPolicy({ ...IOS, supportsOnDevice, recognitionAvailable: false })).toEqual({
        kind: 'unavailable',
        reason: 'no-recognizer',
      });
    }
  });

  it('ignores the locale lists and the API level (iOS lists every supported locale as installed)', () => {
    const policy = recognitionPolicy({
      ...IOS,
      androidApiLevel: 1,
      supportedLocales: [],
      installedLocales: [],
    });
    expectOnDevice(policy, 'en-GB');
  });
});

describe('recognitionPolicy — Android', () => {
  it.each([31, 32])(
    'is unavailable on API %i (Android 12): the default service may use Google',
    (level) => {
      expect(recognitionPolicy({ ...ANDROID, androidApiLevel: level })).toEqual({
        kind: 'unavailable',
        reason: 'android-too-old',
      });
    },
  );

  it('is unavailable without an API level', () => {
    const { androidApiLevel: _omitted, ...probe } = ANDROID;
    expect(recognitionPolicy(probe)).toEqual({ kind: 'unavailable', reason: 'android-too-old' });
  });

  it.each([33, 34])('is ready on API %i with the language installed on the phone', (level) => {
    expectOnDevice(recognitionPolicy({ ...ANDROID, androidApiLevel: level }), 'en-GB');
  });

  it('is unavailable without the on-device recognizer, whatever else the phone has', () => {
    expect(recognitionPolicy({ ...ANDROID, supportsOnDevice: false })).toEqual({
      kind: 'unavailable',
      reason: 'no-on-device',
    });
    expect(
      recognitionPolicy({ ...ANDROID, supportsOnDevice: false, recognitionAvailable: false }),
    ).toEqual({ kind: 'unavailable', reason: 'no-recognizer' });
  });

  it('trusts the on-device recognizer even when no default service is visible', () => {
    expectOnDevice(recognitionPolicy({ ...ANDROID, recognitionAvailable: false }), 'en-GB');
  });

  it("matches the locale's language: 'en' installed serves 'en-GB'", () => {
    expectOnDevice(recognitionPolicy({ ...ANDROID, installedLocales: ['en'] }), 'en-GB');
  });

  it('matches regardless of case and underscores', () => {
    expectOnDevice(recognitionPolicy({ ...ANDROID, installedLocales: ['EN_gb'] }), 'en-GB');
  });

  it('offers the download when the language is supported but not installed', () => {
    expect(recognitionPolicy({ ...ANDROID, locale: 'fr-FR' })).toEqual({
      kind: 'download',
      locale: 'fr-FR',
    });
    expect(recognitionPolicy({ ...ANDROID, locale: 'de-AT', supportedLocales: ['de'] })).toEqual({
      kind: 'download',
      locale: 'de',
    });
  });

  it('is unavailable when the language is missing from the on-device recognizer', () => {
    for (const probe of [
      { ...ANDROID, locale: 'ga-IE' },
      { ...ANDROID, locale: 'en-IE', installedLocales: ['en-US'], supportedLocales: ['en-US'] },
      { ...ANDROID, supportedLocales: undefined, installedLocales: undefined },
    ]) {
      expect(recognitionPolicy(probe)).toEqual({
        kind: 'unavailable',
        reason: 'language-missing',
      });
    }
  });
});

describe('the ready options', () => {
  it('listen on the phone with partial results, punctuation, one alternative and the level', () => {
    expect(onDeviceOptions('en-GB')).toEqual({
      lang: 'en-GB',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: true,
      addsPunctuation: true,
      maxAlternatives: 1,
      volumeChangeEventOptions: { enabled: true, intervalMillis: VOLUME_INTERVAL_MS },
      iosCategory: {
        category: 'playAndRecord',
        categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
      },
    });
    expect(VOLUME_INTERVAL_MS).toBe(100);
  });

  it('are frozen all the way down', () => {
    const options = onDeviceOptions('en-US');
    expect(Object.isFrozen(options)).toBe(true);
    expect(Object.isFrozen(options.iosCategory)).toBe(true);
    expect(Object.isFrozen(options.iosCategory.categoryOptions)).toBe(true);
    expect(Object.isFrozen(options.volumeChangeEventOptions)).toBe(true);
    const policy = recognitionPolicy(IOS);
    expect(Object.isFrozen(policy)).toBe(true);
  });

  it('always carry requiresOnDeviceRecognition true and never a service, recording or source', () => {
    const ready = [
      recognitionPolicy(IOS),
      recognitionPolicy(ANDROID),
      recognitionPolicy({ ...ANDROID, androidApiLevel: 33, installedLocales: ['en'] }),
    ];
    for (const policy of ready) expectOnDevice(policy, 'en-GB');
  });
});

describe('locales and copy', () => {
  it('reads the language subtag', () => {
    expect(languageOf('en-GB')).toBe('en');
    expect(languageOf('pt_BR')).toBe('pt');
    expect(languageOf('FR')).toBe('fr');
  });

  it('prefers the exact locale to its language and returns the entry as listed', () => {
    expect(matchLocale('en-GB', ['en', 'en-GB'])).toBe('en-GB');
    expect(matchLocale('en-GB', ['en', 'fr-FR'])).toBe('en');
    expect(matchLocale('en-GB', ['en-US'])).toBeNull();
    expect(matchLocale('en-GB', [])).toBeNull();
  });

  it("names the phone's language, else shows the locale tag", () => {
    expect(languageName('en-GB')).toBe('English');
    expect(languageName('fr_CA')).toBe('French');
    expect(languageName('xx-YY')).toBe('xx-YY');
    expect(languageName('constructor')).toBe('constructor');
  });

  it('maps each refusal to its words', () => {
    expect(refusalCopyKey({ kind: 'unavailable', reason: 'android-too-old' })).toBe(
      'androidTooOld',
    );
    for (const reason of ['no-on-device', 'language-missing', 'no-recognizer'] as const) {
      expect(refusalCopyKey({ kind: 'unavailable', reason })).toBe('notOnPhone');
    }
    expect(refusalCopyKey({ kind: 'download', locale: 'fr-FR' })).toBe('download');
  });

  it("says the kit's words, with the language filled in", () => {
    expect(RECOGNITION_COPY.androidTooOld('English')).toBe(
      'Hold to talk needs Android 13 or later, so your voice is recognised on this phone. You can type to Auto instead.',
    );
    expect(RECOGNITION_COPY.notOnPhone('English')).toBe(
      "Hold to talk needs speech recognition that runs on this phone, and it isn't available for English. You can type to Auto instead.",
    );
    expect(RECOGNITION_COPY.download('French')).toBe(
      'Download the French speech model to talk to Auto. It stays on your phone.',
    );
    expect(DOWNLOAD_ACTION).toBe('Download');
  });
});
