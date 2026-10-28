// Hold to talk in the language "I speak" chooses (27 Oct 2026). The policy listens in the chosen
// locale with requiresOnDeviceRecognition true. On iOS the iPhone's own language keeps the module's
// on-device check, exactly as before; another chosen language (Portuguese (Brazil) on an English
// iPhone, Gerard's call) is ready: the module recognises it on the iPhone when its dictation model
// is installed and otherwise on Apple's servers. Android checks the chosen locale itself
// (installed: ready; supported: the download offer; else unavailable), as before. The engine asks
// the policy for the speech's language at each press and after a download, and a change of
// language clears a refusal about the old one.

import { describe, expect, it } from 'vitest';

import { languageNote } from '../language/language-rows';
import { recognitionPolicy, type RecognitionProbe } from '../quick-ask/recognition-policy';
import { voiceView } from '../screen/voice-view-model';
import { DEFAULT_VOICE_SETTING } from '../settings/voice-setting';
import { RECOGNITION_COPY } from '../strings';
import { READY, harness } from './quick-ask-harness';
import { input } from './voice-view-fixtures';

const IOS: RecognitionProbe = {
  platform: 'ios',
  supportsOnDevice: true,
  recognitionAvailable: true,
  locale: 'en-GB',
  phoneLocale: 'en-GB',
};

const ANDROID: RecognitionProbe = {
  platform: 'android',
  androidApiLevel: 34,
  supportsOnDevice: true,
  recognitionAvailable: true,
  locale: 'pt-BR',
  phoneLocale: 'en-GB',
  supportedLocales: ['en-GB', 'pt-BR'],
  installedLocales: ['en-GB', 'pt-BR'],
};

/** The policy's start options, or a failure naming what it was instead. */
function readyOptions(probe: RecognitionProbe) {
  const policy = recognitionPolicy(probe);
  if (policy.kind !== 'ready') throw new Error(`not ready: ${JSON.stringify(policy)}`);
  return policy.options;
}

describe('iOS: the iPhone’s own language, exactly as before', () => {
  it('English on an English iPhone listens with requiresOnDeviceRecognition', () => {
    const options = readyOptions(IOS);
    expect(options.lang).toBe('en-GB');
    expect(options.requiresOnDeviceRecognition).toBe(true);
  });

  it('the same locale in another spelling is the iPhone’s own', () => {
    expect(recognitionPolicy({ ...IOS, locale: 'en_gb' }).kind).toBe('ready');
  });

  it('keeps the module’s on-device check: no on-device recognizer or none at all refuses', () => {
    expect(recognitionPolicy({ ...IOS, supportsOnDevice: false })).toEqual({
      kind: 'unavailable',
      reason: 'no-on-device',
    });
    expect(
      recognitionPolicy({ ...IOS, supportsOnDevice: false, recognitionAvailable: false }),
    ).toEqual({ kind: 'unavailable', reason: 'no-recognizer' });
    expect(recognitionPolicy({ ...IOS, recognitionAvailable: false })).toEqual({
      kind: 'unavailable',
      reason: 'no-recognizer',
    });
  });

  it('a Brazilian iPhone in Brazil’s Portuguese is its own language, the same check', () => {
    const brazil = { ...IOS, locale: 'pt-BR', phoneLocale: 'pt-BR' };
    expect(readyOptions(brazil).lang).toBe('pt-BR');
    expect(recognitionPolicy({ ...brazil, supportsOnDevice: false })).toEqual({
      kind: 'unavailable',
      reason: 'no-on-device',
    });
  });
});

describe('iOS: a chosen language other than the iPhone’s', () => {
  it('Portuguese (Brazil) on an English iPhone is ready, in pt-BR, requiresOnDeviceRecognition true', () => {
    const options = readyOptions({ ...IOS, locale: 'pt-BR' });
    expect(options.lang).toBe('pt-BR');
    expect(options.requiresOnDeviceRecognition).toBe(true);
    expect(Object.isFrozen(options)).toBe(true);
  });

  it('does not lean on the module’s check, which covers the iPhone’s language only', () => {
    // The default language's answers say nothing about pt-BR: the module itself uses pt-BR's
    // on-device model when installed and Apple's servers otherwise, and refuses an unavailable one.
    expect(readyOptions({ ...IOS, locale: 'pt-BR', supportsOnDevice: false }).lang).toBe('pt-BR');
    expect(readyOptions({ ...IOS, locale: 'pt-BR', recognitionAvailable: false }).lang).toBe(
      'pt-BR',
    );
  });

  it('English on a Portuguese iPhone, likewise', () => {
    expect(readyOptions({ ...IOS, locale: 'en-GB', phoneLocale: 'pt-BR' }).lang).toBe('en-GB');
  });

  it('names no service package, recording or audio source', () => {
    const options = readyOptions({ ...IOS, locale: 'pt-BR' }) as Record<string, unknown>;
    for (const key of ['androidRecognitionServicePackage', 'recordingOptions', 'audioSource'])
      expect(options).not.toHaveProperty(key);
  });
});

