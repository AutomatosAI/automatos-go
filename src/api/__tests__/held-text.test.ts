// A line or event still coming is held, never read again at every chunk (review of the template's
// copies, 16 Nov): a megabyte line in tiny chunks must cost its length, not its square. Measured
// with the growth helper over the real readers: turnLines (a chat turn) and eventChunks (the live
// events). Before the fix the two grew about 45 and 49 times for 8 times the input.

import { describe, expect, it } from 'vitest';

import type { Frame } from '../../core/ai-sdk-stream';
import { growth, GROWTH_TIMEOUT_MS, LINEAR_GROWTH_LIMIT } from '../../lib/__tests__/growth';
import { heldText } from '../held-text';
import { eventChunks, type ServerEvent } from '../sse';
import { turnLines } from '../stream';

const CHUNK = 16;
const SIZE = 65_536;
const chunksOf = (size: number) => Array.from({ length: size / CHUNK }, () => 'x'.repeat(CHUNK));

describe('a long line in small chunks', () => {
  it(
    "costs a chat turn's reader its length, not its square",
    () => {
      const grew = growth((size) => {
        const chunks = chunksOf(size);
        return () => {
          const lines = turnLines(() => undefined);
          chunks.forEach(lines.push);
          lines.push('\n');
        };
      }, SIZE);
      expect(grew).toBeLessThan(LINEAR_GROWTH_LIMIT);
    },
    GROWTH_TIMEOUT_MS,
  );

  it(
    "costs the live events' reader its length, not its square",
    () => {
      const grew = growth((size) => {
        const chunks = chunksOf(size);
        return () => {
          const push = eventChunks(() => undefined);
          push('data: ');
          chunks.forEach(push);
          push('\n\n');
        };
      }, SIZE);
      expect(grew).toBeLessThan(LINEAR_GROWTH_LIMIT);
    },
    GROWTH_TIMEOUT_MS,
  );
});

describe('what the readers still give', () => {
  it('a turn: every line, one split across chunks and the last one at the end', () => {
    const frames: Frame[] = [];
    const lines = turnLines((frame) => frames.push(frame));
    ['0:"he', 'llo"', '\n0:"a"\n0:', '"b"'].forEach(lines.push);
    lines.end();
    expect(frames).toEqual([
      { kind: 'text', text: 'hello' },
      { kind: 'text', text: 'a' },
      { kind: 'text', text: 'b' },
    ]);
  });

  it('the live events: an event whose blank line is split across two chunks', () => {
    const events: ServerEvent[] = [];
    const push = eventChunks((event) => events.push(event));
    [
      'event: board_changed\n',
      'data: {"a":1}\n',
      '\n',
      'event: chat_changed\ndata: {}\n\n',
    ].forEach(push);
    expect(events).toEqual([
      { event: 'board_changed', data: { a: 1 } },
      { event: 'chat_changed', data: {} },
    ]);
  });

  it('a held part over its cap ends the stream, before any separator comes', () => {
    const held = heldText('\n\n', 8);
    expect(held.take('12345')).toBeNull();
    expect(() => held.take('6789')).toThrow(expect.objectContaining({ kind: 'stream' }));
  });

  it('keeps what a split left, and gives it back with the next separator', () => {
    const held = heldText('\n', 100);
    held.keep('ab');
    expect(held.take('c')).toBeNull();
    expect(held.text()).toBe('abc');
    expect(held.take('d\ne')).toBe('abcd\ne');
    expect(held.text()).toBe('');
  });
});
