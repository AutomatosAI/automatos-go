// The part of a stream still held, until its line or event ends (stream.ts's lines, sse.ts's
// events). It is kept as the chunks that came, joined only when a chunk may complete a separator,
// and its length is counted as it grows: a megabyte line arriving in tiny chunks costs its length
// once, never its square. A held part over STREAM_LINE_MAX_CHARS ends the stream as 'stream'
// (stream-limits.ts lineTooLong), and the reader is cancelled behind it.

import { STREAM_LINE_MAX_CHARS } from './config';
import { lineTooLong } from './stream-limits';

export type HeldText = {
  /**
   * The held text joined with `chunk` when the two may hold a whole separator, for the caller to
   * split (it then keeps the rest); null when the chunk was only held.
   */
  readonly take: (chunk: string) => string | null;
  /** What the caller's split left over: held until the next separator. */
  readonly keep: (rest: string) => void;
  /** Everything held now. */
  readonly text: () => string;
};

export function heldText(separator: string, maxChars = STREAM_LINE_MAX_CHARS): HeldText {
  /** How many of the held text's last characters a separator split across two chunks needs. */
  const reach = separator.length - 1;
  let parts: string[] = [];
  let length = 0;
  let tail = '';
  const hold = (chunk: string) => {
    if (chunk === '') return;
    parts.push(chunk);
    length += chunk.length;
    if (length > maxChars) throw lineTooLong(maxChars);
    if (reach > 0) tail = (tail + chunk).slice(-reach);
  };
  const completes = (chunk: string) =>
    chunk.includes(separator) || (reach > 0 && (tail + chunk.slice(0, reach)).includes(separator));
  return Object.freeze({
    take: (chunk: string) => {
      if (!completes(chunk)) {
        hold(chunk);
        return null;
      }
      const text = parts.join('') + chunk;
      parts = [];
      length = 0;
      tail = '';
      return text;
    },
    keep: hold,
    text: () => parts.join(''),
  });
}
