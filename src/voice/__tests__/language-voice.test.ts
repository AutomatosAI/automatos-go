// Auto's voice per language (27 Oct 2026): English keeps the setting's own choice (the server's
// default until one is chosen, as before); Portuguese (Brazil), the one Portuguese the app speaks,
// in the server's first pt-BR voice by default, else the phone's pt-BR voice. Each language's
// choice is saved on its own, speed and pitch are shared. Quick-ask wired as use-quick-ask.ts wires it speaks the reply in
// the chosen language with the language's voice, and a server failure falls back to the phone's
// voice for that language. Settings → Voice lists the language's voices and plays the sample in its
// own words.

import { describe, expect, it, vi } from 'vitest';

import type { GateInput } from '../../api/capabilities';
import {
  resetLanguage,
  serverVoicesFor,
  settingForLanguage,
  spokenLanguage,
  withLanguageVoice,
} from '../language/language-voice';
import { createServerSpeaker } from '../server/server-speaker';
import {
  VOICES_LOADING,
  VOICES_UNAVAILABLE,
  serverSpeechFor,
  voicesReady,
  type ServerVoicesState,
} from '../server/server-voices';
import { SpeechFailure, type ServerVoiceList } from '../server/voice-api';
import { createSamplePlayer, sampleLine } from '../settings/sample-player';
import { serverVoiceRows } from '../settings/server-view-model';
import {
  DEFAULT_VOICE_SETTING,
  speakOptionsFor,
  type VoiceSetting,
} from '../settings/voice-setting';
import { createReplyVoice } from '../speech/reply-voice';
import { createSpeaker, type SpeakOptions } from '../speech/speaker-core';
import type { SpeechVoice } from '../speech/voice-pick';
import { SAMPLE_LINES } from '../strings';
import { ask, harness } from './quick-ask-harness';
import { fakeServerPorts, settle } from './server-ports';
import { spySpeechPort } from './speech-port';
import { frames, wire } from './thread-states';

const LIST: ServerVoiceList = {
  defaultId: 'af_heart',
  voices: [
    { id: 'af_heart', name: 'Heart', accent: 'en-US', gender: 'female' },
    { id: 'bm_george', name: 'George', accent: 'en-GB', gender: 'male' },
    { id: 'pf_dora', name: 'Dora', accent: 'pt-BR', gender: 'female' },
    { id: 'pm_alex', name: 'Alex', accent: 'pt-BR', gender: 'male' },
  ],
};
const READY = voicesReady(LIST);
const NO_PORTUGUESE = voicesReady({ defaultId: 'af_heart', voices: LIST.voices.slice(0, 2) });
const TTS: GateInput = { capabilities: ['spoken_mode', 'tts'], push: { expo: true } };
const CLIENT = { binary: vi.fn() };

const JOANA = 'com.apple.voice.premium.pt-PT.Joana';
const CATARINA = 'com.apple.voice.compact.pt-PT.Catarina';
const LUCIANA = 'com.apple.voice.enhanced.pt-BR.Luciana';
const DANIEL = 'com.apple.voice.compact.en-GB.Daniel';
const PHONE_VOICES: readonly SpeechVoice[] = [
  { identifier: DANIEL, name: 'Daniel', quality: 'Default', language: 'en-GB' },
  { identifier: CATARINA, name: 'Catarina', quality: 'Default', language: 'pt-PT' },
  { identifier: JOANA, name: 'Joana', quality: 'Default', language: 'pt-PT' },
  { identifier: LUCIANA, name: 'Luciana', quality: 'Enhanced', language: 'pt-BR' },
];

const choose = (language: VoiceSetting['language']): VoiceSetting => ({
  ...DEFAULT_VOICE_SETTING,
  language,
});

/** What quick-ask hands the server for the saved setting on an en-GB phone. */
function serverFor(saved: VoiceSetting, voices: ServerVoicesState = READY) {
  const spoken = spokenLanguage(saved, 'en-GB', voices);
  const server = serverSpeechFor({ ...spoken, discovery: TTS, client: CLIENT });
  return { spoken, server };
}

