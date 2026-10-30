// What Auto's stage shows in Candy (PRD-001 §4.6.2, D-CAN-5, D-A11Y): the state he is drawn in, the
// state pill's glyph and word ('● Listening'), and the caption VoiceOver hears in his name. A port of
// the design kit's themes/candy/src/chat/stage-state.ts at 3920359d5 (sha256
// e99bf57fd714de4ba7d4f82c99a8b648f710cd00585f4fc4ab10e996c8d060e5). The home's turn sets it (the
// vendored reducer's state, home.mascot as Play's and Arcade's homes feed it), unless A6's quick-ask
// is under way; then the voice does, as the kit's voice row says:
//
//   opening the mic (a press, before the capture opens)   loading
//   the mic open                                           listening
//   waiting for the reply                                  thinking
//   speaking                                               idle, said 'Speaking'
//   a failure                                              oops
//
// The kit reads the host's voice phase; the phone reads the voice's one state (KV8: voice-state.ts
// phase, and micOpen, the capture's truth). Pure: no React, React Native, Expo or Skia.

import { captionFor } from '../../../core/frozen/lib/mascot/media';
import type { MascotName } from '../../../core/frozen/lib/mascot/types';
import type { VoiceState } from '../../../voice/machine/voice-state';
import { CANDY_AUTO_COPY } from '../strings';
import { stateGlyph, stateWord } from './state-words';

export type Stage = {
  readonly state: MascotName;
  readonly glyph: string;
  readonly word: string;
  readonly caption: string;
};

/** What the stage reads of the voice: its phase and whether the capture is open. */
export type StageVoice = Pick<VoiceState, 'phase' | 'micOpen'>;

/** The kit's host voice phases, which the stage's rows are written against. */
export type StageVoicePhase =
  'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

const VOICE_STATES: Partial<Readonly<Record<StageVoicePhase, MascotName>>> = Object.freeze({
  connecting: 'loading',
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'idle',
  error: 'oops',
});

/** The kit's: a filled dot while he is on it. */
const SPEAKING_GLYPH = '●';

/** The voice's phase as the kit names it; no voice on this screen is idle. */
export function stageVoicePhase(voice: StageVoice | null): StageVoicePhase {
  if (!voice) return 'idle';
  if (voice.phase === 'error') return 'error';
  if (voice.micOpen) return 'listening';
  if (voice.phase === 'listening') return 'connecting';
  return voice.phase;
}

function stageIn(state: MascotName): Stage {
  return Object.freeze({
    state,
    glyph: stateGlyph(state),
    word: stateWord(state),
    caption: captionFor(state),
  });
}

/** The stage for the turn's state, unless the voice is under way. */
export function stageOf(turn: MascotName, voice: StageVoice | null): Stage {
  const phase = stageVoicePhase(voice);
  if (phase === 'speaking') {
    const { speaking } = CANDY_AUTO_COPY;
    return Object.freeze({
      state: 'idle',
      glyph: SPEAKING_GLYPH,
      word: speaking,
      caption: speaking,
    });
  }
  return stageIn(VOICE_STATES[phase] ?? turn);
}

/** Auto's one name on the stage: 'Auto, Working on it'. */
export function stageLabel(stage: Pick<Stage, 'caption'>): string {
  return CANDY_AUTO_COPY.name(stage.caption);
}