describe('Android: the chosen language checked on the phone, as before', () => {
  it('listens in the chosen locale when installed on the phone', () => {
    expect(readyOptions(ANDROID).lang).toBe('pt-BR');
  });

  it('offers the chosen locale’s download when supported and not installed', () => {
    expect(recognitionPolicy({ ...ANDROID, installedLocales: ['en-GB'] })).toEqual({
      kind: 'download',
      locale: 'pt-BR',
    });
    expect(
      recognitionPolicy({ ...ANDROID, installedLocales: ['en-GB'], supportedLocales: ['en-GB'] }),
    ).toEqual({ kind: 'unavailable', reason: 'language-missing' });
  });

  it('never starts without the on-device recognizer, whatever the language', () => {
    expect(recognitionPolicy({ ...ANDROID, supportsOnDevice: false })).toEqual({
      kind: 'unavailable',
      reason: 'no-on-device',
    });
  });
});

describe('the engine asks for the language it speaks in', () => {
  it('at each press, the speech’s language', async () => {
    const h = harness({ speech: { language: 'pt-BR' } });
    await h.quickAsk.press();
    expect(h.recognizer.policy).toHaveBeenCalledWith('pt-BR');
  });

  it('after a download, again for that language', async () => {
    const h = harness({
      policy: { kind: 'download', locale: 'pt-BR' },
      speech: { language: 'pt-BR' },
    });
    await h.quickAsk.press();
    h.recognizer.policy.mockResolvedValueOnce(READY);
    await h.quickAsk.download();
    expect(h.recognizer.policy).toHaveBeenLastCalledWith('pt-BR');
  });

  it('refuses the press with nothing started; a change of language clears the refusal', async () => {
    const missing = { kind: 'unavailable', reason: 'language-missing' } as const;
    const h = harness({ policy: missing, speech: { language: 'pt-BR' } });
    await h.quickAsk.press();
    expect(h.recognizer.start).not.toHaveBeenCalled();
    expect(h.voice()).toMatchObject({ phase: 'error', errorKind: 'language-missing' });
    h.quickAsk.languageChanged();
    expect(h.voice()).toMatchObject({ phase: 'idle', errorKind: null });
    expect(h.quickAsk.snapshot().policy).toBeNull();
  });

  it('keeps a refusal that no language changes (a phone too old)', async () => {
    const tooOld = { kind: 'unavailable', reason: 'android-too-old' } as const;
    const h = harness({ policy: tooOld });
    await h.quickAsk.press();
    h.quickAsk.languageChanged();
    expect(h.voice().errorKind).toBe('android-too-old');
    expect(h.quickAsk.snapshot().policy).toEqual(tooOld);
  });
});

describe('what the person sees', () => {
  it('the voice screen in Portuguese (Brazil): ready, nothing refused', () => {
    const view = voiceView(input({ locale: 'pt-BR' }));
    expect(view.chipWords).toBe('READY');
    expect(view.centre.enabled).toBe(true);
  });

  it('a refusal names the language hold to talk listens in', () => {
    const base = input();
    const view = voiceView({
      ...base,
      state: { ...base.state, phase: 'error', errorKind: 'no-on-device' },
      locale: 'pt-BR',
    });
    expect(view.chipWords).toBe('VOICE UNAVAILABLE');
    expect(view.message?.text).toBe(RECOGNITION_COPY.notOnPhone('Portuguese (Brazil)'));
  });

  it('Settings on an iPhone: a note while the choice is not the iPhone’s language', () => {
    const brazil = { ...DEFAULT_VOICE_SETTING, language: 'pt-BR' } as const;
    expect(languageNote('ios', brazil, 'en-GB')).toBe(
      "On iPhone, hold to talk works only in your iPhone's language, English: it's the one language the app can check is recognised on the phone.",
    );
    expect(languageNote('ios', DEFAULT_VOICE_SETTING, 'en-GB')).toBeNull();
    expect(languageNote('ios', { ...DEFAULT_VOICE_SETTING, language: 'en' }, 'en-GB')).toBeNull();
    expect(languageNote('android', brazil, 'en-GB')).toBeNull();
  });
});
