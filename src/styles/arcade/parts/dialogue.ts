// The dialogue window's view, pure (README 'Pages' and 'Motion'; the design kit's chat/dialogue.tsx
// at 034fa629c, sha256 4b10490d72acc7f6ae5c8044c1ddece22de237021ee3b65ce2db688cc211fe6a): Auto's
// portrait with his state in words, and his newest reply typing out with the ▼ cursor (the
// design's dialogue cursor; README 'Motion' blinks ▶ and ▼ alike) and Skip while it types. The
// cursor blinks every CURSOR_TICKS once the line is whole and stays on while it types or while
// Arcade is still; thinking shows '…' and no cursor. The typed line is hidden from VoiceOver while it
// types; once whole it is ordinary text, and the finished reply is said once, unless it was already
// there when the chat opened. Pure: no React, React Native, Expo or Skia.

import type { MascotName } from '../../../core/frozen/lib/mascot/types';
import { stateWord } from '../sprite/states';
import { ARCADE_COPY } from '../../strings';

/** The newest reply the dialogue window types (the home's plain words of it). */
export type DialogueReply = {
  /** The message's id; a new id types again (null before any reply). */
  readonly id: string | null;
  readonly text: string;
  /** The reply is still being written. */
  readonly streaming: boolean;
  /** It was already there when the chat opened: shown whole and not said again. */
  readonly whole: boolean;
};

/** What the typewriter says of the reply now (use-typewriter.ts). */
export type TypedState = {
  readonly shown: number;
  readonly done: boolean;
  readonly typing: boolean;
};

export type DialogueView = {
  /** The words on screen: the typed part of the reply, or '…' while Auto thinks. */
  readonly words: string;
  /** What VoiceOver reads of the line: the whole reply once it is whole, nothing while it types. */
  readonly label: string | undefined;
  /** The line is hidden from VoiceOver (while it types). */
  readonly hidden: boolean;
  /** The ▼ cursor shows (not while thinking). */
  readonly cursor: boolean;
  /** The cursor blinks on the clock (Arcade moves and the line is whole). */
  readonly blinking: boolean;
  /** Skip shows. */
  readonly skip: boolean;
  /** The finished reply is said once. */
  readonly announce: boolean;
};

export function dialogueView(
  reply: DialogueReply,
  typed: TypedState,
  thinking: boolean,
  moving: boolean,
): DialogueView {
  if (thinking) {
    return Object.freeze({
      words: ARCADE_COPY.dialogue.thinking,
      label: ARCADE_COPY.dialogue.thinkingLabel,
      hidden: false,
      cursor: false,
      blinking: false,
      skip: false,
      announce: false,
    });
  }
  return Object.freeze({
    words: reply.text.slice(0, typed.shown),
    label: typed.typing ? undefined : reply.text,
    hidden: typed.typing,
    cursor: true,
    blinking: moving && !typed.typing,
    skip: typed.typing,
    announce: typed.done && !reply.whole && reply.id !== null && reply.text.length > 0,
  });
}

/** The state word under the portrait, and what VoiceOver hears of it ('Auto: thinking'). */
export function portraitWords(state: MascotName): {
  readonly word: string;
  readonly label: string;
} {
  const word = stateWord(state);
  return Object.freeze({ word, label: ARCADE_COPY.dialogue.stateLabel(word) });
}
