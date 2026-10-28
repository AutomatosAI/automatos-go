// Settings → Voice's sample line, spoken through the one voice out (reply-voice.ts). Pure over the
// speaker's port: no React, React Native or Expo.
//   play() speaks the line in the setting's voice (the saved one while the phone offers it, else
//   pickVoice's, as quick-ask resolves it) at its rate and pitch, cutting off a sample still
//   speaking. With Auto's server voice (serverSpeechFor, as quick-ask builds it) the line is the
//   server's, and the phone's voice says it when the server cannot: the sample is what a reply
//   would sound like right now. Only the latest play speaks: one tapped while an earlier one was
//   still resolving its voice wins, and stop() (the screen going away) cancels a play that has not
//   spoken yet. The line is in the language it is spoken in: Portuguese (Brazil)'s own
//   (SAMPLE_LINES), else the one given (English).

import { logger } from '../../lib/logger';
import { portugueseFor } from '../language/speak-language';
import type { ServerSpeech } from '../server/server-speaker-ports';
import type { Speaker } from '../speech/speaker-core';
import { SAMPLE_LINES } from '../strings';
import { speakOptionsFor, type VoiceSetting } from './voice-setting';

export type SamplePlayer = Readonly<{
  play: (language: string, setting: VoiceSetting, server?: ServerSpeech) => Promise<void>;
  stop: () => void;
}>;

/** The sample in the language's own words: Portuguese (Brazil)'s for any Portuguese, else `line`. */
export function sampleLine(language: string, line: string): string {
  const portuguese = portugueseFor(language);
  return portuguese === null ? line : SAMPLE_LINES[portuguese];
}

export function createSamplePlayer(
  speaker: Pick<Speaker, 'voiceFor' | 'speak' | 'stop'>,
  line: string,
): SamplePlayer {
  let plays = 0;

  async function voiceOf(language: string, setting: VoiceSetting): Promise<string | undefined> {
    try {
      return await speaker.voiceFor(language, setting.voice);
    } catch (error) {
      logger.warn("[voice] the sample's voice was not found; using the default", error);
      return undefined;
    }
  }

  return Object.freeze({
    play: async (language: string, setting: VoiceSetting, server?: ServerSpeech) => {
      plays += 1;
      const mine = plays;
      const voice = await voiceOf(language, setting);
      if (mine !== plays) return;
      speaker.stop();
      speaker.speak(sampleLine(language, line), speakOptionsFor(language, voice, setting, server));
    },
    stop: () => {
      plays += 1;
      speaker.stop();
    },
  });
}
