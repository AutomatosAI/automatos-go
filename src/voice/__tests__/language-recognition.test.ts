// Hold to talk in the language "I speak" chooses (27 Oct 2026). The policy listens in the chosen
// locale, on the phone or not at all (KV4): on iOS only the iPhone's own locale may start, since the
// module's on-device check covers that one only and start() would use Apple's servers for a
// language without an on-device recognizer; Android checks the chosen locale itself (installed:
// ready; supported: the download offer; else unavailable). The engine asks the policy for the
// speech's language at each press and after a download, and a change of language clears a refusal
// about the old one. The voice screen and Settings say why, naming both languages.

import { describe, expect, it } from 'vitest';

import { languageNote } from '../language/language-rows';
import {
  recognitionPolicy,
  refusalCopyKey,
  type RecognitionProbe,
} from '../quick-ask/recognition-policy';
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
  locale: 'pt-PT',
  phoneLocale: 'en-GB',
  supportedLocales: ['en-GB', 'pt-BR', 'pt-PT'],
  installedLocales: ['en-GB', 'pt-PT'],
};

const OTHER_LANGUAGE = { kind: 'unavailable', reason: 'other-language' } as const;

describe('the recognition language per choice', () => {
  it('iOS: the iPhone’s own locale listens on the phone, as before', () => {
    const policy = recognitionPolicy(IOS);
    expect(policy.kind).toBe('ready');
    if (policy.kind === 'ready') {
      expect(policy.options.lang).toBe('en-GB');
      expect(policy.options.requiresOnDeviceRecognition).toBe(true);
    }
  });

  it('iOS: Portuguese on an English iPhone never starts (the module cannot check it)', () => {
    expect(recognitionPolicy({ ...IOS, locale: 'pt-PT' })).toEqual(OTHER_LANGUAGE);
    expect(recognitionPolicy({ ...IOS, locale: 'pt-BR' })).toEqual(OTHER_LANGUAGE);
    expect(recognitionPolicy({ ...IOS, phoneLocale: 'pt-PT', locale: 'en-GB' })).toEqual(
      OTHER_LANGUAGE,
    );
  });

  it('iOS: the same locale in another spelling is the iPhone’s own', () => {
    expect(recognitionPolicy({ ...IOS, locale: 'en_gb' }).kind).toBe('ready');
  });

  it('iOS: Portuguese (Portugal) on a Portuguese iPhone is the existing check (on-device or not)', () => {
    const phone = { ...IOS, locale: 'pt-PT', phoneLocale: 'pt-PT' };
    expect(recognitionPolicy(phone).kind).toBe('ready');
    expect(recognitionPolicy({ ...phone, supportsOnDevice: false })).toEqual({
      kind: 'unavailable',
      reason: 'no-on-device',
    });
  });

  it('Android: listens in the chosen locale when installed on the phone', () => {
    const policy = recognitionPolicy(ANDROID);
    expect(policy.kind).toBe('ready');
    if (policy.kind === 'ready') expect(policy.options.lang).toBe('pt-PT');
  });

  it('Android: offers the chosen locale’s download when supported and not installed', () => {
    expect(recognitionPolicy({ ...ANDROID, locale: 'pt-BR' })).toEqual({
      kind: 'download',
      locale: 'pt-BR',
    });
    expect(recognitionPolicy({ ...ANDROID, locale: 'pt-BR', supportedLocales: [] })).toEqual({
      kind: 'unavailable',
      reason: 'language-missing',
    });
  });

  it('the iOS refusal has its own words, naming both languages', () => {
    expect(refusalCopyKey(OTHER_LANGUAGE)).toBe('otherLanguage');
    expect(RECOGNITION_COPY.otherLanguage('Portuguese (Portugal)', 'English')).toBe(
      "Hold to talk can't listen in Portuguese (Portugal) on this iPhone. It works only in your iPhone's language, English, so your voice is recognised on the phone. You can type to Auto instead.",
    );
  });
});

describe('the engine asks for the language it speaks in', () => {
  it('at each press, the speech’s language', async () => {
    const h = harness({ speech: { language: 'pt-PT' } });
    await h.quickAsk.press();
    expect(h.recognizer.policy).toHaveBeenCalledWith('pt-PT');
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
    const h = harness({ policy: OTHER_LANGUAGE, speech: { language: 'pt-PT' } });
    await h.quickAsk.press();
    expect(h.recognizer.start).not.toHaveBeenCalled();
    expect(h.voice()).toMatchObject({ phase: 'error', errorKind: 'other-language' });
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
  it('the voice screen: VOICE UNAVAILABLE and the line naming both languages', () => {
    const base = input();
    const view = voiceView({
      ...base,
      state: { ...base.state, phase: 'error', errorKind: 'other-language' },
      locale: 'pt-BR',
      phoneLocale: 'en-GB',
    });
    expect(view.chipWords).toBe('VOICE UNAVAILABLE');
    expect(view.message?.text).toBe(
      RECOGNITION_COPY.otherLanguage('Portuguese (Brazil)', 'English'),
    );
    expect(view.centre.enabled).toBe(true);
  });

  it('Settings on an iPhone: a note while the choice is not the iPhone’s language', () => {
    const portugal = { ...DEFAULT_VOICE_SETTING, language: 'pt-BR' } as const;
    expect(languageNote('ios', portugal, 'en-GB')).toBe(
      "On iPhone, hold to talk works only in your iPhone's language, English: it's the one language the app can check is recognised on the phone.",
    );
    expect(languageNote('ios', DEFAULT_VOICE_SETTING, 'en-GB')).toBeNull();
    expect(languageNote('ios', { ...DEFAULT_VOICE_SETTING, language: 'en' }, 'en-GB')).toBeNull();
    expect(languageNote('android', portugal, 'en-GB')).toBeNull();
  });
});
