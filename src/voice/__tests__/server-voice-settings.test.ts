// Settings → Voice with Auto's server voice (server-view-model.ts): the server's voices listed only
// with tts (name, accent in words, the default marked), the server's default selected unless one
// was chosen, "Use this phone's voice instead" last; the phone's voices only without tts or once
// chosen; Speed for both and Pitch for the phone's voice only, with a one-line reason; a tap's
// setting, persisted and read back; the sample through the server voice; and, read from source,
// the hook and the screen wired that way.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  VOICES_LOADING,
  VOICES_OFF,
  VOICES_UNAVAILABLE,
  voicesReady,
} from '../server/server-voices';
import type { ServerVoiceList } from '../server/voice-api';
import { createSamplePlayer } from '../settings/sample-player';
import {
  accentWords,
  screenWords,
  serverVoiceRows,
  showsPhoneVoices,
  soundPart,
  withServerChoice,
} from '../settings/server-view-model';
import { DEFAULT_VOICE_SETTING, type VoiceSetting } from '../settings/voice-setting';
import { createVoiceSettingStore } from '../settings/voice-setting-store';
import type { SpeakOptions } from '../speech/speaker-core';
import { VOICE_SETTINGS_COPY } from '../strings';

const LIST: ServerVoiceList = {
  defaultId: 'af_heart',
  voices: [
    { id: 'af_heart', name: 'Heart', accent: 'en-US', gender: 'female' },
    { id: 'bm_george', name: 'George', accent: 'British English', gender: 'male' },
    { id: 'zz_plain', name: 'Plain', accent: null, gender: null },
  ],
};
const READY = voicesReady(LIST);
const SERVER = VOICE_SETTINGS_COPY.server;
const PHONE_SETTING: VoiceSetting = { ...DEFAULT_VOICE_SETTING, source: 'phone' };

const titles = (rows: readonly { title: string }[] | null) => rows?.map((row) => row.title);
const selected = (rows: readonly { title: string; selected: boolean }[] | null) =>
  rows?.filter((row) => row.selected).map((row) => row.title);

describe('the server section', () => {
  it('is not there without tts: the screen is as before', () => {
    expect(serverVoiceRows(VOICES_OFF, DEFAULT_VOICE_SETTING)).toBeNull();
    expect(showsPhoneVoices(VOICES_OFF, DEFAULT_VOICE_SETTING)).toBe(true);
    expect(screenWords(VOICES_OFF)).toEqual({
      lede: VOICE_SETTINGS_COPY.lede,
      phoneTitle: VOICE_SETTINGS_COPY.voiceSection,
      resetHint: VOICE_SETTINGS_COPY.resetHint,
    });
  });

  it("lists the server's voices with their accents, the default marked, then the phone", () => {
    const rows = serverVoiceRows(READY, DEFAULT_VOICE_SETTING);
    expect(titles(rows)).toEqual(['Heart', 'George', 'Plain', SERVER.usePhone]);
    expect(rows?.map((row) => row.summary)).toEqual([
      'English (US) · Default',
      'British English',
      '',
      SERVER.usePhoneSummary,
    ]);
  });

  it("selects the server's default unless a voice was chosen", () => {
    expect(selected(serverVoiceRows(READY, DEFAULT_VOICE_SETTING))).toEqual(['Heart']);
    const george = { ...DEFAULT_VOICE_SETTING, serverVoice: 'bm_george' };
    expect(selected(serverVoiceRows(READY, george))).toEqual(['George']);
    const gone = { ...DEFAULT_VOICE_SETTING, serverVoice: 'am_gone' };
    expect(selected(serverVoiceRows(READY, gone))).toEqual(['Heart']);
  });

  it("selects the first voice when the server names no default, and the phone row when it's chosen", () => {
    const noDefault = voicesReady({ ...LIST, defaultId: null });
    expect(selected(serverVoiceRows(noDefault, DEFAULT_VOICE_SETTING))).toEqual(['Heart']);
    expect(selected(serverVoiceRows(READY, PHONE_SETTING))).toEqual([SERVER.usePhone]);
  });

  it("stands one row for the server's default while the list loads or did not load", () => {
    const loading = serverVoiceRows(VOICES_LOADING, DEFAULT_VOICE_SETTING);
    expect(titles(loading)).toEqual([SERVER.defaultVoice, SERVER.usePhone]);
    expect(loading?.[0]?.summary).toBe(SERVER.loading);
    expect(selected(loading)).toEqual([SERVER.defaultVoice]);
    const failed = serverVoiceRows(VOICES_UNAVAILABLE, PHONE_SETTING);
    expect(failed?.[0]?.summary).toBe(SERVER.defaultSummary);
    expect(selected(failed)).toEqual([SERVER.usePhone]);
    const empty = serverVoiceRows(voicesReady({ defaultId: null, voices: [] }), PHONE_SETTING);
    expect(titles(empty)).toEqual([SERVER.defaultVoice, SERVER.usePhone]);
  });

  it("shows the phone's voices only once the phone's voice is chosen", () => {
    expect(showsPhoneVoices(READY, DEFAULT_VOICE_SETTING)).toBe(false);
    expect(showsPhoneVoices(READY, PHONE_SETTING)).toBe(true);
    expect(screenWords(READY)).toEqual({
      lede: SERVER.lede,
      phoneTitle: SERVER.phoneSection,
      resetHint: SERVER.resetHint,
    });
  });

  it('words an accent tag and keeps any other words', () => {
    expect(accentWords('en-US')).toBe('English (US)');
    expect(accentWords('en_GB')).toBe('English (GB)');
    expect(accentWords('American English')).toBe('American English');
    expect(accentWords(null)).toBe('');
  });
});

