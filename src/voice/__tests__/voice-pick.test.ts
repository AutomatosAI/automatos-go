import { describe, expect, it } from 'vitest';

import { pickVoice, type SpeechVoice } from '../speech/voice-pick';

/** Android's voices: expo-speech gives the voice's name as its identifier (SpeechModule.kt:93-98). */
const android = (name: string, language: string, quality = 'Default'): SpeechVoice => ({
  identifier: name,
  name,
  quality,
  language,
});

const ios = (identifier: string, language: string, quality = 'Default'): SpeechVoice => ({
  identifier,
  name: identifier.split('.').pop() ?? identifier,
  quality,
  language,
});

describe('pickVoice on Android (Google TTS names)', () => {
  const GOOGLE = [
    android('en-us-x-iol-network', 'en-US', 'Enhanced'),
    android('en-us-x-iol-local', 'en-US'),
    android('en-us-x-tpf-local', 'en-US', 'Enhanced'),
    android('en-US-language', 'en-US'),
    android('en-gb-x-gba-network', 'en-GB', 'Enhanced'),
  ];

  it("takes a 'local' voice, Enhanced first, and never a 'network' one", () => {
    expect(pickVoice(GOOGLE, 'en-US', 'android')).toBe('en-us-x-tpf-local');
    expect(pickVoice(GOOGLE.slice(0, 2), 'en-US', 'android')).toBe('en-us-x-iol-local');
  });

  it("never takes a name that says both 'local' and 'network'", () => {
    const odd = [android('en-us-local-network', 'en-US', 'Enhanced')];
    expect(pickVoice(odd, 'en-US', 'android')).toBeUndefined();
  });

  it("returns undefined when only network voices speak the language (the engine's default)", () => {
    expect(pickVoice(GOOGLE, 'en-GB', 'android')).toBe('en-us-x-tpf-local');
    const networkOnly = [android('en-gb-x-gba-network', 'en-GB', 'Enhanced')];
    expect(pickVoice(networkOnly, 'en-GB', 'android')).toBeUndefined();
  });

  it('prefers the exact locale to a better voice in another region', () => {
    const voices = [
      android('en-us-x-tpf-local', 'en-US', 'Enhanced'),
      android('en-gb-x-gbb-local', 'en-GB'),
    ];
    expect(pickVoice(voices, 'en_GB', 'android')).toBe('en-gb-x-gbb-local');
  });

  it("falls back to the language when the locale's region has no voice", () => {
    const voices = [
      android('fr-fr-x-frd-local', 'fr-FR'),
      android('en-gb-x-gbb-local', 'en-GB'),
      android('en-us-x-tpf-local', 'en-US', 'Enhanced'),
    ];
    expect(pickVoice(voices, 'en-IE', 'android')).toBe('en-us-x-tpf-local');
  });

  it("reads Android's old language codes", () => {
    const voices = [android('iw-il-x-heb-local', 'iw-IL'), android('in-id-x-idd-local', 'in-ID')];
    expect(pickVoice(voices, 'he-IL', 'android')).toBe('iw-il-x-heb-local');
    expect(pickVoice(voices, 'id-ID', 'android')).toBe('in-id-x-idd-local');
  });
});

describe('pickVoice on iOS', () => {
  const DANIEL = ios('com.apple.voice.compact.en-GB.Daniel', 'en-GB');
  const DANIEL_ENHANCED = ios('com.apple.voice.enhanced.en-GB.Daniel', 'en-GB', 'Enhanced');
  const MALCOLM_PREMIUM = ios('com.apple.voice.premium.en-GB.Malcolm', 'en-GB');
  const SAMANTHA_ENHANCED = ios('com.apple.voice.enhanced.en-US.Samantha', 'en-US', 'Enhanced');
  const NOVELTY = [
    ios('com.apple.speech.synthesis.voice.Albert', 'en-US'),
    ios('com.apple.eloquence.en-US.Eddy', 'en-US'),
  ];

  it('takes an Enhanced voice before a Default one, and Premium before both', () => {
    expect(pickVoice([DANIEL, DANIEL_ENHANCED], 'en-GB', 'ios')).toBe(DANIEL_ENHANCED.identifier);
    expect(pickVoice([DANIEL, DANIEL_ENHANCED, MALCOLM_PREMIUM], 'en-GB', 'ios')).toBe(
      MALCOLM_PREMIUM.identifier,
    );
    expect(pickVoice([DANIEL], 'en-GB', 'ios')).toBe(DANIEL.identifier);
  });

  it('keeps the exact locale before a better voice for the language', () => {
    expect(pickVoice([SAMANTHA_ENHANCED, DANIEL], 'en-GB', 'ios')).toBe(DANIEL.identifier);
    expect(pickVoice([SAMANTHA_ENHANCED, DANIEL], 'en-AU', 'ios')).toBe(
      SAMANTHA_ENHANCED.identifier,
    );
  });

  it("takes Apple's own voices only, never a novelty or Eloquence voice", () => {
    expect(pickVoice(NOVELTY, 'en-US', 'ios')).toBeUndefined();
    const siri = ios('com.apple.ttsbundle.siri_Nicky_en-US_compact', 'en-US');
    expect(pickVoice([...NOVELTY, siri], 'en-US', 'ios')).toBe(siri.identifier);
  });

  it('ignores a script subtag', () => {
    const voices = [
      ios('com.apple.voice.compact.zh-HK.Sinji', 'zh-HK'),
      ios('com.apple.voice.compact.zh-CN.Tingting', 'zh-CN'),
    ];
    expect(pickVoice(voices, 'zh-Hans-CN', 'ios')).toBe('com.apple.voice.compact.zh-CN.Tingting');
    expect(pickVoice(voices, 'zh-Hant-HK', 'ios')).toBe('com.apple.voice.compact.zh-HK.Sinji');
  });
});

describe('pickVoice with nothing to pick', () => {
  it("returns undefined: the engine's default for the language", () => {
    expect(pickVoice([], 'en-GB', 'ios')).toBeUndefined();
    expect(pickVoice([], 'en-GB', 'android')).toBeUndefined();
    const french = [
      ios('com.apple.voice.compact.fr-FR.Thomas', 'fr-FR'),
      android('fr-fr-x-frd-local', 'fr-FR'),
    ];
    expect(pickVoice(french, 'de-DE', 'ios')).toBeUndefined();
    expect(pickVoice(french, 'de-DE', 'android')).toBeUndefined();
  });
});
