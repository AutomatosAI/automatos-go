// The dialogue window's typing in React (typewriter.ts's rules; the kit's chat/typewriter.ts
// useTypewriter): one reply by its id, typed on Arcade's one clock while it moves. The hook listens
// to the clock only while characters are still to show, so a finished, skipped or still line costs
// no tick; Reduce Motion and the pause control (`moving` false) show the reply whole at once.

import { useCallback, useRef, useState } from 'react';

import type { ArcadeTextSpeed } from './look-schema';
import { clockNow } from './sprite/clock';
import { useTicks } from './sprite/use-ticks';
import { NO_TYPING, typingAt, typingStart, withShown, type TypingStart } from './typewriter';

export type TypewriterOptions = {
  readonly speed: ArcadeTextSpeed;
  /** Arcade moves (use-arcade-motion.ts): no Reduce Motion, not paused. */
  readonly moving: boolean;
  /** The reply is still being written. */
  readonly streaming: boolean;
  /** Show it whole from the start (it was there when the chat opened). */
  readonly whole: boolean;
};

export type Typing = {
  /** How many characters show. */
  readonly shown: number;
  /** Every character shows and no more is coming. */
  readonly done: boolean;
  /** Characters are still to come on screen. */
  readonly typing: boolean;
  /** Shows the rest of this reply at once. */
  readonly skip: () => void;
};

/** Typing for one reply (`id`); a new id starts again, but for the words it carries over. */
export function useTypewriter(id: string | null, text: string, options: TypewriterOptions): Typing {
  const start = useRef<TypingStart>(NO_TYPING);
  const [skippedId, setSkippedId] = useState<string | null | undefined>(undefined);
  start.current = typingStart(start.current, id, text, options.speed, clockNow());
  const frame = typingAt(
    start.current,
    { ...options, text, skipped: skippedId === id },
    clockNow(),
  );
  // re-renders on every tick while behind; the frame above reads the clock's tick on each one
  useTicks(1, frame.behind);
  start.current = withShown(start.current, frame, text);
  const skip = useCallback(() => setSkippedId(id), [id]);
  return { shown: frame.shown, done: frame.done, typing: frame.typing, skip };
}
