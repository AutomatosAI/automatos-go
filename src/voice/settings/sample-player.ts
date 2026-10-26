// Settings → Voice's sample line, spoken through the speaker (speaker-core.ts). Pure over the
// speaker's port: no React, React Native or Expo.
//   play() speaks the line in the setting's voice (the saved one while the phone offers it, else
//   pickVoice's, as quick-ask resolves it) at its rate and pitch, cutting off a sample still
//   speaking. Only the latest play speaks: one tapped while an earlier one was still resolving its
//   voice wins, and stop() (the screen going away) cancels a play that has not spoken yet.

import { logger } from '../../lib/logger';
import type { Speaker } from '../speech/speaker-core';
import { speakOptionsFor, type VoiceSetting } from './voice-setting';

export type SamplePlayer = Readonly<{
  play: (language: string, setting: VoiceSetting) => Promise<void>;
  stop: () => void;
}>;

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
    play: async (language: string, setting: VoiceSetting) => {
      plays += 1;
      const mine = plays;
      const voice = await voiceOf(language, setting);
      if (mine !== plays) return;
      speaker.stop();
      speaker.speak(line, speakOptionsFor(language, voice, setting));
    },
    stop: () => {
      plays += 1;
      speaker.stop();
    },
  });
}
