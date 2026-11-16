// What the transfer module's tests share (transfer.test.ts, transfer-redirect.test.ts): the client
// over a fake transport, a target in the in-memory expo-file-system, answers in turn, and the
// checks that nothing is left behind. A test file that imports this mocks expo-file-system first:
//   vi.mock('expo-file-system', async () => (await import('./fake-file-system')).fakeExpoFileSystem);

import { File } from 'expo-file-system';
import { expect } from 'vitest';

import { createApiClient, type ApiClientOptions } from '../client';
import type { TransportRequest } from '../transport-types';
import { CACHE_URI, memoryFs } from './fake-file-system';
import { SERVER, fakeTransport, type FakeResponse, type FakeTransport } from './fake-transport';

export const TOKEN = 'jwt.token.value';
export const FILE_URL = `${SERVER.apiUrl}/api/documents/generated/q3.pdf`;
export const STORAGE = 'https://bucket.storage.example.test/q3.pdf?X-Amz-Signature=abc';
export const TARGET_URI = `${CACHE_URI}/viewer/q3.pdf`;
export const encode = (text: string) => new TextEncoder().encode(text);
/** A download's time limit, which every download names (transfer.ts). */
export const TIMED = Object.freeze({ timeoutMs: 30_000 });

export function clientWith(transport: FakeTransport, overrides: Partial<ApiClientOptions> = {}) {
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
export function target(): File {
  return new File(TARGET_URI);
}

/** Answers each request in turn with the next of `answers`. */
export function answering(
  ...answers: ((request: TransportRequest) => FakeResponse | Promise<FakeResponse>)[]
) {
  let next = 0;
  return fakeTransport((request) => {
    const answer = answers[next];
    next += 1;
    if (!answer) throw new Error('an unexpected request');
    return answer(request);
  });
}

export async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the download to fail');
    },
    (caught: unknown) => caught,
  );
}

/** No partial file and no open handle is left. */
export function nothingLeft(): void {
  expect([...memoryFs.files.keys()].filter((uri) => uri.endsWith('.partial'))).toEqual([]);
  expect(memoryFs.openHandles).toBe(0);
}
