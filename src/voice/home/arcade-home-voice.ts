// Quick-ask on Arcade's home (US-022g, D-ARC-6), pure: what the voice surround and the dialogue's
// STOP show of the voice when hold to talk works in place. HUD's home's rules, reused from its pure
// sibling (hud-home-voice.ts) and the voice screen's props (core-props.ts), so the press, the
// caption and STOP are HUD's: the talk button's words, state and hold; the caption (the voice's
// state words) and the line under the surround while the voice works or, after a press, has a line
// to say, but a viewer's and 'See it in the chat' (Arcade's conversation is this same screen);
// STOP on while the voice works or a typed turn streams. Arcade has no transcript turn of its own
// (its dialogue window says the thread's newest reply) and no waveform. Every word still comes from
// the one reducer through voiceView (KV8). No React, React Native or Expo.

import type { ChipView, HudTalk } from '../../styles/hud/core/model';
import type { VoiceState } from '../machine/voice-state';
import { talkProps, voiceChip, type HoldHandlers, type VoiceLine } from '../screen/core-props';
import type { VoiceView } from '../screen/voice-view-model';
import { homeLine, voiceWorks, type HomeShows } from './hud-home-voice';

export type ArcadeHomeVoiceInput = {
  readonly view: VoiceView;
  readonly state: VoiceState;
  /** Whose turn is the newest: the voice's from a press, the thread's from a typed send. */
  readonly shows: HomeShows;
  /** A turn streams on the thread (A2's canStop): STOP stops a typed one as well. */
  readonly threadStreams: boolean;
  readonly hold: HoldHandlers;
};

export type ArcadeVoiceShows = {
  /** The recognizer's capture (KV5). */
  readonly micOpen: boolean;
  readonly talk: HudTalk;
  readonly stopEnabled: boolean;
  /** The voice's state words under the surround; null while Auto's portrait word stands. */
  readonly caption: ChipView | null;
  readonly line: VoiceLine | null;
};

export function arcadeHomeVoice(input: ArcadeHomeVoiceInput): ArcadeVoiceShows {
  const { view, state, shows } = input;
  const line = homeLine(view);
  const speaks = voiceWorks(state) || (shows === 'voice' && line !== null);
  return Object.freeze({
    micOpen: view.mic === 'live',
    talk: talkProps(view, state.phase, input.hold),
    stopEnabled: view.stop.enabled || input.threadStreams,
    caption: speaks ? voiceChip(view) : null,
    line: speaks ? line : null,
  });
}
