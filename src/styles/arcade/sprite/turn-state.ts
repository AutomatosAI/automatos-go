// The portrait's state from the home's turn (PRD-001 §4.6.1, D-ARC-5; the design's README "Portrait
// state follows the turn", and its note to map the host's turn events in the real build), pure:
//
//   listening   while the person types (the composer's focus: typingEvent), or a card waits on them
//   thinking    while waiting for the reply (a send, until its words or a tool)
//   working     on a tool
//   searching   on a web search (the vendored tools.ts: web and marketplace tools)
//   reading     on documents (the vendored tools.ts: document, knowledge and memory lookups)
//   celebrate   when a Deliverable lands (or a done receipt at the turn's end)
//   oops        on an error
//   idle        otherwise
//
// Every rule is the vendored reducer's (core/frozen/lib/mascot/reducer.ts, the web's), fed by the
// home exactly as Play's and HUD's are (use-home-thread.ts: the frames, the status, the cards and
// the Deliverables); this module never decides a state itself. What a sprite changes: there is no
// clip, so the portrait shows the reducer's target at once (no clip boundary to wait for), and a
// one-shot (hello, celebrate) ends after ONE_SHOT_MS (the kit's chat/use-auto.ts), when the home
// sends oneShotEnded. Pure: no React, React Native, Expo or Skia.

import {
  ONE_SHOTS,
  type MascotEvent,
  type MascotName,
  type MascotState,
} from '../../../core/frozen/lib/mascot/types';

/** How long a one-shot plays: a few loops of its frames (the kit's ONE_SHOT_MS). */
export const ONE_SHOT_MS = 2400;

const TYPING: MascotEvent = Object.freeze({ type: 'input-focus' });
const NOT_TYPING: MascotEvent = Object.freeze({ type: 'input-blur' });

/** The portrait's state: what the vendored reducer says Auto shows now. */
export function portraitState(mascot: Pick<MascotState, 'mascot'>): MascotName {
  return mascot.mascot;
}

/** The person started (true) or stopped (false) typing: the reducer's composer focus. */
export function typingEvent(typing: boolean): MascotEvent {
  return typing ? TYPING : NOT_TYPING;
}

/** When a state shown now should end by itself: ONE_SHOT_MS for a one-shot, null for a loop. */
export function oneShotEndMs(state: MascotName): number | null {
  return ONE_SHOTS.has(state) ? ONE_SHOT_MS : null;
}

/** The event that ends a one-shot, as a clip's end would (a stale one changes nothing). */
export function oneShotEnded(state: MascotName): MascotEvent {
  return { type: 'clip-ended', state };
}
