// The transfer module's one redirect (docs/app-standard.md rule 13.2c), over the fake transport and
// expo-file-system in memory: a redirect is followed at most once, only when the request is
// marked as a storage redirect, only to https and with nothing of the session; what storage
// answers is its own, never the server's.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../errors';
import { memoryFs, textOf } from './fake-file-system';
import { SERVER, partsReply, reply } from './fake-transport';
import {
  FILE_URL,
  STORAGE,
  TARGET_URI,
  answering,
  clientWith,
  encode,
  failureOf,
  nothingLeft,
  target,
} from './transfer-harness';

vi.mock('expo-file-system', async () => (await import('./fake-file-system')).fakeExpoFileSystem);

const { download } = await import('../transfer');
const { storageAddress, assertOnServer } = await import('../transfer-request');

beforeEach(() => memoryFs.reset());

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

  it('a second hop is refused, keeping no address, and nothing goes to it', async () => {
    const again = 'https://elsewhere.example.test/next?X-Amz-Signature=def';
    const transport = answering(redirect(STORAGE), redirect(again, 307));
    const error = await failureOf(
      download(clientWith(transport), FILE_URL, target(), { redirectsToStorage: true }),
    );
    expect(error).toMatchObject({ kind: 'server', status: 307 });
    expect((error as ApiError).redirectTo).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain('Signature');
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
