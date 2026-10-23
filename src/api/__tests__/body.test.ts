import { describe, expect, it } from 'vitest';

import { decodeChunks } from '../body';

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
