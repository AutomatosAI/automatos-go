// Quick-ask on Candy's home (US-023g, D-CAN-6), pure: what the tab bar's raised hold to talk and the
// voice window over it show of the voice when hold to talk works in place. Arcade's rules
// (arcade-home-voice.ts, HUD's home's before it, hud-home-voice.ts), so the press, the caption and
// Stop are theirs: the talk button's words, state and hold; the caption (the voice's state words, in
// Candy's sentence case: voiceView's chipLabel, 'Listening') and the line while the voice works or,
// after a press, has a line to say; Stop on while the voice works or a typed turn streams. One rule
// is Candy's: 'See it in the chat' stays, because Candy's conversation is the Chat view, a tap away
// (its button opens that view), where HUD's and Arcade's is the same screen. A viewer's line never
// shows: a viewer gets no voice here at all (voiceEntry's rule, roleCan 'chat'). Every word still
// comes from the one reducer through voiceView (KV8). No React, React Native or Expo.

import type { ChipView, HudTalk } from '../../styles/hud/core/model';
import type { VoiceState } from '../machine/voice-state';
import { talkProps, voiceLine, type HoldHandlers, type VoiceLine } from '../screen/core-props';
import type { MessageKind, VoiceView } from '../screen/voice-view-model';
import { voiceWorks, type HomeShows } from './hud-home-voice';

export type CandyHomeVoiceInput = {
  readonly view: VoiceView;
  readonly state: VoiceState;
  /** Whose turn is the newest: the voice's from a press, the thread's from a typed send. */
  readonly shows: HomeShows;
  /** A turn streams on the thread (A2's canStop): Stop stops a typed one as well. */
  readonly threadStreams: boolean;
  readonly hold: HoldHandlers;
};

export type CandyVoiceShows = {
  /** The recognizer's capture (KV5). */
  readonly micOpen: boolean;
  readonly talk: HudTalk;
  readonly stopEnabled: boolean;
  /** The voice's state words for the window; null while the voice is quiet. */
  readonly caption: ChipView | null;
  readonly line: VoiceLine | null;
};

/** The view-model's lines with no place on Candy's home: a viewer's (a viewer has no voice here). */
const NOT_HERE: ReadonlySet<MessageKind> = new Set<MessageKind>(['viewer']);

/** The line under the caption: the view-model's, 'See it in the chat' included, but a viewer's. */
export function candyHomeLine(view: VoiceView): VoiceLine | null {
  const { message } = view;
  return message === null || NOT_HERE.has(message.kind) ? null : voiceLine(message);
}

/** The voice's state words as Candy writes them: voiceView's chipLabel ('Listening'). */
export function candyCaption(view: VoiceView): ChipView {
  return Object.freeze({ text: view.chipLabel, label: view.chipLabel });
}

export function candyHomeVoice(input: CandyHomeVoiceInput): CandyVoiceShows {
  const { view, state, shows } = input;
  const line = candyHomeLine(view);
  const speaks = voiceWorks(state) || (shows === 'voice' && line !== null);
  return Object.freeze({
    micOpen: view.mic === 'live',
    talk: talkProps(view, state.phase, input.hold),
    stopEnabled: view.stop.enabled || input.threadStreams,
    caption: speaks ? candyCaption(view) : null,
    line: speaks ? line : null,
  });
}
