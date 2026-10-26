// What Settings → Voice offers (voiceChoices) and what quick-ask speaks with (resolveVoice), by
// voice-pick.ts's own rules: Automatic first; then the voices for the exact locale, else for its
// language; Apple's own voices on iOS and local ones on Android; the best tier first, then by name.

import { describe, expect, it } from 'vitest';

import { AUTOMATIC_VOICE, resolveVoice, voiceChoices } from '../speech/voice-choices';
import { pickVoice, type SpeechVoice } from '../speech/voice-pick';

const ios = (identifier: string, language: string, quality = 'Default'): SpeechVoice => ({
  identifier,
  name: identifier.split('.').pop() ?? identifier,
  quality,
  language,
});

/** Android's voices: expo-speech gives the voice's name as its identifier. */
const android = (name: string, language: string, quality = 'Default'): SpeechVoice => ({
  identifier: name,
  name,
  quality,
  language,
});

const DANIEL = ios('com.apple.voice.compact.en-GB.Daniel', 'en-GB');
const ARTHUR = ios('com.apple.voice.compact.en-GB.Arthur', 'en-GB');
const DANIEL_ENHANCED = ios('com.apple.voice.enhanced.en-GB.Daniel', 'en-GB', 'Enhanced');
const MALCOLM_PREMIUM = ios('com.apple.voice.premium.en-GB.Malcolm', 'en-GB');
const SAMANTHA = ios('com.apple.voice.enhanced.en-US.Samantha', 'en-US', 'Enhanced');
const THOMAS = ios('com.apple.voice.compact.fr-FR.Thomas', 'fr-FR');
const NOVELTY = ios('com.apple.speech.synthesis.voice.Albert', 'en-GB');
const ELOQUENCE = ios('com.apple.eloquence.en-GB.Eddy', 'en-GB');

const IOS_PHONE = [DANIEL, SAMANTHA, MALCOLM_PREMIUM, ARTHUR, NOVELTY, DANIEL_ENHANCED, THOMAS];

const identifiers = (choices: ReturnType<typeof voiceChoices>) =>
  choices.map((choice) => (choice.kind === 'voice' ? choice.identifier : 'automatic'));

describe('voiceChoices on iOS', () => {
  it('lists Automatic first, then the best tier first, then by name', () => {
    expect(identifiers(voiceChoices(IOS_PHONE, 'en-GB', 'ios'))).toEqual([
      'automatic',
      MALCOLM_PREMIUM.identifier,
      DANIEL_ENHANCED.identifier,
      ARTHUR.identifier,
      DANIEL.identifier,
    ]);
  });

  it('labels each voice Premium (by its identifier), Enhanced (by its quality) or Standard', () => {
    const choices = voiceChoices(IOS_PHONE, 'en-GB', 'ios');
    expect(choices.slice(1)).toEqual([
      { kind: 'voice', identifier: MALCOLM_PREMIUM.identifier, name: 'Malcolm', tier: 'premium' },
      { kind: 'voice', identifier: DANIEL_ENHANCED.identifier, name: 'Daniel', tier: 'enhanced' },
      { kind: 'voice', identifier: ARTHUR.identifier, name: 'Arthur', tier: 'standard' },
      { kind: 'voice', identifier: DANIEL.identifier, name: 'Daniel', tier: 'standard' },
    ]);
  });

  it("offers Apple's own voices only, never a novelty or Eloquence voice", () => {
    const listed = identifiers(voiceChoices([NOVELTY, ELOQUENCE, DANIEL], 'en-GB', 'ios'));
    expect(listed).toEqual(['automatic', DANIEL.identifier]);
  });

  it("falls back to the language's voices when the locale's region has none", () => {
    expect(identifiers(voiceChoices(IOS_PHONE, 'en-IE', 'ios'))).toEqual([
      'automatic',
      MALCOLM_PREMIUM.identifier,
      DANIEL_ENHANCED.identifier,
      SAMANTHA.identifier,
      ARTHUR.identifier,
      DANIEL.identifier,
    ]);
  });

  it("offers the exact locale's voices only when it has any, and never another language's", () => {
    expect(identifiers(voiceChoices(IOS_PHONE, 'en-US', 'ios'))).toEqual([
      'automatic',
      SAMANTHA.identifier,
    ]);
    expect(identifiers(voiceChoices(IOS_PHONE, 'de-DE', 'ios'))).toEqual(['automatic']);
  });

  it('agrees with pickVoice: Automatic speaks with a voice of the top tier listed', () => {
    const choices = voiceChoices(IOS_PHONE, 'en-GB', 'ios');
    expect(pickVoice(IOS_PHONE, 'en-GB', 'ios')).toBe(MALCOLM_PREMIUM.identifier);
    expect(choices[1]).toMatchObject({ identifier: MALCOLM_PREMIUM.identifier });
  });
});

