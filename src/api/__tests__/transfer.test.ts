// The one transfer module (docs/app-standard.md rule 13.2), over the fake transport and
// expo-file-system in memory: a file is fetched through the client (its bearer, its policy, its
// own server only), written a part at a time to a partial file and moved into place only when
// whole; one target is written by one download at a time; a cap exceeded, an abort or a failure
// leaves no partial file and keeps the earlier copy. Redirects: transfer-redirect.test.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { memoryFs, textOf } from './fake-file-system';
import { SERVER, partsReply, reply, type FakeResponse } from './fake-transport';
import {
  FILE_URL,
  TARGET_URI,
  TOKEN,
  answering,
  clientWith,
  encode,
  failureOf,
  nothingLeft,
  target,
} from './transfer-harness';
import type { TransportRequest } from '../transport-types';

vi.mock('expo-file-system', async () => (await import('./fake-file-system')).fakeExpoFileSystem);

const { ASIDE_SUFFIX, PARTIAL_SUFFIX, download, partialOf, stopDownloads } =
  await import('../transfer');

beforeEach(() => memoryFs.reset());

describe('a download', () => {
  it('is fetched through the client, with its bearer, workspace and language, and written whole', async () => {
    const transport = answering(() => partsReply(200, [encode('%PDF-'), encode('1.7')]));
    const file = await download(clientWith(transport), FILE_URL, target());
    expect(file.uri).toBe(TARGET_URI);
    expect(textOf(TARGET_URI)).toBe('%PDF-1.7');
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]).toMatchObject({
      url: FILE_URL,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'X-Workspace-ID': 'ws-1',
        'Accept-Language': 'pt-BR',
      },
    });
    nothingLeft();
  });

  it('is written to a partial file beside the target, moved into place only when whole', async () => {
    const transport = answering(() => partsReply(200, [encode('a'), encode('b')]));
    await download(clientWith(transport), FILE_URL, target());
    const partial = partialOf(target()).uri;
    expect(partial).toBe(`${TARGET_URI}${PARTIAL_SUFFIX}`);
    expect(memoryFs.ops).toEqual([`create ${partial}`, `mv ${partial} -> ${TARGET_URI}`]);
  });

  it('replaces a copy already at the target only once the new one is whole', async () => {
    memoryFs.files.set(TARGET_URI, encode('old'));
    const transport = answering(() => partsReply(200, [encode('new')]));
    await download(clientWith(transport), FILE_URL, target());
    expect(textOf(TARGET_URI)).toBe('new');
    const refused = answering(() => reply(500));
    await failureOf(download(clientWith(refused), FILE_URL, target()));
    expect(textOf(TARGET_URI)).toBe('new');
  });

  it('keeps the earlier copy when the new one cannot be moved in, and leaves nothing aside', async () => {
    memoryFs.files.set(TARGET_URI, encode('old'));
    memoryFs.failMove = (from) => from.endsWith(PARTIAL_SUFFIX);
    const transport = answering(() => partsReply(200, [encode('new')]));
    await expect(download(clientWith(transport), FILE_URL, target())).rejects.toThrow(
      'the move failed',
    );
    expect(textOf(TARGET_URI)).toBe('old');
    expect([...memoryFs.files.keys()]).toEqual([TARGET_URI]);
  });

  it('sets the earlier copy aside, moves the new one in, then deletes the earlier one', async () => {
    memoryFs.files.set(TARGET_URI, encode('old'));
    const transport = answering(() => partsReply(200, [encode('new')]));
    await download(clientWith(transport), FILE_URL, target());
    const partial = partialOf(target()).uri;
    const aside = `${TARGET_URI}${ASIDE_SUFFIX}`;
    expect(memoryFs.ops.slice(1)).toEqual([
      `mv ${TARGET_URI} -> ${aside}`,
      `mv ${partial} -> ${TARGET_URI}`,
      `rm ${aside}`,
    ]);
    expect([...memoryFs.files.keys()]).toEqual([TARGET_URI]);
  });

  it('drops an aside copy an interrupted replace left behind', async () => {
    memoryFs.files.set(`${TARGET_URI}${ASIDE_SUFFIX}`, encode('stale'));
    const transport = answering(() => partsReply(200, [encode('new')]));
    await download(clientWith(transport), FILE_URL, target());
    expect([...memoryFs.files.keys()]).toEqual([TARGET_URI]);
  });

  it("is refused before anything is sent when it is not on the client's own server", async () => {
    const transport = answering(() => partsReply(200, [encode('x')]));
    for (const url of [
      'https://elsewhere.example.test/api/documents/generated/q3.pdf',
      `${SERVER.apiUrl}.evil.example.test/q3.pdf`,
      `${SERVER.apiUrl}/q3 .pdf`,
      '/api/documents/generated/q3.pdf',
    ]) {
      await expect(download(clientWith(transport), url, target())).rejects.toBeInstanceOf(
        TypeError,
      );
    }
    expect(transport.calls).toEqual([]);
    nothingLeft();
  });

  it('a refusal is its kind, and nothing is left behind', async () => {
    const transport = answering(() => reply(404, '{"detail":"File not found"}'));
    const error = await failureOf(download(clientWith(transport), FILE_URL, target()));
    expect(error).toMatchObject({ kind: 'not_found', status: 404 });
    expect(memoryFs.files.size).toBe(0);
    nothingLeft();
  });

  it('a 401 from its own server signs out, as every call does', async () => {
    const onAuthExpired = vi.fn();
    const transport = answering(() => reply(401));
    await failureOf(download(clientWith(transport, { onAuthExpired }), FILE_URL, target()));
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
  });
});

