// "I speak" (27 Oct 2026): the setting's language fields on the phone's store (absent → Automatic,
// Portugal's Portuguese, each Portuguese's default voice; a value saved before them reads exactly
// as it did; a bad value in one reads as its default alone; defaults are never written), the
// locale each choice listens and speaks in, and Settings → Voice's language rows.

import { describe, expect, it, vi } from 'vitest';

import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { languageRows } from '../language/language-rows';
import {
  choiceLocale,
  listeningLocale,
  portugueseFor,
  portugueseOf,
  speakChoiceOf,
  spokenName,
  withSpeakChoice,
} from '../language/speak-language';
import {
  DEFAULT_VOICE_SETTING,
  VOICE_SETTING_VERSION,
  parseVoiceSetting,
  serialiseVoiceSetting,
  type VoiceSetting,
} from '../settings/voice-setting';
import { VOICE_SETTING_KEY, createVoiceSettingStore } from '../settings/voice-setting-store';

const stored = (fields: Record<string, unknown>) =>
  JSON.stringify({ v: VOICE_SETTING_VERSION, voice: null, rate: 1, pitch: 1, ...fields });

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  const storage: KeyValueStorage = {
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      items.set(key, value);
    }),
    removeItem: vi.fn(),
  };
  return { storage, items };
}

describe('the language fields on the store', () => {
  it('are absent by default: Automatic, Portugal’s Portuguese, each Portuguese’s default voice', () => {
    expect(speakChoiceOf(DEFAULT_VOICE_SETTING)).toBe('auto');
    expect(portugueseOf(DEFAULT_VOICE_SETTING)).toBe('pt-PT');
    expect(DEFAULT_VOICE_SETTING.voices).toBeUndefined();
  });

  it('read a value saved before them exactly as it was, Automatic', () => {
    const before = stored({ voice: 'com.apple.voice.premium.en-GB.Malcolm', source: 'phone' });
    const setting = parseVoiceSetting(before);
    expect(setting).toEqual({
      source: 'phone',
      serverVoice: null,
      voice: 'com.apple.voice.premium.en-GB.Malcolm',
      rate: 1,
      pitch: 1,
    });
    expect(speakChoiceOf(setting)).toBe('auto');
  });

  it('round-trip through the store (the next launch)', () => {
    const { storage, items } = memoryStorage();
    const setting: VoiceSetting = {
      ...DEFAULT_VOICE_SETTING,
      language: 'pt-BR',
      portuguese: 'pt-BR',
      voices: { 'pt-PT': { source: 'server', serverVoice: 'pm_alex', voice: null } },
    };
    createVoiceSettingStore(() => storage).set(setting);
    expect(JSON.parse(items.get(VOICE_SETTING_KEY) ?? '')).toMatchObject({
      language: 'pt-BR',
      portuguese: 'pt-BR',
      voices: { 'pt-PT': { source: 'server', serverVoice: 'pm_alex', voice: null } },
    });
    expect(createVoiceSettingStore(() => storage).get()).toEqual(setting);
  });

  it('never write a default: Automatic and Portugal’s Portuguese leave the stored value as before', () => {
    const written = JSON.parse(
      serialiseVoiceSetting({ ...DEFAULT_VOICE_SETTING, language: 'auto', portuguese: 'pt-PT' }),
    );
    expect(Object.keys(written).sort()).toEqual(
      ['pitch', 'rate', 'serverVoice', 'source', 'v', 'voice'].sort(),
    );
  });

  it('read a bad value in one of them as its default alone, the rest kept', () => {
    const setting = parseVoiceSetting(
      stored({
        language: 'fr-FR',
        portuguese: 42,
        voices: {
          'pt-PT': { source: 'loud' },
          'pt-BR': { source: 'phone', serverVoice: null, voice: 'x' },
        },
        rate: 1.1,
      }),
    );
    expect(speakChoiceOf(setting)).toBe('auto');
    expect(portugueseOf(setting)).toBe('pt-PT');
    expect(setting.voices).toEqual({ 'pt-BR': { source: 'phone', serverVoice: null, voice: 'x' } });
    expect(setting.rate).toBe(1.1);
  });

  it('read garbage in voices as no saved Portuguese voice', () => {
    expect(parseVoiceSetting(stored({ voices: 'nope' })).voices).toBeUndefined();
  });
});

describe('the locale each choice listens and speaks in', () => {
  it('Automatic is the phone’s first locale, as before the setting', () => {
    expect(choiceLocale('auto', 'en-US')).toBe('en-US');
    expect(choiceLocale('auto', 'pt-PT')).toBe('pt-PT');
  });

  it('English is the phone’s own English, else British English', () => {
    expect(choiceLocale('en', 'en-US')).toBe('en-US');
    expect(choiceLocale('en', 'en-IE')).toBe('en-IE');
    expect(choiceLocale('en', 'pt-PT')).toBe('en-GB');
    expect(choiceLocale('en', 'fr-FR')).toBe('en-GB');
  });

  it('each Portuguese is its own locale', () => {
    expect(choiceLocale('pt-PT', 'en-GB')).toBe('pt-PT');
    expect(choiceLocale('pt-BR', 'en-GB')).toBe('pt-BR');
  });

  it('reads the saved choice', () => {
    expect(listeningLocale(DEFAULT_VOICE_SETTING, 'en-GB')).toBe('en-GB');
    expect(listeningLocale({ ...DEFAULT_VOICE_SETTING, language: 'pt-PT' }, 'en-GB')).toBe('pt-PT');
  });

  it('a Portuguese choice is also the one the switch goes to; English keeps it', () => {
    const brazil = withSpeakChoice(DEFAULT_VOICE_SETTING, 'pt-BR');
    expect([brazil.language, brazil.portuguese]).toEqual(['pt-BR', 'pt-BR']);
    const english = withSpeakChoice(brazil, 'en');
    expect([english.language, english.portuguese]).toEqual(['en', 'pt-BR']);
  });

  it('names each Portuguese, and any other language by languageName', () => {
    expect(spokenName('pt-PT')).toBe('Portuguese (Portugal)');
    expect(spokenName('pt_br')).toBe('Portuguese (Brazil)');
    expect(spokenName('en-GB')).toBe('English');
    expect(portugueseFor('pt-BR')).toBe('pt-BR');
    expect(portugueseFor('pt-AO')).toBe('pt-PT');
    expect(portugueseFor('en-PT')).toBeNull();
  });
});

describe('the language rows', () => {
  it('are Automatic, English and the two Portuguese, named in their own language', () => {
    const rows = languageRows(DEFAULT_VOICE_SETTING, 'en-GB');
    expect(rows.map((row) => [row.title, row.summary])).toEqual([
      ['Automatic', "This phone's language: English (GB)"],
      ['English', 'English (GB)'],
      ['Português (Portugal)', 'Portuguese (Portugal)'],
      ['Português (Brasil)', 'Portuguese (Brazil)'],
    ]);
  });

  it('select exactly the saved choice', () => {
    const rows = languageRows({ ...DEFAULT_VOICE_SETTING, language: 'pt-PT' }, 'en-GB');
    expect(rows.filter((row) => row.selected).map((row) => row.key)).toEqual(['pt-PT']);
    expect(languageRows(DEFAULT_VOICE_SETTING, 'en-GB')[0]?.selected).toBe(true);
  });

  it('say which English on a phone not in English', () => {
    expect(languageRows(DEFAULT_VOICE_SETTING, 'pt-PT')[1]?.summary).toBe('English (GB)');
  });
});