describe('the server voice per language', () => {
  it('English: as before, the server’s default (null) from its whole list', () => {
    const { spoken, server } = serverFor(choose('en'));
    expect(spoken.language).toBe('en-GB');
    expect(spoken.voices).toBe(READY);
    expect(server?.voice).toBeNull();
    expect(serverFor({ ...choose('en'), serverVoice: 'bm_george' }).server?.voice).toBe(
      'bm_george',
    );
  });

  it('Portuguese (Brazil): the server’s first pt-BR voice, or the one chosen', () => {
    expect(serverFor(choose('pt-BR')).server?.voice).toBe('pf_dora');
    const alex = {
      ...choose('pt-BR'),
      voices: { 'pt-BR': { source: 'server', serverVoice: 'pm_alex', voice: null } },
    } as const;
    expect(serverFor(alex).server?.voice).toBe('pm_alex');
  });

  it('Portuguese (Brazil): a chosen voice the server dropped falls back to its first pt-BR voice', () => {
    const gone = {
      ...choose('pt-BR'),
      voices: { 'pt-BR': { source: 'server', serverVoice: 'pm_gone', voice: null } },
    } as const;
    expect(serverFor(gone).server?.voice).toBe('pf_dora');
  });

  it('Portuguese (Brazil): the phone’s voice when the server has none, or none is known yet', () => {
    expect(serverFor(choose('pt-BR'), NO_PORTUGUESE).server).toBeUndefined();
    expect(serverFor(choose('pt-BR'), VOICES_LOADING).server).toBeUndefined();
    expect(serverFor(choose('pt-BR'), VOICES_UNAVAILABLE).server).toBeUndefined();
  });

  it('Portuguese (Brazil): a pt-BR voice first, even when the server lists another Portuguese first', () => {
    const portugal = { id: 'pf_ines', name: 'Inês', accent: 'pt-PT', gender: 'female' } as const;
    const mixed = voicesReady({ defaultId: 'af_heart', voices: [portugal, ...LIST.voices] });
    expect(serverFor(choose('pt-BR'), mixed).server?.voice).toBe('pf_dora');
  });

  it('Automatic on a phone in Portugal’s Portuguese: Brazil’s voice, in the phone’s locale', () => {
    const spoken = spokenLanguage(DEFAULT_VOICE_SETTING, 'pt-PT', READY);
    expect(spoken.language).toBe('pt-PT');
    expect(spoken.setting).toMatchObject({ source: 'server', serverVoice: 'pf_dora' });
  });

  it('lists only the Portuguese voices for Portuguese, with no server default among them', () => {
    const offered = serverVoicesFor(READY, 'pt-BR');
    expect(offered.kind === 'ready' && offered.list).toEqual({
      defaultId: null,
      voices: LIST.voices.slice(2),
    });
    expect(serverVoicesFor(READY, 'en-GB')).toBe(READY);
    expect(serverVoicesFor(VOICES_LOADING, 'pt-BR')).toBe(VOICES_LOADING);
  });
});

describe('each language’s choice, saved on its own', () => {
  it('a Portuguese choice leaves English’s alone; speed and pitch are shared', () => {
    const english = { ...DEFAULT_VOICE_SETTING, serverVoice: 'bm_george', voice: DANIEL };
    const chosen = {
      ...settingForLanguage(english, 'pt-BR'),
      source: 'phone',
      voice: LUCIANA,
      rate: 1.1,
    } as const;
    const saved = withLanguageVoice(english, 'pt-BR', chosen);
    expect(saved).toMatchObject({ serverVoice: 'bm_george', voice: DANIEL, rate: 1.1 });
    expect(saved.voices).toEqual({
      'pt-BR': { source: 'phone', serverVoice: null, voice: LUCIANA },
    });
    expect(settingForLanguage(saved, 'pt-BR')).toMatchObject({ source: 'phone', voice: LUCIANA });
    expect(settingForLanguage(saved, 'en-GB')).toBe(saved);
  });

  it('English’s choice is the setting’s own fields, as before', () => {
    const saved = withLanguageVoice(DEFAULT_VOICE_SETTING, 'en-GB', {
      ...DEFAULT_VOICE_SETTING,
      source: 'phone',
      voice: DANIEL,
    });
    expect(saved).toEqual({ ...DEFAULT_VOICE_SETTING, source: 'phone', voice: DANIEL });
  });

  it('Reset resets the language’s voice, speed and pitch, and keeps "I speak"', () => {
    const saved: VoiceSetting = {
      ...choose('pt-BR'),
      rate: 1.2,
      voices: { 'pt-BR': { source: 'phone', serverVoice: 'pm_alex', voice: LUCIANA } },
    };
    const reset = resetLanguage(saved, 'pt-BR');
    expect(reset).toMatchObject({ language: 'pt-BR', rate: 1, pitch: 1 });
    expect(reset.voices?.['pt-BR']).toEqual({ source: 'server', serverVoice: null, voice: null });
  });
});

/** Quick-ask over the one voice out, its speech built as use-quick-ask.ts builds it. */
async function quickAskIn(saved: VoiceSetting) {
  const server = fakeServerPorts();
  const phone = spySpeechPort({ getVoices: async () => PHONE_VOICES });
  const voiceOut = createReplyVoice({
    phone: createSpeaker(phone.port, 'ios'),
    server: (emit) => createServerSpeaker(server.ports, emit),
  });
  const { language, voices, setting } = spokenLanguage(saved, 'en-GB', READY);
  const voice = await voiceOut.voiceFor(language, setting.voice);
  const speechServer = serverSpeechFor({ discovery: TTS, setting, voices, client: CLIENT });
  const h = harness({ voiceOut, speech: speakOptionsFor(language, voice, setting, speechServer) });
  voiceOut.listen(h.quickAsk.onSpeaker);
  await ask(h, 'Que tempo faz?');
  h.feed(...frames(wire.text('Está sol. Mais ')));
  return { h, server, phone };
}

