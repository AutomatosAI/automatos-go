// The dialogue window's typing (typewriter.ts; the design kit's chat/typewriter.ts at 034fa629c):
// the rates per 60 ms tick at each text speed and the cap for long replies, what a new reply carries
// over, the whole reply at once under Reduce Motion, the pause, Instant, a reply already there and
// Skip, typing that follows a stream and never goes back, and the module's purity.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  NO_TYPING,
  TICKS_PER_CHAR,
  TYPE_CAP_TICKS,
  carriedOver,
  charsPerTick,
  typedAfter,
  typesInstantly,
  typingAt,
  typingStart,
  withShown,
  type TypingInput,
} from '../typewriter';

const TEXT = 'Your report is ready. I filed it under Deliverables.';

function input(over: Partial<TypingInput> = {}): TypingInput {
  return {
    text: TEXT,
    speed: 'normal',
    moving: true,
    streaming: false,
    whole: false,
    skipped: false,
    ...over,
  };
}

describe('the rates (README Motion; the kit’s typewriter.ts)', () => {
  it('type one character a tick on Normal, one every three on Slow, all at once on Instant', () => {
    expect(TICKS_PER_CHAR).toEqual({ instant: 0, normal: 1, slow: 3 });
    expect(charsPerTick(40, 'normal')).toBe(1);
    expect(charsPerTick(40, 'slow')).toBeCloseTo(1 / 3);
    expect(charsPerTick(40, 'instant')).toBe(Number.POSITIVE_INFINITY);
  });

  it('finish a long reply within 250 ticks on Normal (about 15 s) and 500 on Slow', () => {
    expect(TYPE_CAP_TICKS).toEqual({ instant: 0, normal: 250, slow: 500 });
    expect(charsPerTick(1000, 'normal')).toBe(4);
    expect(charsPerTick(1000, 'slow')).toBe(2);
    expect(typedAfter(250, 1000, 'normal')).toBe(1000);
    expect(typedAfter(500, 1000, 'slow')).toBe(1000);
    expect(typedAfter(249, 1000, 'normal')).toBeLessThan(1000);
  });

  it('count whole characters, never more than the reply and never fewer than none', () => {
    expect(typedAfter(10, 100, 'normal')).toBe(10);
    expect(typedAfter(9, 100, 'slow')).toBe(3);
    expect(typedAfter(10, 100, 'slow')).toBe(3);
    expect(typedAfter(500, 100, 'normal')).toBe(100);
    expect(typedAfter(-4, 100, 'normal')).toBe(0);
    expect(typedAfter(0, 100, 'instant')).toBe(100);
  });
});

describe('a new reply', () => {
  it('starts at the tick it arrives, showing nothing', () => {
    expect(typingStart(NO_TYPING, 'm1', TEXT, 'normal', 40)).toEqual({
      id: 'm1',
      tick: 40,
      shown: 0,
      text: TEXT,
    });
  });

  it('goes on from where it is while its id holds', () => {
    const start = typingStart(NO_TYPING, 'm1', TEXT, 'normal', 40);
    expect(typingStart(start, 'm1', `${TEXT} More.`, 'normal', 90)).toBe(start);
  });

  it('keeps the words already shown when it goes on from them, so they never type twice', () => {
    const live = { ...typingStart(NO_TYPING, 'live', 'Your report', 'slow', 0), shown: 11 };
    expect(carriedOver(live, TEXT)).toBe(11);
    const saved = typingStart(live, 'saved', TEXT, 'slow', 100);
    expect(saved).toEqual({ id: 'saved', tick: 100 - 11 * 3, shown: 11, text: TEXT });
    expect(typingAt(saved, input({ speed: 'slow' }), 100).shown).toBe(11);
  });

  it('keeps nothing when it says something else, or when nothing showed yet', () => {
    expect(carriedOver({ shown: 4, text: 'Done' }, 'Something else')).toBe(0);
    expect(carriedOver({ shown: 0, text: TEXT }, TEXT)).toBe(0);
  });
});

describe('typing on the clock', () => {
  const start = typingStart(NO_TYPING, 'm1', TEXT, 'normal', 100);

  it('shows what the ticks since its start have typed and listens to the clock while behind', () => {
    const frame = typingAt(start, input(), 110);
    expect(frame).toEqual({ shown: 10, done: false, typing: true, behind: true });
  });

  it('is done once every character shows and stops listening', () => {
    const frame = typingAt(start, input(), 100 + TEXT.length);
    expect(frame).toEqual({ shown: TEXT.length, done: true, typing: false, behind: false });
  });

  it('follows a stream: caught up is not done while more is coming', () => {
    const frame = typingAt(start, input({ text: 'Your', streaming: true }), 150);
    expect(frame).toEqual({ shown: 4, done: false, typing: false, behind: false });
  });

  it('never goes back: a frame shows at least what was shown before', () => {
    const ahead = { ...start, shown: 30 };
    expect(typingAt(ahead, input(), 105).shown).toBe(30);
  });

  it('never shows more than the reply when a reply is replaced by a shorter one', () => {
    const ahead = { ...start, shown: 30 };
    expect(typingAt(ahead, input({ text: 'Done.' }), 105).shown).toBe(5);
  });
});

describe('the whole reply at once', () => {
  const start = typingStart(NO_TYPING, 'm1', TEXT, 'normal', 100);
  const cases: readonly [string, Partial<TypingInput>][] = [
    ['under Reduce Motion or while paused (not moving)', { moving: false }],
    ['on Instant', { speed: 'instant' }],
    ['for a reply that was already there', { whole: true }],
    ['after Skip', { skipped: true }],
  ];

  it.each(cases)('%s', (_name, over) => {
    expect(typesInstantly(input(over))).toBe(true);
    const frame = typingAt(start, input(over), 101);
    expect(frame).toEqual({ shown: TEXT.length, done: true, typing: false, behind: false });
  });

  it('types on Normal and Slow while Arcade moves', () => {
    expect(typesInstantly(input())).toBe(false);
    expect(typesInstantly(input({ speed: 'slow' }))).toBe(false);
  });

  it('stays whole after the pause lifts: the shown count is recorded', () => {
    const paused = typingAt(start, input({ moving: false }), 101);
    const recorded = withShown(start, paused, TEXT);
    expect(typingAt(recorded, input(), 102).shown).toBe(TEXT.length);
  });
});

describe('recording what shows', () => {
  it('keeps the same start when nothing changed and records a new count otherwise', () => {
    const start = typingStart(NO_TYPING, 'm1', TEXT, 'normal', 0);
    const frame = typingAt(start, input(), 0);
    expect(withShown(start, frame, TEXT)).toBe(start);
    const later = typingAt(start, input(), 12);
    expect(withShown(start, later, TEXT)).toEqual({ ...start, shown: 12 });
  });
});

describe('the module (D-SHAPE)', () => {
  it('imports no React, React Native, Expo or Skia and holds no colour', () => {
    const source = readFileSync(path.resolve(__dirname, '..', 'typewriter.ts'), 'utf8');
    expect(source).not.toMatch(
      /from '(react|react-native[^']*|expo[^']*|@shopify\/react-native-skia)'/,
    );
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}\b|rgba?\(/);
  });
});
