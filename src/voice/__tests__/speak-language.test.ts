// "I speak" (27 Oct 2026): the setting's language fields on the phone's store (absent → Automatic
// and Portuguese's default voice; a value saved before them reads exactly as it did; #25's European
// Portuguese reads as Brazil's; a bad value in one reads as its default alone; defaults are never
// written), the locale each choice listens and speaks in, and Settings → Voice's language rows.

import { describe, expect, it, vi } from 'vitest';

import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { languageRows } from '../language/language-rows';
import {
  choiceLocale,
  listeningLocale,
  portugueseFor,
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
  it('are absent by default: Automatic, Portuguese’s default voice', () => {
    expect(speakChoiceOf(DEFAULT_VOICE_SETTING)).toBe('auto');
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
      voices: { 'pt-BR': { source: 'server', serverVoice: 'pm_alex', voice: null } },
    };
    createVoiceSettingStore(() => storage).set(setting);
    expect(JSON.parse(items.get(VOICE_SETTING_KEY) ?? '')).toMatchObject({
      language: 'pt-BR',
      voices: { 'pt-BR': { source: 'server', serverVoice: 'pm_alex', voice: null } },
    });
    expect(createVoiceSettingStore(() => storage).get()).toEqual(setting);
  });

  it('never write a default: Automatic leaves the stored value as before', () => {
    const written = JSON.parse(
      serialiseVoiceSetting({ ...DEFAULT_VOICE_SETTING, language: 'auto' }),
    );
    expect(Object.keys(written).sort()).toEqual(
      ['pitch', 'rate', 'serverVoice', 'source', 'v', 'voice'].sort(),
    );
  });

  it('read a bad value in one of them as its default alone, the rest kept', () => {
    const setting = parseVoiceSetting(
      stored({
        language: 'fr-FR',
        voices: {
          'pt-BR': { source: 'phone', serverVoice: null, voice: 'x' },
        },
        rate: 1.1,
      }),
    );
    expect(speakChoiceOf(setting)).toBe('auto');
    expect(setting.voices).toEqual({ 'pt-BR': { source: 'phone', serverVoice: null, voice: 'x' } });
    expect(setting.rate).toBe(1.1);
  });

  it('read garbage in voices as no saved Portuguese voice', () => {
    expect(parseVoiceSetting(stored({ voices: 'nope' })).voices).toBeUndefined();
    expect(
      parseVoiceSetting(stored({ voices: { 'pt-BR': { source: 'loud' } } })).voices,
    ).toBeUndefined();
  });
});

describe('#25’s European Portuguese, saved on the phone', () => {
  const saved = stored({
    voice: 'com.apple.voice.premium.en-GB.Malcolm',
    source: 'phone',
    language: 'pt-PT',
    portuguese: 'pt-PT',
    voices: {
      'pt-PT': {
        source: 'phone',
        serverVoice: null,
        voice: 'com.apple.voice.enhanced.pt-PT.Joana',
      },
    },
  });

  it('reads as Brazil’s Portuguese, with Brazil’s own (default) voice', () => {
    const setting = parseVoiceSetting(saved);
    expect(speakChoiceOf(setting)).toBe('pt-BR');
    expect(listeningLocale(setting, 'en-GB')).toBe('pt-BR');
    expect(setting.voices).toBeUndefined();
    expect(setting).not.toHaveProperty('portuguese');
  });

  it('keeps the rest of the setting exactly as it was', () => {
    expect(parseVoiceSetting(saved)).toMatchObject({
      source: 'phone',
      voice: 'com.apple.voice.premium.en-GB.Malcolm',
      rate: 1,
      pitch: 1,
    });
  });

  it('keeps a Brazilian voice saved beside it', () => {
    const both = stored({
      language: 'pt-PT',
      voices: {
        'pt-PT': { source: 'phone', serverVoice: null, voice: null },
        'pt-BR': { source: 'server', serverVoice: 'pm_alex', voice: null },
      },
    });
    expect(parseVoiceSetting(both).voices).toEqual({
      'pt-BR': { source: 'server', serverVoice: 'pm_alex', voice: null },
    });
  });

  it('is written back as Brazil’s on the next save, with no European field', () => {
    const written = JSON.parse(serialiseVoiceSetting(parseVoiceSetting(saved)));
    expect(written.language).toBe('pt-BR');
    expect(Object.keys(written)).not.toContain('portuguese');
    expect(Object.keys(written)).not.toContain('voices');
  });
});