describe('Speed and Pitch', () => {
  it('Speed alone for the server voice, with a one-line reason for Pitch', () => {
    const part = soundPart(READY, DEFAULT_VOICE_SETTING);
    expect(part.title).toBe(SERVER.speedSection);
    expect(part.sliders.map((slider) => slider.key)).toEqual(['rate']);
    expect(part.note).toBe(SERVER.pitchPhoneOnly);
  });

  it('Speed and Pitch for the phone voice, with or without tts', () => {
    for (const [voices, setting] of [
      [READY, PHONE_SETTING],
      [VOICES_OFF, DEFAULT_VOICE_SETTING],
    ] as const) {
      const part = soundPart(voices, setting);
      expect(part.title).toBe(VOICE_SETTINGS_COPY.soundSection);
      expect(part.sliders.map((slider) => slider.key)).toEqual(['rate', 'pitch']);
      expect(part.note).toBeNull();
    }
  });
});

describe('a tap, saved', () => {
  it("chooses a server voice, the phone's voice, and back, kept across a launch", () => {
    const items = new Map<string, string>();
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => {
        items.set(key, value);
      },
    };
    const store = createVoiceSettingStore(() => storage);
    const george = withServerChoice(store.get(), { source: 'server', voice: 'bm_george' });
    store.set(george);
    expect(createVoiceSettingStore(() => storage).get()).toMatchObject({
      source: 'server',
      serverVoice: 'bm_george',
    });
    store.set(withServerChoice(store.get(), { source: 'phone' }));
    expect(createVoiceSettingStore(() => storage).get()).toMatchObject({
      source: 'phone',
      serverVoice: 'bm_george',
    });
    store.set(withServerChoice(store.get(), { source: 'server', voice: null }));
    expect(createVoiceSettingStore(() => storage).get()).toMatchObject({
      source: 'server',
      serverVoice: null,
    });
  });

  it('each row carries what it chooses', () => {
    const rows = serverVoiceRows(READY, DEFAULT_VOICE_SETTING);
    expect(rows?.map((row) => row.choice)).toEqual([
      { source: 'server', voice: 'af_heart' },
      { source: 'server', voice: 'bm_george' },
      { source: 'server', voice: 'zz_plain' },
      { source: 'phone' },
    ]);
  });
});

describe('the sample with the server voice', () => {
  it('speaks the line with the server speech, the phone voice kept for a fallback', async () => {
    const spoken: { text: string; options: SpeakOptions }[] = [];
    const speaker = {
      voiceFor: vi.fn(async () => 'Daniel'),
      speak: vi.fn((text: string, options: SpeakOptions) => {
        spoken.push({ text, options });
      }),
      stop: vi.fn(),
    };
    const server = { voice: 'bm_george', speed: 1.1, client: { binary: vi.fn() } };
    const setting = { ...DEFAULT_VOICE_SETTING, serverVoice: 'bm_george', rate: 1.1 };
    await createSamplePlayer(speaker, 'Hi.').play('en-GB', setting, server);
    expect(speaker.stop).toHaveBeenCalledTimes(1);
    expect(spoken).toEqual([
      {
        text: 'Hi.',
        options: { language: 'en-GB', voice: 'Daniel', rate: 1.1, pitch: 1, server },
      },
    ]);
  });
});

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.resolve(ROOT, file), 'utf8');
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Settings → Voice (source)', () => {
  it('samples through the voice out with the speech quick-ask would use, the list read afresh', () => {
    const hook = code(read('src/voice/settings/use-voice-settings.ts'));
    expect(hook).not.toMatch(/from '\.\.\/speech\/speaker'/);
    expect(hook).not.toMatch(/from 'expo-audio'/);
    expect(hook).toMatch(/createSamplePlayer\(voiceOut, VOICE_SETTINGS_COPY\.sample\)/);
    expect(hook).toMatch(/serverSpeechFor\(\{ discovery, setting, voices, client \}\)/);
    expect(hook).toMatch(/useServerVoices\(true\)/);
  });

  it('shows the server list only when there is one, and the phone list only when it is shown', () => {
    const screen = code(read('src/voice/settings/VoiceSettingsScreen.tsx'));
    expect(screen).toMatch(/view\.server === null \? null : \(\s*<ServerVoiceList/);
    expect(screen).toMatch(/view\.phone === null \? null : \(\s*<VoiceList/);
    const sections = code(read('src/voice/settings/VoiceSections.tsx'));
    expect(sections).toMatch(/sound\.note === null \? null : \(/);
    expect(sections).toMatch(/onPress=\{\(row\) => onChoose\(row\.choice\)\}/);
  });
});
