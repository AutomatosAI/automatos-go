// Settings → Voice's rows and words (view-model.ts) and its sample line (sample-player.ts): one
// selected row, Automatic when the saved voice is gone; names without a repeated tier; the sliders'
// values shown and read out in words; the help line for each phone; and the sample spoken in the
// setting's voice, speed and pitch, the latest tap winning, nothing spoken once the screen went.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { createSamplePlayer } from '../settings/sample-player';
import {
  accentOf,
  helpLine,
  pitchWords,
  shownValue,
  soundSliders,
  speedWords,
  voiceName,
  voiceRows,
} from '../settings/view-model';
import { DEFAULT_VOICE_SETTING, type VoiceSetting } from '../settings/voice-setting';
import type { SpeakOptions } from '../speech/speaker-core';
import { AUTOMATIC_VOICE, type VoiceChoice } from '../speech/voice-choices';
import { VOICE_SETTINGS_COPY } from '../strings';

const MALCOLM = 'com.apple.voice.premium.en-GB.Malcolm';
const DANIEL = 'com.apple.voice.compact.en-GB.Daniel';
const CHOICES: readonly VoiceChoice[] = [
  AUTOMATIC_VOICE,
  {
    kind: 'voice',
    identifier: MALCOLM,
    name: 'Malcolm (Premium)',
    tier: 'premium',
    language: 'en-GB',
    inRegion: true,
  },
  {
    kind: 'voice',
    identifier: DANIEL,
    name: 'Daniel',
    tier: 'standard',
    language: 'en-US',
    inRegion: false,
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('accentOf', () => {
  it("names the language and the region: 'en-US' → 'English (US)', none → the language", () => {
    expect(accentOf('en-US')).toBe('English (US)');
    expect(accentOf('en_GB')).toBe('English (GB)');
    expect(accentOf('en')).toBe('English');
  });
});

describe('voiceRows', () => {
  it('names Automatic first, then each voice with its tier', () => {
    const rows = voiceRows(CHOICES, null);
    expect(rows.map((row) => [row.title, row.summary, row.voice])).toEqual([
      ['Automatic', 'Best voice on this phone', null],
      ['Malcolm', 'Premium · English (GB)', MALCOLM],
      ['Daniel', 'Standard · English (US)', DANIEL],
    ]);
  });

  it('selects Automatic when nothing is saved', () => {
    expect(voiceRows(CHOICES, null).map((row) => row.selected)).toEqual([true, false, false]);
  });

  it('selects the saved voice, and only it', () => {
    expect(voiceRows(CHOICES, DANIEL).map((row) => row.selected)).toEqual([false, false, true]);
  });

  it('selects Automatic when the saved voice is not on the list (quick-ask falls back to it)', () => {
    const gone = 'com.apple.voice.premium.en-GB.Serena';
    expect(voiceRows(CHOICES, gone).map((row) => row.selected)).toEqual([true, false, false]);
    expect(voiceRows([AUTOMATIC_VOICE], DANIEL).map((row) => row.selected)).toEqual([true]);
  });
});

describe('voiceName', () => {
  it("drops iOS's tier from the name (the row already says it)", () => {
    expect(voiceName('Ava (Premium)')).toBe('Ava');
    expect(voiceName('Samantha (Enhanced)')).toBe('Samantha');
    expect(voiceName('Daniel')).toBe('Daniel');
  });

  it("names Google's coded voices by their code and locale", () => {
    expect(voiceName('en-us-x-iol-local')).toBe('Voice IOL (en-US)');
    expect(voiceName('en-gb-x-gbb-local')).toBe('Voice GBB (en-GB)');
    expect(voiceName('some-other-voice')).toBe('some-other-voice');
  });
});

describe('the sliders', () => {
  it('are Speed then Pitch, 0.8 to 1.2 in steps of 0.05, at the setting’s values', () => {
    const sliders = soundSliders({ voice: null, rate: 0.9, pitch: 1.15 });
    expect(
      sliders.map(({ key, label, min, max, step, value, shown }) => ({
        key,
        label,
        min,
        max,
        step,
        value,
        shown,
      })),
    ).toEqual([
      { key: 'rate', label: 'Speed', min: 0.8, max: 1.2, step: 0.05, value: 0.9, shown: '0.90×' },
      { key: 'pitch', label: 'Pitch', min: 0.8, max: 1.2, step: 0.05, value: 1.15, shown: '1.15×' },
    ]);
  });

  it('show Normal at 1', () => {
    expect(shownValue(1)).toBe('Normal');
    expect(soundSliders(DEFAULT_VOICE_SETTING).map((slider) => slider.shown)).toEqual([
      'Normal',
      'Normal',
    ]);
  });

  it('read their value out in words', () => {
    expect(speedWords(1)).toBe('Normal');
    expect(speedWords(0.9)).toBe('Slower, 0.9 times');
    expect(speedWords(1.15)).toBe('Faster, 1.15 times');
    expect(pitchWords(0.8)).toBe('Lower, 0.8 times');
    expect(pitchWords(1.2)).toBe('Higher, 1.2 times');
    const [speed, pitch] = soundSliders(DEFAULT_VOICE_SETTING);
    expect(speed?.words(0.85)).toBe('Slower, 0.85 times');
    expect(pitch?.words(1.05)).toBe('Higher, 1.05 times');
  });
});

describe('the help line', () => {
  it("names the iPhone's Spoken Content voices in the phone's language", () => {
    expect(helpLine('ios', 'en-GB')).toBe(
      'For a more natural voice, download a Premium voice: iPhone Settings → Accessibility → Spoken Content → Voices → English.',
    );
    expect(helpLine('ios', 'fr-FR')).toMatch(/Voices → French\.$/);
  });

  it("names Google's voice data on Android", () => {
    expect(helpLine('android', 'en-US')).toMatch(
      /Speech Services by Google.*Install voice data → English\.$/,
    );
  });

  it('opens nothing: no settings URL in the copy', () => {
    const lines = [helpLine('ios', 'en-GB'), helpLine('android', 'en-GB')];
    for (const line of lines) expect(line).not.toMatch(/:\/\/|prefs:|App-Prefs|intent:/i);
  });

  it('keeps the sample line in the copy', () => {
    expect(VOICE_SETTINGS_COPY.sample).toBe(
      "Hi, I'm Auto. This is how I'll sound when I answer you.",
    );
  });
});

describe('the sample line', () => {
  const LINE = VOICE_SETTINGS_COPY.sample;

  function spySpeaker(
    voiceFor = vi.fn(async (_locale: string, saved?: string | null) => saved ?? MALCOLM),
  ) {
    const log: string[] = [];
    const spoken: { text: string; options: SpeakOptions }[] = [];
    const speaker = {
      voiceFor,
      speak: vi.fn((text: string, options: SpeakOptions) => {
        log.push('speak');
        spoken.push({ text, options });
      }),
      stop: vi.fn(() => {
        log.push('stop');
      }),
    };
    return { speaker, log, spoken };
  }

  it("speaks in the setting's voice at its speed and pitch, cutting off a sample still speaking", async () => {
    const { speaker, log, spoken } = spySpeaker();
    const player = createSamplePlayer(speaker, LINE);
    const setting: VoiceSetting = { voice: DANIEL, rate: 1.1, pitch: 0.85 };
    await player.play('en-GB', setting);
    expect(speaker.voiceFor).toHaveBeenCalledWith('en-GB', DANIEL);
    expect(log).toEqual(['stop', 'speak']);
    expect(spoken).toEqual([
      { text: LINE, options: { language: 'en-GB', voice: DANIEL, rate: 1.1, pitch: 0.85 } },
    ]);
  });

  it("speaks Automatic in pickVoice's voice (the speaker resolves null)", async () => {
    const { speaker, spoken } = spySpeaker();
    await createSamplePlayer(speaker, LINE).play('en-GB', DEFAULT_VOICE_SETTING);
    expect(speaker.voiceFor).toHaveBeenCalledWith('en-GB', null);
    expect(spoken[0]?.options).toEqual({ language: 'en-GB', voice: MALCOLM, rate: 1, pitch: 1 });
  });

  it('plays again on each tap; only the latest of two quick taps speaks', async () => {
    const { speaker, spoken } = spySpeaker();
    const player = createSamplePlayer(speaker, LINE);
    const first = player.play('en-GB', { ...DEFAULT_VOICE_SETTING, voice: DANIEL });
    const second = player.play('en-GB', { ...DEFAULT_VOICE_SETTING, voice: MALCOLM });
    await Promise.all([first, second]);
    expect(spoken.map(({ options }) => options.voice)).toEqual([MALCOLM]);
    await player.play('en-GB', { ...DEFAULT_VOICE_SETTING, voice: MALCOLM });
    expect(spoken).toHaveLength(2);
  });

  it('speaks nothing once stopped (the screen went away), and stops the speaker', async () => {
    const { speaker, spoken } = spySpeaker();
    const player = createSamplePlayer(speaker, LINE);
    const playing = player.play('en-GB', DEFAULT_VOICE_SETTING);
    player.stop();
    await playing;
    expect(spoken).toEqual([]);
    expect(speaker.stop).toHaveBeenCalledTimes(1);
  });

  it("speaks in the engine's default voice when the voice cannot be found, logged", async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { speaker, spoken } = spySpeaker(vi.fn(async () => Promise.reject(new Error('no list'))));
    await createSamplePlayer(speaker, LINE).play('en-GB', DEFAULT_VOICE_SETTING);
    expect(spoken[0]?.options).toEqual({ language: 'en-GB', rate: 1, pitch: 1 });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
