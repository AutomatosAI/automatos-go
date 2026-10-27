// Settings → Voice, wired. Quick-ask speaks Auto's reply in the saved voice at the saved speed and
// pitch, and in pickVoice's voice once the saved one is gone from the phone: the engine over the
// real speaker-core and a spy expo-speech port, given the speech the hook builds (voiceFor with the
// saved voice, then speakOptionsFor). Then, read from source (these files load React Native): the
// hook reads the setting store and builds its speech that way; Settings shows the Voice row under
// Notifications, opening /settings/voice; the route file mounts the screen; the screen's rows say
// whether they are selected and its sliders are named; and nothing opens the phone's settings.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { VOICE_SCREENS } from '../nav';
import {
  DEFAULT_VOICE_SETTING,
  speakOptionsFor,
  type VoiceSetting,
} from '../settings/voice-setting';
import { createSpeaker } from '../speech/speaker-core';
import type { SpeechVoice } from '../speech/voice-pick';
import { AI_VOICE_GREETING } from '../strings';
import { ask, harness } from './quick-ask-harness';
import { spySpeechPort } from './speech-port';
import { frames, wire } from './thread-states';

const MALCOLM = 'com.apple.voice.premium.en-GB.Malcolm';
const DANIEL = 'com.apple.voice.compact.en-GB.Daniel';
const PHONE: readonly SpeechVoice[] = [
  { identifier: DANIEL, name: 'Daniel', quality: 'Default', language: 'en-GB' },
  { identifier: MALCOLM, name: 'Malcolm', quality: 'Default', language: 'en-GB' },
];

/** The engine as use-quick-ask.ts builds it, over speaker-core and a spy expo-speech port. */
async function quickAskWith(setting: VoiceSetting) {
  const speech = spySpeechPort({ getVoices: async () => PHONE });
  const voiceOut = createSpeaker(speech.port, 'ios');
  const voice = await voiceOut.voiceFor('en-GB', setting.voice);
  const h = harness({ voiceOut, speech: speakOptionsFor('en-GB', voice, setting) });
  await ask(h, 'Anything today?');
  h.feed(...frames(wire.text('Two meetings. One at ')));
  return speech;
}