describe('the locale each choice listens and speaks in', () => {
  it('Automatic is the phone’s first locale, as before the setting', () => {
    expect(choiceLocale('auto', 'en-US')).toBe('en-US');
    expect(choiceLocale('auto', 'pt-PT')).toBe('pt-PT');
    expect(choiceLocale('auto', 'pt-BR')).toBe('pt-BR');
  });

  it('English is the phone’s own English, else British English', () => {
    expect(choiceLocale('en', 'en-US')).toBe('en-US');
    expect(choiceLocale('en', 'en-IE')).toBe('en-IE');
    expect(choiceLocale('en', 'pt-PT')).toBe('en-GB');
    expect(choiceLocale('en', 'fr-FR')).toBe('en-GB');
  });

  it('Portuguese is Brazil’s, whatever the phone', () => {
    expect(choiceLocale('pt-BR', 'en-GB')).toBe('pt-BR');
    expect(choiceLocale('pt-BR', 'pt-PT')).toBe('pt-BR');
  });

  it('reads the saved choice', () => {
    expect(listeningLocale(DEFAULT_VOICE_SETTING, 'en-GB')).toBe('en-GB');
    expect(listeningLocale({ ...DEFAULT_VOICE_SETTING, language: 'pt-BR' }, 'en-GB')).toBe('pt-BR');
  });

  it('saves the choice and nothing else', () => {
    const brazil = withSpeakChoice(DEFAULT_VOICE_SETTING, 'pt-BR');
    expect(brazil).toEqual({ ...DEFAULT_VOICE_SETTING, language: 'pt-BR' });
    expect(withSpeakChoice(brazil, 'en').language).toBe('en');
  });

  it('names Brazil’s Portuguese, and any other language by languageName', () => {
    expect(spokenName('pt_br')).toBe('Portuguese (Brazil)');
    expect(spokenName('pt-PT')).toBe('Portuguese');
    expect(spokenName('en-GB')).toBe('English');
  });

  it('speaks any Portuguese with Brazil’s voice and sample', () => {
    expect(portugueseFor('pt-BR')).toBe('pt-BR');
    expect(portugueseFor('pt-PT')).toBe('pt-BR');
    expect(portugueseFor('pt')).toBe('pt-BR');
    expect(portugueseFor('en-PT')).toBeNull();
  });
});

describe('the language rows', () => {
  it('are Automatic, English and Português (Brasil), named in their own language', () => {
    const rows = languageRows(DEFAULT_VOICE_SETTING, 'en-GB');
    expect(rows.map((row) => [row.title, row.summary])).toEqual([
      ['Automatic', "This phone's language: English (GB)"],
      ['English', 'English (GB)'],
      ['Português (Brasil)', 'Portuguese (Brazil)'],
    ]);
    expect(rows.map((row) => row.title)).not.toContain('Português (Portugal)');
  });

  it('select exactly the saved choice', () => {
    const rows = languageRows({ ...DEFAULT_VOICE_SETTING, language: 'pt-BR' }, 'en-GB');
    expect(rows.filter((row) => row.selected).map((row) => row.key)).toEqual(['pt-BR']);
    expect(languageRows(DEFAULT_VOICE_SETTING, 'en-GB')[0]?.selected).toBe(true);
  });

  it('say which English on a phone not in English', () => {
    expect(languageRows(DEFAULT_VOICE_SETTING, 'pt-PT')[1]?.summary).toBe('English (GB)');
  });
});
