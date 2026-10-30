// The dialogue window's typing (PRD-001 §4.6.1; the design's README 'Motion': "dialogue text types
// 1 char per tick on Normal, or 1 char per 3 ticks on Slow. Instant shows it whole"), as functions
// of Arcade's 60 ms tick count (sprite/clock.ts). Auto's replies can run to pages, so a long reply
// types faster, finishing within TYPE_CAP_TICKS on Normal (about 15 s) and twice that on Slow. The
// whole reply shows at once on Instant, under Reduce Motion, while the pause control holds Arcade
// still (WCAG 2.2.2), for a reply that was already there (`whole`) and after Skip. Typing follows a
// reply as it streams in and never goes back; a new reply that goes on from the words already shown
// (a voice reply replaced by its saved copy) keeps them, so the same words never type twice.
// Pure: no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/arcade/src/chat/typewriter.ts at 034fa629c
// (sha256 4a1350eef14f5722c56ae4593c582f1653055009b32597d87dbe07ce340762f2): the rates and the
// cap, typedAfter and carriedOver ported; its useTypewriter hook's state is typingStart and
// typingAt here, the hook itself use-typewriter.ts.

import type { ArcadeTextSpeed } from './look-schema';

/** Ticks per character at each text speed (0: the whole line at once). */
export const TICKS_PER_CHAR: Readonly<Record<ArcadeTextSpeed, number>> = Object.freeze({
  instant: 0,
  normal: 1,
  slow: 3,
});

/** A long reply finishes typing within this many ticks (0: at once). */
export const TYPE_CAP_TICKS: Readonly<Record<ArcadeTextSpeed, number>> = Object.freeze({
  instant: 0,
  normal: 250,
  slow: 500,
});

/** Characters shown per tick for a reply of `length` (Infinity on Instant: all of it at once). */
export function charsPerTick(length: number, speed: ArcadeTextSpeed): number {
  if (speed === 'instant') return Number.POSITIVE_INFINITY;
  return Math.max(1 / TICKS_PER_CHAR[speed], length / TYPE_CAP_TICKS[speed]);
}

/** Characters shown after `ticks` ticks of typing a reply of `length` at `speed`. */
export function typedAfter(ticks: number, length: number, speed: ArcadeTextSpeed): number {
  if (speed === 'instant') return length;
  return Math.min(length, Math.floor(Math.max(0, ticks) * charsPerTick(length, speed)));
}

/** Where typing one reply began: its id, the tick it started on, what shows and its text. */
export type TypingStart = {
  readonly id: string | null;
  readonly tick: number;
  readonly shown: number;
  readonly text: string;
};

/** Before any reply. */
export const NO_TYPING: TypingStart = Object.freeze({ id: null, tick: 0, shown: 0, text: '' });

/** What a new reply keeps of the one before: everything shown, when it goes on from those words. */
export function carriedOver(previous: Pick<TypingStart, 'shown' | 'text'>, text: string): number {
  const said = previous.text.slice(0, previous.shown);
  return said.length > 0 && text.startsWith(said) ? said.length : 0;
}

/** The same reply goes on from where it is; a new one starts at `now`, ahead by what it keeps. */
export function typingStart(
  previous: TypingStart,
  id: string | null,
  text: string,
  speed: ArcadeTextSpeed,
  now: number,
): TypingStart {
  if (previous.id === id) return previous;
  const kept = carriedOver(previous, text);
  return Object.freeze({ id, tick: now - kept * TICKS_PER_CHAR[speed], shown: kept, text });
}

export type TypingInput = {
  readonly text: string;
  readonly speed: ArcadeTextSpeed;
  /** Arcade moves: no Reduce Motion and not paused (use-arcade-motion.ts). */
  readonly moving: boolean;
  /** The reply is still being written. */
  readonly streaming: boolean;
  /** Show it whole from the start (it was there when the chat opened). */
  readonly whole: boolean;
  /** Skip was pressed for this reply. */
  readonly skipped: boolean;
};

export type TypingFrame = {
  /** How many characters show. */
  readonly shown: number;
  /** Every character shows and no more is coming. */
  readonly done: boolean;
  /** Characters are still to come on screen. */
  readonly typing: boolean;
  /** Typing needs the clock: it moves and has characters still to show. */
  readonly behind: boolean;
};

/** The whole reply at once: Instant, Reduce Motion, the pause, a reply already there, or Skip. */
export function typesInstantly(input: TypingInput): boolean {
  return !input.moving || input.speed === 'instant' || input.whole || input.skipped;
}

/** What shows at tick `now` of typing from `start`: never less than already shown. */
export function typingAt(start: TypingStart, input: TypingInput, now: number): TypingFrame {
  const { length } = input.text;
  const instant = typesInstantly(input);
  const typed = instant ? length : typedAfter(now - start.tick, length, input.speed);
  const shown = Math.min(length, Math.max(start.shown, typed));
  const typing = shown < length;
  return Object.freeze({
    shown,
    done: !input.streaming && !typing,
    typing,
    behind: typing && !instant,
  });
}

/** The start with what shows now recorded, so a later frame never shows less. */
export function withShown(start: TypingStart, frame: TypingFrame, text: string): TypingStart {
  if (start.shown === frame.shown && start.text === text) return start;
  return Object.freeze({ ...start, shown: frame.shown, text });
}
