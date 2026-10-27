// Settings → Voice with Auto's server voice (27 Oct 2026): the screen's parts and words, pure (no
// React, React Native or Expo). The words are VOICE_SETTINGS_COPY.server's (src/voice/strings.ts).
//   Without tts the screen is as before: the phone's voices under "Auto's voice", their help line,
//   Speed and Pitch. With tts, "Auto's voice" lists the server's voices (name, accent, the server's
//   default marked) and last "Use this phone's voice instead"; the phone's voices and their help
//   line show only once that is chosen, under "This phone's voices". Selected: the phone row when
//   the phone's voice is chosen, else the saved server voice while the list offers it, else the
//   server's default. While the list loads, or when it did not load, one row stands for the
//   server's default voice. Speed is for both voices; Pitch only for the phone's, so with the
//   server voice it gives way to a one-line reason.

import type { ServerVoicesState } from '../server/server-voices';
import { resolveServerVoice } from '../server/server-voices';
import type { ServerVoice } from '../server/voice-api';
import { VOICE_SETTINGS_COPY } from '../strings';
import { accentOf, soundSliders, type SoundSlider } from './view-model';
import type { VoiceSetting } from './voice-setting';

const COPY = VOICE_SETTINGS_COPY;
const SERVER = COPY.server;

/** What a tap on a server-section row chooses. */
export type ServerChoice =
  { readonly source: 'server'; readonly voice: string | null } | { readonly source: 'phone' };

export type ServerVoiceRow = Readonly<{
  key: string;
  title: string;
  summary: string;
  selected: boolean;
  choice: ServerChoice;
}>;

/** The sound section: its title, its sliders, and the reason Pitch is not there (or null). */
export type SoundPart = Readonly<{
  title: string;
  sliders: readonly SoundSlider[];
  note: string | null;
}>;

/** A BCP 47 tag ('en-US', 'en_GB', 'en'): read as a language and region. */
const LANGUAGE_TAG = /^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$/i;

/** The accent as the row shows it: a tag in words ('English (US)'), any other words as sent. */
export function accentWords(accent: string | null): string {
  if (!accent) return '';
  return LANGUAGE_TAG.test(accent) ? accentOf(accent) : accent;
}

function summaryOf(voice: ServerVoice, defaultId: string | null): string {
  const parts = [accentWords(voice.accent), voice.id === defaultId ? SERVER.defaultTag : ''];
  return parts.filter(Boolean).join(' · ');
}

function phoneRow(setting: VoiceSetting): ServerVoiceRow {
  return Object.freeze({
    key: 'phone',
    title: SERVER.usePhone,
    summary: SERVER.usePhoneSummary,
    selected: setting.source === 'phone',
    choice: Object.freeze({ source: 'phone' }),
  });
}

/** The one row for the server's default voice (list loading or not loaded). */
function defaultRow(voices: ServerVoicesState, setting: VoiceSetting): ServerVoiceRow {
  return Object.freeze({
    key: 'server-default',
    title: SERVER.defaultVoice,
    summary: voices.kind === 'loading' ? SERVER.loading : SERVER.defaultSummary,
    selected: setting.source !== 'phone',
    choice: Object.freeze({ source: 'server', voice: setting.serverVoice }),
  });
}

/** The server voice a server-voice setting speaks in: the saved one offered, else the default. */
function chosenId(voices: readonly ServerVoice[], defaultId: string | null, saved: string | null) {
  return saved ?? defaultId ?? voices[0]?.id ?? null;
}

/** "Auto's voice" with tts: the server's voices, then the phone's; null without tts. */
export function serverVoiceRows(
  voices: ServerVoicesState,
  setting: VoiceSetting,
): readonly ServerVoiceRow[] | null {
  if (voices.kind === 'off') return null;
  if (voices.kind !== 'ready' || voices.list.voices.length === 0) {
    return Object.freeze([defaultRow(voices, setting), phoneRow(setting)]);
  }
  const { defaultId } = voices.list;
  const saved = resolveServerVoice(setting.serverVoice, voices);
  const chosen = setting.source === 'phone' ? null : chosenId(voices.list.voices, defaultId, saved);
  const rows = voices.list.voices.map((voice) =>
    Object.freeze({
      key: `server:${voice.id}`,
      title: voice.name,
      summary: summaryOf(voice, defaultId),
      selected: voice.id === chosen,
      choice: Object.freeze({ source: 'server', voice: voice.id }),
    }),
  );
  return Object.freeze([...rows, phoneRow(setting)]);
}

/** The phone's voices show without tts, or once the person chose this phone's voice. */
export function showsPhoneVoices(voices: ServerVoicesState, setting: VoiceSetting): boolean {
  return voices.kind === 'off' || setting.source === 'phone';
}

/** Speed and Pitch for the phone's voice; Speed alone, and why, for the server's. */
export function soundPart(voices: ServerVoicesState, setting: VoiceSetting): SoundPart {
  const sliders = soundSliders(setting);
  if (showsPhoneVoices(voices, setting)) {
    return Object.freeze({ title: COPY.soundSection, sliders, note: null });
  }
  return Object.freeze({
    title: SERVER.speedSection,
    sliders: Object.freeze(sliders.filter((slider) => slider.key !== 'pitch')),
    note: SERVER.pitchPhoneOnly,
  });
}

/** The lede, the phone section's title and Reset's hint, with or without the server voice. */
export function screenWords(voices: ServerVoicesState) {
  const server = voices.kind !== 'off';
  return Object.freeze({
    lede: server ? SERVER.lede : COPY.lede,
    phoneTitle: server ? SERVER.phoneSection : COPY.voiceSection,
    resetHint: server ? SERVER.resetHint : COPY.resetHint,
  });
}

/** The setting after a tap on a server-section row. */
export function withServerChoice(setting: VoiceSetting, choice: ServerChoice): VoiceSetting {
  if (choice.source === 'phone') return { ...setting, source: 'phone' };
  return { ...setting, source: 'server', serverVoice: choice.voice };
}
