// Candy's message box, pure (CANDY-LAYOUT §4 P2 and the 390 mock; the kit's chat/composer.tsx at
// 3920359d5): what the box and its button say over A2's composerState (src/chat/composer/
// composer-state.ts), as Play's composerView reads it, in Candy's words. The pill takes typing
// unless A2 says otherwise (a viewer, a role not yet read); its one round button sends, turns into
// Stop while Auto answers (A2's buttonMode 'stop') and does nothing while there is nothing to send.
// Return inserts a newline: only the button sends (A2's D-COMPOSER). Pure: no React, React Native,
// Expo or Skia.

import type { ComposerState } from '../../../chat/composer/composer-state';
import { CANDY_CHAT_COPY } from '../strings';

/** The P2 mock's measures, in points: the box's place, the pill, its button and the voice beside it. */
export const COMPOSER = Object.freeze({
  /** From the screen's sides, and above the bottom inset. */
  side: 14,
  bottom: 28,
  /** Between the pill and the voice, and above the pill (the files, a viewer's notice). */
  gap: 10,
  pill: 56,
  padLeft: 20,
  padRight: 6,
  send: 44,
  talk: 56,
  /** The placeholder's and the words' size; the field grows to this many lines, then scrolls. */
  size: 15,
  maxLines: 5,
  /** Stop's square, and the arrow's size. */
  square: 12,
  squareRadius: 3,
  icon: 22,
});

export type CandyComposerView = {
  readonly editable: boolean;
  readonly placeholder: string;
  /** 'Send' or 'Stop', with Stop's hint. */
  readonly label: string;
  readonly hint: string | undefined;
  /** Stop draws its square in place of the arrow. */
  readonly stop: boolean;
  readonly disabled: boolean;
};

type ComposerFacts = Pick<ComposerState, 'buttonMode' | 'inputEditable'> & {
  readonly placeholder?: string;
};

export function candyComposerView(state: ComposerFacts): CandyComposerView {
  const said = CANDY_CHAT_COPY.composer;
  const stop = state.buttonMode === 'stop';
  return Object.freeze({
    editable: state.inputEditable,
    placeholder: state.inputEditable ? said.placeholder : (state.placeholder ?? said.placeholder),
    label: stop ? said.stop : said.send,
    hint: stop ? said.stopHint : undefined,
    stop,
    disabled: state.buttonMode === 'disabled',
  });
}
