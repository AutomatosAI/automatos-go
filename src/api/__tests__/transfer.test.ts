// The one transfer module (docs/app-standard.md rules 13.2 and 13.2c), over the fake transport and
// expo-file-system in memory: a file is fetched through the client (its bearer, its policy, its
// own server only), written a part at a time to a partial file and moved into place only when
// whole; a redirect is followed at most once, only when the request is marked as a storage
// redirect, only to https and with nothing of the session; a cap exceeded, an abort or a failure
// leaves no partial file.

import { File } from 'expo-file-system';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient, type ApiClientOptions } from '../client';
import { ApiError } from '../errors';
import type { TransportRequest } from '../transport-types';
import { SERVER, fakeTransport, partsReply, reply, type FakeTransport } from './fake-transport';
import { CACHE_URI, memoryFs, textOf } from './fake-file-system';

vi.mock('expo-file-system', async () => (await import('./fake-file-system')).fakeExpoFileSystem);

const { PARTIAL_SUFFIX, download, partialOf } = await import('../transfer');
const { storageAddress, assertOnServer } = await import('../transfer-request');

const TOKEN = 'jwt.token.value';
const FILE_URL = `${SERVER.apiUrl}/api/documents/generated/q3.pdf`;
const STORAGE = 'https://bucket.storage.example.test/q3.pdf?X-Amz-Signature=abc';
const TARGET_URI = `${CACHE_URI}/viewer/q3.pdf`;
const encode = (text: string) => new TextEncoder().encode(text);

function clientWith(transport: FakeTransport, overrides: Partial<ApiClientOptions> = {}) {
  return createApiClient({
    server: SERVER,
    getToken: async () => TOKEN,
    getWorkspaceId: () => 'ws-1',
    getLanguage: () => 'pt-BR',
    transport,
    ...overrides,
  });
}

/** The target, as the app makes it: expo-file-system's File (the fake, in memory, here). */
function target(): File {
  return new File(TARGET_URI);
}

/** Answers each request in turn with the next of `answers`. */
function answering(...answers: ((request: TransportRequest) => ReturnType<typeof reply>)[]) {
  let next = 0;
  return fakeTransport((request) => {
    const answer = answers[next];
    next += 1;
    if (!answer) throw new Error('an unexpected request');
    return answer(request);
  });
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the download to fail');
    },
    (caught: unknown) => caught,
  );
}

function nothingLeft(): void {
  expect([...memoryFs.files.keys()].filter((uri) => uri.endsWith(PARTIAL_SUFFIX))).toEqual([]);
  expect(memoryFs.openHandles).toBe(0);
}

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

describe('a redirect', () => {
  const redirect =
    (to: string, status = 302) =>
    () =>
      reply(status, '', { Location: to });

  it('is not followed when the request is not marked: the redirect error, one request', async () => {
    const transport = answering(redirect(STORAGE));
    const error = await failureOf(download(clientWith(transport), FILE_URL, target()));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'server', status: 302, redirectTo: STORAGE });
    expect(transport.calls).toHaveLength(1);
    expect(memoryFs.files.size).toBe(0);
  });

  it('is followed once when marked, with no bearer, no workspace and no other header', async () => {
    const transport = answering(redirect(STORAGE), () => partsReply(200, [encode('%PDF')]));
    await download(clientWith(transport), FILE_URL, target(), { redirectsToStorage: true });
    expect(textOf(TARGET_URI)).toBe('%PDF');
    expect(transport.calls.map((call) => call.url)).toEqual([FILE_URL, STORAGE]);
    expect(transport.calls[1]?.headers).toEqual({});
    expect(transport.calls[1]?.method).toBe('GET');
    expect(transport.calls[1]?.body).toBeUndefined();
    nothingLeft();
  });

  it('a second hop is refused: the redirect error, and nothing goes to its address', async () => {
    const again = 'https://elsewhere.example.test/next';
    const transport = answering(redirect(STORAGE), redirect(again, 307));
    const error = await failureOf(
      download(clientWith(transport), FILE_URL, target(), { redirectsToStorage: true }),
    );
    expect(error).toMatchObject({ kind: 'server', status: 307, redirectTo: again });
    expect(transport.calls).toHaveLength(2);
    nothingLeft();
  });

  it('to an http address is refused: one request, the redirect error', async () => {
    const plain = 'http://bucket.storage.example.test/q3.pdf';
    const transport = answering(redirect(plain));
    const error = await failureOf(
      download(clientWith(transport), FILE_URL, target(), { redirectsToStorage: true }),
    );
    expect(error).toMatchObject({ kind: 'server', status: 302, redirectTo: plain });
    expect(transport.calls).toHaveLength(1);
  });

  it("storage's refusal is its kind and signs no one out", async () => {
    const onAuthExpired = vi.fn();
    const transport = answering(redirect(STORAGE), () => reply(401, '<Error/>'));
    const error = await failureOf(
      download(clientWith(transport, { onAuthExpired }), FILE_URL, target(), {
        redirectsToStorage: true,
      }),
    );
    expect(error).toMatchObject({ kind: 'auth', status: 401 });
    expect(onAuthExpired).not.toHaveBeenCalled();
  });

  it("storage's body is under the same cap", async () => {
    const transport = answering(redirect(STORAGE), () => partsReply(200, [encode('123456789')]));
    const error = await failureOf(
      download(clientWith(transport), FILE_URL, target(), {
        redirectsToStorage: true,
        maxBytes: 8,
      }),
    );
    expect(error).toMatchObject({ kind: 'invalid_response' });
    nothingLeft();
  });
});

describe('storageAddress', () => {
  it('takes an https address with a host', () => {
    expect(storageAddress(STORAGE)).toBe(STORAGE);
    expect(storageAddress('HTTPS://bucket.example.test')).toBe('HTTPS://bucket.example.test');
    expect(storageAddress('https://bucket.example.test:9443/k?x=1')).not.toBeNull();
  });

  it('refuses http, a relative address, a user name, no host, a stray character or a huge one', () => {
    for (const location of [
      null,
      '',
      'http://bucket.example.test/q3.pdf',
      '/api/documents/generated/q3.pdf',
      '//bucket.example.test/q3.pdf',
      'https://user:secret@bucket.example.test/q3.pdf',
      'https:///q3.pdf',
      'https://bucket.example.test/q 3.pdf',
      'https://bucket.example.test\\@evil.example.test/',
      'javascript:alert(1)',
      `https://bucket.example.test/${'a'.repeat(8192)}`,
    ]) {
      expect(storageAddress(location), String(location)).toBeNull();
    }
  });
});

describe('assertOnServer', () => {
  it("takes an address on the client's server, in any case, and nothing else", () => {
    expect(() => assertOnServer(SERVER.apiUrl, FILE_URL)).not.toThrow();
    expect(() => assertOnServer(`${SERVER.apiUrl}/`, FILE_URL.toUpperCase())).not.toThrow();
    expect(() => assertOnServer(SERVER.apiUrl, SERVER.apiUrl)).toThrow(TypeError);
    expect(() => assertOnServer(SERVER.apiUrl, `${SERVER.apiUrl}:444/x`)).toThrow(TypeError);
  });
});
