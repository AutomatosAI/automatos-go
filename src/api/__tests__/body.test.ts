import { describe, expect, it } from 'vitest';

import {
  BodyStalledError,
  BodyTooLargeError,
  MAX_EMPTY_READS,
  decodeChunks,
  readBytes,
} from '../body';

function bytes(parts: readonly Uint8Array[], onCancel?: () => void): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const part = parts[index];
      index += 1;
      if (part === undefined) controller.close();
      else controller.enqueue(part);
    },
    cancel: onCancel,
  });
}

async function all(iterable: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of iterable) out.push(chunk);
  return out;
}

describe('decodeChunks', () => {
  it('decodes a character whose bytes are split across reads', async () => {
    const encoded = new TextEncoder().encode('0:"café ✓"\n');
    const cut = encoded.indexOf(0xc3) + 1; // inside the two bytes of é
    const chunks = await all(decodeChunks(bytes([encoded.slice(0, cut), encoded.slice(cut)])));
    expect(chunks.join('')).toBe('0:"café ✓"\n');
    expect(chunks[0]).toBe('0:"caf');
  });

  it('yields nothing for a null body or empty reads', async () => {
    expect(await all(decodeChunks(null))).toEqual([]);
    expect(await all(decodeChunks(bytes([new Uint8Array(0)])))).toEqual([]);
  });

  it('cancels the read when the loop ends early', async () => {
    let cancelled = false;
    const encoder = new TextEncoder();
    const body = bytes([encoder.encode('a'), encoder.encode('b'), encoder.encode('c')], () => {
      cancelled = true;
    });
    for await (const chunk of decodeChunks(body)) {
      expect(chunk).toBe('a');
      break;
    }
    expect(cancelled).toBe(true);
  });

  it('surfaces a failing read', async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('connection reset'));
      },
    });
    await expect(all(decodeChunks(body))).rejects.toThrow('connection reset');
  });
});

describe('readBytes', () => {
  it('joins the reads into one body', async () => {
    const body = bytes([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array(0)]);
    expect([...(await readBytes(body, 3))]).toEqual([1, 2, 3]);
  });

  it('answers no bytes for no body', async () => {
    expect(await readBytes(null, 10)).toEqual(new Uint8Array(0));
  });

  it('refuses a Content-Length over the cap before reading a byte', async () => {
    let pulled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          pulled = true;
        },
      },
      { highWaterMark: 0 },
    );
    await expect(readBytes(body, 10, '11')).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(pulled).toBe(false);
  });

  it('cancels at the read that crosses the cap, reading no further', async () => {
    let cancelled = false;
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads += 1;
        controller.enqueue(new Uint8Array(6));
      },
      cancel: () => {
        cancelled = true;
      },
    });
    const error = await readBytes(body, 10, null).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BodyTooLargeError);
    expect(String(error)).toContain('over 10 bytes');
    expect(cancelled).toBe(true);
    expect(reads).toBeLessThanOrEqual(3);
  });

  it('ignores a Content-Length that is not a number', async () => {
    expect([...(await readBytes(bytes([new Uint8Array([7])]), 1, 'chunked'))]).toEqual([7]);
  });
});

describe('readBytes against a body sent badly', () => {
  /** A body that arrives as these parts, one per read. */
  function partsOf(parts: readonly Uint8Array[]): ReadableStream<Uint8Array> {
    let next = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        const part = parts[next];
        next += 1;
        if (part === undefined) controller.close();
        else controller.enqueue(part);
      },
    });
  }
  const ONE = new Uint8Array([120]);
  const NONE = new Uint8Array(0);

  it('reads a body sent a byte at a time whole, in order', async () => {
    const SIZE = 20_000;
    const sent = Array.from({ length: SIZE }, (_, at) => new Uint8Array([at % 251]));
    const bytes = await readBytes(partsOf(sent), SIZE);
    expect(bytes.byteLength).toBe(SIZE);
    expect(bytes[0]).toBe(0);
    expect(bytes[SIZE - 1]).toBe((SIZE - 1) % 251);
  });

  it('still refuses a byte-at-a-time body at the read that crosses the cap', async () => {
    const sent = Array.from({ length: 50 }, () => ONE);
    await expect(readBytes(partsOf(sent), 10)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it('gives up on a body that only ever sends empty reads', async () => {
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(NONE);
      },
    });
    await expect(readBytes(endless, 1024)).rejects.toBeInstanceOf(BodyStalledError);
  });

  it('cancels a body it refuses by its Content-Length, so nothing more of it is taken in', async () => {
    let cancelled = false;
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled += 1;
          controller.enqueue(ONE);
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    await expect(readBytes(body, 10, '11')).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(cancelled).toBe(true);
    expect(pulled).toBe(0);
  });

  it('a refused Content-Length with no body at all is still refused', async () => {
    await expect(readBytes(null, 10, '11')).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it('counts empty reads in a row only: a real byte between them starts the count again', async () => {
    const run = Array.from({ length: MAX_EMPTY_READS - 1 }, () => NONE);
    const bytes = await readBytes(partsOf([...run, ONE, ...run, ONE]), 1024);
    expect(Array.from(bytes)).toEqual([120, 120]);
  });
});

describe('readBytes when a read fails', () => {
  /** A reader whose second read rejects, recording what readBytes does with it. */
  function failingBody() {
    const seen = { cancelled: false, released: false, reads: 0 };
    const reader = {
      read: async () => {
        seen.reads += 1;
        if (seen.reads === 1) return { done: false, value: new Uint8Array([1]) };
        throw new Error('connection reset');
      },
      cancel: async () => {
        seen.cancelled = true;
      },
      releaseLock: () => {
        seen.released = true;
      },
    };
    const body = { getReader: () => reader } as unknown as ReadableStream<Uint8Array>;
    return { body, seen };
  }

  it('cancels the body and releases its lock, then surfaces the failure', async () => {
    const { body, seen } = failingBody();
    await expect(readBytes(body, 1024)).rejects.toThrow('connection reset');
    expect(seen).toEqual({ cancelled: true, released: true, reads: 2 });
  });

  it('releases the lock after a whole read too, so the stream is not left locked', async () => {
    const body = bytes([new Uint8Array([1, 2])]);
    await readBytes(body, 10);
    expect(body.locked).toBe(false);
  });

  it('cancels and releases a body it refuses at the cap', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(8));
      },
      cancel: () => {
        cancelled = true;
      },
    });
    await expect(readBytes(body, 10)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
  });
});