describe('quick-ask speaks with the saved setting', () => {
  it('in the saved voice, at the saved speed and pitch', async () => {
    const speech = await quickAskWith({
      ...DEFAULT_VOICE_SETTING,
      voice: DANIEL,
      rate: 1.1,
      pitch: 0.9,
    });
    expect(speech.utterances.map(({ text }) => text)).toEqual([AI_VOICE_GREETING, 'Two meetings.']);
    for (const { request } of speech.utterances) {
      expect(request).toMatchObject({ language: 'en-GB', voice: DANIEL, rate: 1.1, pitch: 0.9 });
    }
  });

  it("in pickVoice's voice once the saved one is gone from the phone", async () => {
    const gone = 'com.apple.voice.premium.en-GB.Serena';
    const speech = await quickAskWith({ ...DEFAULT_VOICE_SETTING, voice: gone, rate: 0.85 });
    expect(speech.at(0)).toMatchObject({ voice: MALCOLM, rate: 0.85, pitch: 1 });
  });

  it("in pickVoice's voice at the voice's own speed and pitch when nothing was changed", async () => {
    const speech = await quickAskWith(DEFAULT_VOICE_SETTING);
    expect(speech.at(0)).toMatchObject({ voice: MALCOLM, rate: 1, pitch: 1 });
  });
});

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.resolve(ROOT, file), 'utf8');
/** The code alone: comments stripped. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the quick-ask hook (source)', () => {
  const hook = code(read('src/voice/quick-ask/use-quick-ask.ts'));

  it('reads the saved setting through the store every reader hears', () => {
    expect(hook).toMatch(/from '\.\.\/settings\/use-voice-setting'/);
    expect(hook).toMatch(/const setting = useVoiceSetting\(\);/);
  });

  it('asks the voice out for the saved voice, and again when it changes', () => {
    expect(hook).toMatch(/usePhoneVoice\(language, setting\.voice\)/);
    expect(hook).toMatch(/voiceOut\.voiceFor\(language, saved\)/);
    expect(hook).toMatch(/\}, \[language, saved\]\);/);
  });

  it("speaks with the voice, rate and pitch speakOptionsFor builds, and Auto's server voice", () => {
    expect(hook).toMatch(/speech: speakOptionsFor\(language, voice, setting, server\),/);
    expect(hook).toMatch(
      /const server = serverSpeechFor\(\{ discovery, setting, voices, client \}\);/,
    );
  });
});

describe('Settings → Voice (source)', () => {
  const settings = read('app/(app)/settings/index.tsx');

  it('shows the Voice row directly under Notifications, before Remove this phone', () => {
    const notifications = settings.indexOf('router.push(pushScreens.notifications)');
    const voice = settings.indexOf('router.push(VOICE_SCREENS.settings)');
    expect(notifications).toBeGreaterThan(-1);
    expect(voice).toBeGreaterThan(notifications);
    expect(settings.indexOf('<RemovePhone />')).toBeGreaterThan(voice);
    const between = settings.slice(notifications, voice);
    expect(between.match(/<ListRow\b/g)).toHaveLength(1);
  });

  it("the row has lucide's audio-lines icon, imported on its own, and the voice copy", () => {
    expect(settings).toMatch(/import AudioLines from 'lucide-react-native\/icons\/audio-lines';/);
    expect(settings).toMatch(
      /<ListRow\s+icon=\{AudioLines\}\s+title=\{VOICE_SETTINGS_COPY\.row\}\s+accessibilityHint=\{VOICE_SETTINGS_COPY\.rowHint\}\s+onPress=\{\(\) => router\.push\(VOICE_SCREENS\.settings\)\}/,
    );
  });

  it('routes to /settings/voice, a file that mounts the screen', () => {
    expect(VOICE_SCREENS.settings).toBe('/settings/voice');
    const route = read('app/(app)/settings/voice.tsx');
    expect(route).toContain('<VoiceSettingsScreen />');
    expect(route).toMatch(/from '\.\.\/\.\.\/\.\.\/src\/voice\/settings\/VoiceSettingsScreen'/);
  });

  it('each voice is a button that says whether it is selected; the sliders are named', () => {
    const sections = code(read('src/voice/settings/VoiceSections.tsx'));
    expect(sections).toMatch(/<ListRow[\s\S]*?selected=\{row\.selected\}[\s\S]*?onPress=/);
    expect(sections).toMatch(/accessibilityLabel=\{slider\.label\}/);
    expect(sections).toMatch(/valueText=\{slider\.words\}/);
    expect(sections).toMatch(/onChangeEnd=\{\(value\) => onRelease\(slider\.key, value\)\}/);
    const listRow = read('src/ui/ListRow.tsx');
    expect(listRow).toMatch(
      /accessibilityState=\{selected === undefined \? \{ disabled \} : \{ disabled, selected \}\}/,
    );
  });

  it('stops the sample when the screen goes, and opens no settings page', () => {
    const hook = code(read('src/voice/settings/use-voice-settings.ts'));
    expect(hook).toMatch(/return \(\) => \{\s*player\.stop\(\);\s*unlisten\(\);\s*\};/);
    expect(hook).not.toMatch(/Linking|openSettings|openURL/);
    const screen = code(read('src/voice/settings/VoiceSettingsScreen.tsx'));
    expect(screen).not.toMatch(/Linking|openURL/);
  });

  it("speaks only through the speaker: expo-speech stays speaker.ts's (KV15)", () => {
    for (const file of [
      'src/voice/settings/use-voice-settings.ts',
      'src/voice/settings/sample-player.ts',
      'src/voice/settings/VoiceSections.tsx',
      'src/voice/settings/VoiceSettingsScreen.tsx',
    ]) {
      expect(read(file), file).not.toMatch(/from 'expo-speech'/);
    }
  });
});