describe('two asks for one target', () => {
  it('from one address share one download', async () => {
    const gate: { release: () => void } = { release: () => undefined };
    const transport = answering(
      () =>
        new Promise<FakeResponse>((resolve) => {
          gate.release = () => resolve(partsReply(200, [encode('one')]));
        }),
    );
    const client = clientWith(transport);
    const first = download(client, FILE_URL, target());
    const second = download(client, FILE_URL, target());
    expect(second).toBe(first);
    await vi.waitFor(() => expect(transport.calls).toHaveLength(1));
    gate.release();
    await first;
    expect(textOf(TARGET_URI)).toBe('one');
    expect(transport.calls).toHaveLength(1);
  });

  it('from another address wait for the running one, so no two writers share the partial', async () => {
    const other = `${SERVER.apiUrl}/api/workspaces/w/files/raw?path=q3.pdf`;
    const transport = answering(
      () => partsReply(200, [encode('first')]),
      () => partsReply(200, [encode('second')]),
    );
    const client = clientWith(transport);
    const first = download(client, FILE_URL, target());
    const second = download(client, other, target());
    await first;
    expect(textOf(TARGET_URI)).toBe('first');
    await second;
    expect(textOf(TARGET_URI)).toBe('second');
    expect(transport.calls.map((call) => call.url)).toEqual([FILE_URL, other]);
    nothingLeft();
  });

  it('a later ask after the first has settled downloads afresh', async () => {
    const transport = answering(
      () => partsReply(200, [encode('a')]),
      () => partsReply(200, [encode('b')]),
    );
    const client = clientWith(transport);
    await download(client, FILE_URL, target());
    await download(client, FILE_URL, target());
    expect(transport.calls).toHaveLength(2);
    expect(textOf(TARGET_URI)).toBe('b');
  });
});

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
    const running = download(client, FILE_URL, target());
    await vi.waitFor(() =>
      expect(memoryFs.files.get(partialOf(target()).uri)?.byteLength).toBe(10),
    );
    stopDownloads();
    memoryFs.files.clear(); // the folders are deleted (user-files.ts)
    gate.release();
    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
    expect(memoryFs.files.size).toBe(0);
    nothingLeft();
    await download(client, FILE_URL, target());
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
    const running = download(clientWith(transport), FILE_URL, target());
    await vi.waitFor(() => expect(memoryFs.files.get(partialOf(target()).uri)?.byteLength).toBe(3));
    stopDownloads();
    gate.release();
    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
    expect(memoryFs.files.size).toBe(0);
    expect(transport.calls[0]?.signal.aborted).toBe(true);
  });

  it('an ask waiting its turn when the person leaves creates nothing', async () => {
    const { gate, answer } = heldOpen(['first']);
    const other = `${SERVER.apiUrl}/api/workspaces/w/files/raw?path=q3.pdf`;
    const transport = answering(answer);
    const client = clientWith(transport);
    const first = download(client, FILE_URL, target());
    const waiting = download(client, other, target());
    await vi.waitFor(() => expect(transport.calls).toHaveLength(1));
    stopDownloads();
    gate.release();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    expect(transport.calls).toHaveLength(1);
    expect(memoryFs.files.size).toBe(0);
  });
});

