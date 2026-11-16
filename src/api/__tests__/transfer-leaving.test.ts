// The transfer module when the person leaves (stopDownloads, called by user-files.ts before the
// folders go), over the fake transport and expo-file-system in memory: a download stopped places
// nothing, whenever its body ends; a new ask right after the stop waits for the stopped run to
// settle, so the two never share a partial file; and a later ask starts afresh.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { memoryFs, textOf } from './fake-file-system';
import { SERVER, partsReply, reply, type FakeResponse } from './fake-transport';
import {
  FILE_URL,
  TARGET_URI,
  TIMED,
  answering,
  clientWith,
  encode,
  nothingLeft,
  target,
} from './transfer-harness';

vi.mock('expo-file-system', async () => (await import('./fake-file-system')).fakeExpoFileSystem);

const { download, partialOf, stopDownloads } = await import('../transfer');

beforeEach(() => memoryFs.reset());

describe('a download running when the person leaves', () => {
  /** A body that sends its parts, then holds its end until released, deaf to any abort. */
  function heldOpen(parts: readonly string[]) {
    const gate: { release: () => void } = { release: () => undefined };
    const held = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    const answer = (): FakeResponse => ({
      ...reply(200),
      parts: async function* () {
        for (const part of parts) yield encode(part);
        await held;
      },
    });
    return { gate, answer };
  }

  it('places nothing, even when its body ends after the clear, and a later ask starts afresh', async () => {
    const { gate, answer } = heldOpen(['%PDF-whole']);
    const transport = answering(answer, () => partsReply(200, [encode('%PDF-next')]));
    const client = clientWith(transport);
    const running = download(client, FILE_URL, target(), TIMED);
    await vi.waitFor(() =>
      expect(memoryFs.files.get(partialOf(target()).uri)?.byteLength).toBe(10),
    );
    stopDownloads();
    memoryFs.files.clear(); // the folders are deleted (user-files.ts)
    gate.release();
    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
    expect(memoryFs.files.size).toBe(0);
    nothingLeft();
    await download(client, FILE_URL, target(), TIMED);
    expect(textOf(TARGET_URI)).toBe('%PDF-next');
    expect(transport.calls).toHaveLength(2);
  });

  it('a body still sending when the person leaves stops at its next part', async () => {
    const gate: { release: () => void } = { release: () => undefined };
    const held = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    const transport = answering(() => ({
      ...reply(200),
      parts: async function* () {
        yield encode('one');
        await held;
        yield encode('two');
      },
    }));
    const running = download(clientWith(transport), FILE_URL, target(), TIMED);
    await vi.waitFor(() => expect(memoryFs.files.get(partialOf(target()).uri)?.byteLength).toBe(3));
    stopDownloads();
    gate.release();
    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
    expect(memoryFs.files.size).toBe(0);
    expect(transport.calls[0]?.signal.aborted).toBe(true);
  });

  it('a new ask right after a stop waits for the stopped run, which never deletes its partial', async () => {
    const gate: { release: () => void } = { release: () => undefined };
    const held = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    const transport = answering(
      () => ({
        ...reply(200),
        parts: async function* () {
          yield encode('old');
          await held; // deaf to the abort, as a slow native read can be
        },
      }),
      () => partsReply(200, [encode('%PDF-new')]),
    );
    const client = clientWith(transport);
    const stopped = download(client, FILE_URL, target(), TIMED);
    await vi.waitFor(() => expect(memoryFs.files.get(partialOf(target()).uri)?.byteLength).toBe(3));
    stopDownloads();
    const fresh = download(client, FILE_URL, target(), TIMED);
    expect(fresh).not.toBe(stopped);
    expect(transport.calls).toHaveLength(1); // the new one has not started under the old one
    gate.release();
    await expect(stopped).rejects.toMatchObject({ name: 'AbortError' });
    await fresh;
    expect(textOf(TARGET_URI)).toBe('%PDF-new');
    expect(transport.calls).toHaveLength(2);
    nothingLeft();
  });

  it('an ask waiting its turn when the person leaves creates nothing', async () => {
    const { gate, answer } = heldOpen(['first']);
    const other = `${SERVER.apiUrl}/api/workspaces/w/files/raw?path=q3.pdf`;
    const transport = answering(answer);
    const client = clientWith(transport);
    const first = download(client, FILE_URL, target(), TIMED);
    const waiting = download(client, other, target(), TIMED);
    await vi.waitFor(() => expect(transport.calls).toHaveLength(1));
    stopDownloads();
    gate.release();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    expect(transport.calls).toHaveLength(1);
    expect(memoryFs.files.size).toBe(0);
  });
});
