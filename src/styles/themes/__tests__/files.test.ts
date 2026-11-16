import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../../api/client';
import { memoryFs } from '../../../api/__tests__/fake-file-system';
import {
  SERVER,
  fakeTransport,
  partsReply,
  reply,
  type FakeResponse,
} from '../../../api/__tests__/fake-transport';
import type { TransportRequest } from '../../../api/transport-types';
import { logger } from '../../../lib/logger';

// files.ts over expo-file-system in memory (it runs on a device only) and the fake transport: an
// allowed theme file is downloaded through the transfer module from the configured server with the
// client's bearer and workspace into <cache>/theme-files/<digest>/<path>, through a partial copy
// that moves into place only when whole and under its kind's cap; a copy already there is never
// downloaded again; two asks share one download; a failure is null, never a throw.
vi.mock(
  'expo-file-system',
  async () => (await import('../../../api/__tests__/fake-file-system')).fakeExpoFileSystem,
);

const { THEME_FILES_FOLDER, cacheThemeFile, cachePaintFiles, localThemeFile, paintFiles } =
  await import('../files');
const { themeFile } = await import('../file-url');
const { themePaint } = await import('../paint');
const { DIGEST, FONT_URL, HARBOUR_ID, answer, fileUrl } = await import('./fixtures');

const server = {
  answer: (_request: TransportRequest): FakeResponse | Promise<FakeResponse> =>
    partsReply(200, [new Uint8Array(1000)]),
};
const transport = fakeTransport((request) => server.answer(request));
const client = createApiClient({
  server: SERVER,
  getToken: async () => 'tok',
  getWorkspaceId: () => 'ws-1',
  transport,
});

const COPY = `file:///cache/${THEME_FILES_FOLDER}/${DIGEST}/assets/fonts/mobile/inter-regular.ttf`;

function fontFile() {
  const file = themeFile(FONT_URL, 'font');
  if (!file) throw new Error('the font URL should be allowed');
  return file;
}

const sized = (bytes: number) => () => partsReply(200, [new Uint8Array(bytes)]);

beforeEach(() => {
  memoryFs.reset();
  transport.calls.length = 0;
  server.answer = sized(1000);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a theme file download', () => {
  it('fetches from the configured server with the bearer and workspace, into its digest path', async () => {
    const copy = await cacheThemeFile(client, fontFile());
    expect(copy?.uri).toBe(COPY);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]).toMatchObject({
      url: `${SERVER.apiUrl}${FONT_URL}`,
      method: 'GET',
      headers: { Authorization: 'Bearer tok', 'X-Workspace-ID': 'ws-1' },
    });
    expect(memoryFs.files.get(COPY)?.byteLength).toBe(1000);
    expect(memoryFs.ops).toEqual([`create ${COPY}.partial`, `mv ${COPY}.partial -> ${COPY}`]);
  });

  it('never downloads a copy already on the phone (content-addressed)', async () => {
    memoryFs.files.set(COPY, new Uint8Array(2000));
    expect((await cacheThemeFile(client, fontFile()))?.uri).toBe(COPY);
    expect(transport.calls).toEqual([]);
  });

  it('refuses a file over its cap: the partial copy is deleted and nothing lands', async () => {
    server.answer = sized(400 * 1024 + 1);
    expect(await cacheThemeFile(client, fontFile())).toBeNull();
    expect([...memoryFs.files.keys()]).toEqual([]);
    server.answer = sized(2 * 1024 * 1024 + 1);
    const clip = themeFile(fileUrl('assets/mascot/idle.mp4'), 'mascot');
    expect(clip && (await cacheThemeFile(client, clip))).toBeNull();
    expect([...memoryFs.files.keys()]).toEqual([]);
  });

  it('takes a file at exactly its cap', async () => {
    server.answer = sized(400 * 1024);
    expect(await cacheThemeFile(client, fontFile())).not.toBeNull();
  });

  it('is null, logged, when the download fails, and leaves no partial copy', async () => {
    server.answer = () => reply(404, '{"detail":"Not found"}');
    expect(await cacheThemeFile(client, fontFile())).toBeNull();
    expect([...memoryFs.files.keys()]).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('never follows a redirect: the file is refused and nothing goes to the address', async () => {
    server.answer = () => reply(302, '', { Location: 'https://elsewhere.example.test/font.ttf' });
    expect(await cacheThemeFile(client, fontFile())).toBeNull();
    expect(transport.calls.map((call) => call.url)).toEqual([`${SERVER.apiUrl}${FONT_URL}`]);
    expect([...memoryFs.files.keys()]).toEqual([]);
  });

  it('shares one download between two asks for the same file', async () => {
    const gate: { release: () => void } = { release: () => undefined };
    server.answer = () =>
      new Promise<FakeResponse>((resolve) => {
        gate.release = () => resolve(partsReply(200, [new Uint8Array(10)]));
      });
    const first = cacheThemeFile(client, fontFile());
    const second = cacheThemeFile(client, fontFile());
    expect(second).toBe(first);
    await vi.waitFor(() => expect(transport.calls).toHaveLength(1));
    gate.release();
    await first;
    expect(transport.calls).toHaveLength(1);
  });
});

describe("a painting's files", () => {
  const paint = themePaint(
    answer(HARBOUR_ID, {
      fonts: { sans: FONT_URL },
      mascot: {
        mode: 'clips',
        states: [{ name: 'idle', clip: fileUrl('assets/mascot/idle.mp4'), still: null }],
      },
    }),
  );

  it('lists only allowlisted files of each kind', () => {
    if (!paint) throw new Error('the fixture should paint');
    expect(paintFiles(paint, 'font').map((file) => file.path)).toEqual([
      'assets/fonts/mobile/inter-regular.ttf',
    ]);
    expect(paintFiles(paint, 'mascot').map((file) => file.path)).toEqual([
      'assets/mascot/idle.mp4',
    ]);
  });

  it('caches every file of a kind and says whether all are there', async () => {
    if (!paint) throw new Error('the fixture should paint');
    expect(await cachePaintFiles(client, paint, 'font')).toBe(true);
    server.answer = () => Promise.reject(new TypeError('Network request failed'));
    expect(await cachePaintFiles(client, paint, 'mascot')).toBe(false);
  });

  it('finds a local copy only for an allowed URL that is on the phone', async () => {
    expect(localThemeFile(FONT_URL, 'font')).toBeNull();
    await cacheThemeFile(client, fontFile());
    expect(localThemeFile(FONT_URL, 'font')?.uri).toBe(COPY);
    expect(localThemeFile(`https://evil.example${FONT_URL}`, 'font')).toBeNull();
    expect(localThemeFile(null, 'font')).toBeNull();
  });
});