describe('a download under its cap', () => {
  it('over its cap is refused, read no further, and the partial file is removed', async () => {
    const transport = answering(() => partsReply(200, [encode('12345'), encode('67890')]));
    const error = await failureOf(
      download(clientWith(transport), FILE_URL, target(), { maxBytes: 8 }),
    );
    expect(error).toMatchObject({ kind: 'invalid_response' });
    expect(memoryFs.files.size).toBe(0);
    nothingLeft();
  });

  it('a Content-Length over its cap is refused before a byte is written', async () => {
    const transport = answering(() => partsReply(200, [encode('1')], { 'Content-Length': '9' }));
    const error = await failureOf(
      download(clientWith(transport), FILE_URL, target(), { maxBytes: 8 }),
    );
    expect(error).toMatchObject({ kind: 'invalid_response' });
    nothingLeft();
  });

  it('a body that ends short of its Content-Length is the network, and nothing lands', async () => {
    const transport = answering(() =>
      partsReply(200, [encode('%PDF')], { 'Content-Length': '4096' }),
    );
    const error = await failureOf(download(clientWith(transport), FILE_URL, target()));
    expect(error).toMatchObject({ kind: 'network' });
    expect(memoryFs.files.size).toBe(0);
    nothingLeft();
  });

  it('takes a file at exactly its cap', async () => {
    const transport = answering(() => partsReply(200, [encode('1234'), encode('5678')]));
    await download(clientWith(transport), FILE_URL, target(), { maxBytes: 8 });
    expect(textOf(TARGET_URI)).toBe('12345678');
  });

  it('a close that fails after a write that failed keeps the write error, and nothing is left', async () => {
    memoryFs.failWrites = true;
    memoryFs.failCloses = true;
    const transport = answering(() => partsReply(200, [encode('x')]));
    await expect(download(clientWith(transport), FILE_URL, target())).rejects.toThrow('no space');
    expect(memoryFs.files.size).toBe(0);
  });

  it('a close that fails after a whole body is the failure, and nothing lands', async () => {
    memoryFs.failCloses = true;
    const transport = answering(() => partsReply(200, [encode('x')]));
    await expect(download(clientWith(transport), FILE_URL, target())).rejects.toThrow(
      'could not be closed',
    );
    expect(memoryFs.files.size).toBe(0);
  });

  it('a write that fails removes the partial file and closes its handle', async () => {
    memoryFs.failWrites = true;
    const transport = answering(() => partsReply(200, [encode('x')]));
    await expect(download(clientWith(transport), FILE_URL, target())).rejects.toThrow('no space');
    expect(memoryFs.files.size).toBe(0);
    nothingLeft();
  });
});

describe('a download that is stopped', () => {
  /** A body that sends one part, then waits until the request is aborted, as fetch's does. */
  function stalling(request: TransportRequest) {
    let sent = false;
    const parts = async function* () {
      if (!sent) {
        sent = true;
        yield encode('first');
      }
      await new Promise<never>((_, reject) => {
        const fail = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        if (request.signal.aborted) fail();
        else request.signal.addEventListener('abort', fail, { once: true });
      });
    };
    return { ...reply(200), parts };
  }

  it('an abort removes the partial file and is the caller’s abort', async () => {
    const controller = new AbortController();
    const transport = answering(stalling);
    const running = download(clientWith(transport), FILE_URL, target(), {
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(memoryFs.files.get(partialOf(target()).uri)?.byteLength).toBe(5));
    controller.abort();
    const error = await failureOf(running);
    expect(error).toMatchObject({ name: 'AbortError' });
    expect(memoryFs.files.size).toBe(0);
    nothingLeft();
  });

  it('a body still coming at its deadline is the network, and the partial file is removed', async () => {
    const transport = answering(stalling);
    const error = await failureOf(
      download(clientWith(transport), FILE_URL, target(), { timeoutMs: 20 }),
    );
    expect(error).toMatchObject({ kind: 'network' });
    expect(transport.calls[0]?.signal.aborted).toBe(true);
    nothingLeft();
  });
});