describe('quick-ask speaks the chosen language', () => {
  it('Portuguese (Brazil) with the phone’s voice chosen: on the phone, in its pt-BR voice', async () => {
    const phoneVoice = {
      ...choose('pt-BR'),
      voices: { 'pt-BR': { source: 'phone', serverVoice: null, voice: null } },
    } as const;
    const { h, server, phone } = await quickAskIn(phoneVoice);
    expect(h.recognizer.policy).toHaveBeenCalledWith('pt-BR');
    expect(server.requests).toHaveLength(0);
    expect(phone.at(1)).toMatchObject({ language: 'pt-BR', voice: LUCIANA });
  });

  it('Portuguese (Brazil): through the server’s pt-BR voice', async () => {
    const { h, server, phone } = await quickAskIn(choose('pt-BR'));
    expect(h.recognizer.policy).toHaveBeenCalledWith('pt-BR');
    expect(server.requests[0]?.server).toMatchObject({ voice: 'pf_dora' });
    expect(phone.utterances).toHaveLength(0);
  });

  it('a server failure: the phone’s voice for the chosen language says the rest', async () => {
    const { server, phone } = await quickAskIn(choose('pt-BR'));
    server.requests[0]?.refuse(new SpeechFailure('tts_busy'));
    await settle();
    expect(phone.utterances.length).toBeGreaterThan(0);
    for (const { request } of phone.utterances) {
      expect(request).toMatchObject({ language: 'pt-BR', voice: LUCIANA });
    }
  });
});

describe('Settings → Voice for the chosen language', () => {
  const rowsFor = (saved: VoiceSetting, voices: ServerVoicesState = READY) => {
    const spoken = spokenLanguage(saved, 'en-GB', voices);
    return serverVoiceRows(spoken.voices, spoken.setting, spoken.language.startsWith('en'));
  };
  const picked = (rows: ReturnType<typeof rowsFor>) =>
    rows?.filter((row) => row.selected).map((row) => row.key);

  it('Portuguese (Brazil) with the phone’s voice chosen: the pt-BR server voices, the phone’s row chosen', () => {
    const rows = rowsFor({
      ...choose('pt-BR'),
      voices: { 'pt-BR': { source: 'phone', serverVoice: null, voice: null } },
    });
    expect(rows?.map((row) => row.key)).toEqual(['server:pf_dora', 'server:pm_alex', 'phone']);
    expect(picked(rows)).toEqual(['phone']);
  });

  it('Portuguese (Brazil): its first pt-BR voice chosen, no Default tag', () => {
    const rows = rowsFor(choose('pt-BR'));
    expect(picked(rows)).toEqual(['server:pf_dora']);
    expect(rows?.[0]?.summary).toBe('Portuguese (BR)');
  });

  it('a Portuguese with no server voice: the phone’s row alone, chosen', () => {
    expect(picked(rowsFor(choose('pt-BR'), VOICES_UNAVAILABLE))).toEqual(['phone']);
    expect(rowsFor(choose('pt-BR'), NO_PORTUGUESE)?.map((row) => row.key)).toEqual(['phone']);
  });

  it('English: the server’s whole list, its default chosen, as before', () => {
    expect(picked(rowsFor(choose('en')))).toEqual(['server:af_heart']);
    expect(rowsFor(choose('en'))).toHaveLength(LIST.voices.length + 1);
  });

  it('the sample line is in the language’s own words', async () => {
    expect(sampleLine('pt-BR', 'Hi')).toBe(SAMPLE_LINES['pt-BR']);
    expect(sampleLine('pt-PT', 'Hi')).toBe(SAMPLE_LINES['pt-BR']);
    expect(sampleLine('en-GB', 'Hi')).toBe('Hi');
    const said: { text: string; options: SpeakOptions }[] = [];
    const speaker = {
      voiceFor: vi.fn(async () => LUCIANA),
      speak: vi.fn((text: string, options: SpeakOptions) => said.push({ text, options })),
      stop: vi.fn(),
    };
    const phoneVoice: VoiceSetting = {
      ...choose('pt-BR'),
      voices: { 'pt-BR': { source: 'phone', serverVoice: null, voice: null } },
    };
    await createSamplePlayer(speaker, 'Hi').play('pt-BR', settingForLanguage(phoneVoice, 'pt-BR'));
    expect(said).toEqual([
      {
        text: 'Oi, eu sou o Auto. É assim que vou soar quando eu te responder.',
        options: expect.objectContaining({ language: 'pt-BR', voice: LUCIANA }),
      },
    ]);
  });
});