describe('voiceChoices on Android', () => {
  const GOOGLE = [
    android('en-us-x-iol-network', 'en-US', 'Enhanced'),
    android('en-us-x-tpf-local', 'en-US', 'Enhanced'),
    android('en-us-x-iol-local', 'en-US'),
    android('en-us-x-sfg-local', 'en-US', 'Enhanced'),
    android('en-us-local-network', 'en-US', 'Enhanced'),
    android('en-US-language', 'en-US'),
  ];

  it("offers local voices only: never a 'network' one, nor one without 'local'", () => {
    expect(identifiers(voiceChoices(GOOGLE, 'en-US', 'android'))).toEqual([
      'automatic',
      'en-us-x-sfg-local',
      'en-us-x-tpf-local',
      'en-us-x-iol-local',
    ]);
  });

  it('labels Enhanced or Standard, never Premium (an Apple tier)', () => {
    const premiumNamed = android('en-us-x-a.premium.b-local', 'en-US');
    const tiers = voiceChoices([...GOOGLE, premiumNamed], 'en-US', 'android').flatMap((choice) =>
      choice.kind === 'voice' ? [choice.tier] : [],
    );
    expect(tiers).toEqual(['enhanced', 'enhanced', 'standard', 'standard']);
  });
});

describe('voiceChoices with nothing on the phone', () => {
  it('is Automatic alone', () => {
    expect(voiceChoices([], 'en-GB', 'ios')).toEqual([AUTOMATIC_VOICE]);
    expect(voiceChoices([], 'en-GB', 'android')).toEqual([AUTOMATIC_VOICE]);
  });

  it('hands back frozen choices', () => {
    const choices = voiceChoices(IOS_PHONE, 'en-GB', 'ios');
    expect(Object.isFrozen(choices)).toBe(true);
    expect(choices.every((choice) => Object.isFrozen(choice))).toBe(true);
  });
});

describe('resolveVoice: what quick-ask speaks with', () => {
  it('is the saved voice while the list offers it', () => {
    expect(resolveVoice(IOS_PHONE, 'en-GB', 'ios', ARTHUR.identifier)).toBe(ARTHUR.identifier);
  });

  it("is pickVoice's when nothing is saved", () => {
    expect(resolveVoice(IOS_PHONE, 'en-GB', 'ios', null)).toBe(MALCOLM_PREMIUM.identifier);
    expect(resolveVoice(IOS_PHONE, 'en-GB', 'ios', undefined)).toBe(MALCOLM_PREMIUM.identifier);
  });

  it("is pickVoice's when the saved voice is gone from the phone", () => {
    const gone = 'com.apple.voice.premium.en-GB.Serena';
    expect(resolveVoice(IOS_PHONE, 'en-GB', 'ios', gone)).toBe(MALCOLM_PREMIUM.identifier);
    expect(resolveVoice([], 'en-GB', 'ios', gone)).toBeUndefined();
  });

  it("is pickVoice's when the saved voice no longer speaks the phone's language", () => {
    expect(resolveVoice(IOS_PHONE, 'fr-FR', 'ios', DANIEL.identifier)).toBe(THOMAS.identifier);
  });

  it("is pickVoice's when the saved voice is one the list never offers", () => {
    expect(resolveVoice(IOS_PHONE, 'en-GB', 'ios', NOVELTY.identifier)).toBe(
      MALCOLM_PREMIUM.identifier,
    );
  });
});
