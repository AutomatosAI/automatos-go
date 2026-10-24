import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../../api/client';
import { SERVER, fakeTransport, reply } from '../../../api/__tests__/fake-transport';
import { logger } from '../../../lib/logger';

// files.ts over expo-file-system, replaced (it runs on a device only): an allowed theme file is
// downloaded from the configured server with the client's bearer and workspace into
// <cache>/theme-files/<digest>/<path>, through a partial copy that moves into place only under its
// kind's cap; a copy already there is never downloaded again; two asks share one download; a
// failure is null, never a throw.
const native = vi.hoisted(() => {
  const sizes = new Map<string, number>();
  const calls: { op: string; uri: string; options?: unknown }[] = [];
  const state = {
    bytes: (_url: string): number => 1000,
    download: (_url: string): Promise<void> => Promise.resolve(),
  };
  const join = (parts: readonly unknown[]) =>
    parts
      .map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri))
      .join('/');
  class FakeDirectory {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create(options: unknown) {
      calls.push({ op: 'mkdir', uri: this.uri, options });
    }
  }
  class FakeFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return sizes.has(this.uri);
    }
    get size() {
      return sizes.get(this.uri) ?? 0;
    }
    get parentDirectory() {
      return new FakeDirectory(this.uri.slice(0, this.uri.lastIndexOf('/')));
    }
    delete() {
      calls.push({ op: 'rm', uri: this.uri });
      sizes.delete(this.uri);
    }
    move(to: FakeFile) {
      calls.push({ op: 'mv', uri: `${this.uri} -> ${to.uri}` });
      sizes.set(to.uri, this.size);
      sizes.delete(this.uri);
      this.uri = to.uri;
    }
    static async downloadFileAsync(url: string, to: FakeFile, options: unknown) {
      calls.push({ op: 'download', uri: to.uri, options: { url, ...(options as object) } });
      await state.download(url);
      sizes.set(to.uri, state.bytes(url));
      return new FakeFile(to.uri);
    }
  }
  return { sizes, calls, state, FakeDirectory, FakeFile, cache: { uri: 'file:///cache' } };
});

vi.mock('expo-file-system', () => ({
  Directory: native.FakeDirectory,
  File: native.FakeFile,
  Paths: { cache: native.cache },
}));

const { THEME_FILES_FOLDER, cacheThemeFile, cachePaintFiles, localThemeFile, paintFiles } =
  await import('../files');
const { themeFile } = await import('../file-url');
const { themePaint } = await import('../paint');
const { DIGEST, FONT_URL, HARBOUR_ID, answer, fileUrl } = await import('./fixtures');

const client = createApiClient({
  server: SERVER,
  getToken: async () => 'tok',
  getWorkspaceId: () => 'ws-1',
  transport: fakeTransport(() => reply(500)),
});

const COPY = `file:///cache/${THEME_FILES_FOLDER}/${DIGEST}/assets/fonts/mobile/inter-regular.ttf`;

function fontFile() {
  const file = themeFile(FONT_URL, 'font');
  if (!file) throw new Error('the font URL should be allowed');
  return file;
}

beforeEach(() => {
  native.sizes.clear();
  native.calls.length = 0;
  native.state.bytes = () => 1000;
  native.state.download = () => Promise.resolve();
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a theme file download', () => {
  it('fetches from the configured server with the bearer and workspace, into its digest path', async () => {
    const copy = await cacheThemeFile(client, fontFile());
    expect(copy?.uri).toBe(COPY);
    const download = native.calls.find((call) => call.op === 'download');
    expect(download?.options).toMatchObject({
      url: `${SERVER.apiUrl}${FONT_URL}`,
      headers: { Authorization: 'Bearer tok', 'X-Workspace-ID': 'ws-1' },
      idempotent: true,
    });
    expect(download?.uri).toContain(`/${THEME_FILES_FOLDER}/.partial/`);
    expect(native.sizes.has(COPY)).toBe(true);
  });

  it('never downloads a copy already on the phone (content-addressed)', async () => {
    native.sizes.set(COPY, 2000);
    expect((await cacheThemeFile(client, fontFile()))?.uri).toBe(COPY);
    expect(native.calls.some((call) => call.op === 'download')).toBe(false);
  });

  it('refuses a file over its cap: the partial copy is deleted and nothing lands', async () => {
    native.state.bytes = () => 400 * 1024 + 1;
    expect(await cacheThemeFile(client, fontFile())).toBeNull();
    expect([...native.sizes.keys()]).toEqual([]);
    native.state.bytes = () => 2 * 1024 * 1024 + 1;
    const clip = themeFile(fileUrl('assets/mascot/idle.mp4'), 'mascot');
    expect(clip && (await cacheThemeFile(client, clip))).toBeNull();
  });

  it('takes a file at exactly its cap', async () => {
    native.state.bytes = () => 400 * 1024;
    expect(await cacheThemeFile(client, fontFile())).not.toBeNull();
  });

  it('is null, logged, when the download fails, and leaves no partial copy', async () => {
    native.state.download = () => Promise.reject(new Error('response has status 404'));
    expect(await cacheThemeFile(client, fontFile())).toBeNull();
    expect([...native.sizes.keys()]).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('shares one download between two asks for the same file', async () => {
    const gate: { release: () => void } = { release: () => undefined };
    native.state.download = () => new Promise<void>((resolve) => (gate.release = resolve));
    const first = cacheThemeFile(client, fontFile());
    const second = cacheThemeFile(client, fontFile());
    expect(second).toBe(first);
    await vi.waitFor(() => expect(native.calls.some((call) => call.op === 'download')).toBe(true));
    gate.release();
    await first;
    expect(native.calls.filter((call) => call.op === 'download')).toHaveLength(1);
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
    native.state.download = () => Promise.reject(new Error('offline'));
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
