import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { memoryFs } from '../../api/__tests__/fake-file-system';
import {
  SERVER,
  fakeTransport,
  partsReply,
  reply,
  type FakeResponse,
} from '../../api/__tests__/fake-transport';
import type { TransportRequest } from '../../api/transport-types';

// US-013b: open-file.ts over expo-file-system in memory, the viewer module replaced (they run on a
// device only) and the fake transport: the copy is downloaded through the transfer module with
// the client's bearer and workspace into the cache folder, shown by the viewer, deleted when the
// viewer closes, and the folder is emptied before every download. Only a generated document's
// route follows a redirect, once, to storage, with nothing of the session (T15).
const viewer = vi.hoisted(() => ({
  calls: [] as { uri: string; displayName?: string }[],
  open: (_uri: string): Promise<void> => Promise.resolve(),
  dismiss: null as (() => void) | null,
}));

vi.mock(
  'expo-file-system',
  async () => (await import('../../api/__tests__/fake-file-system')).fakeExpoFileSystem,
);

vi.mock('react-native-file-viewer-turbo', () => ({
  open: async (uri: string, options: { displayName?: string; onDismiss?: () => void }) => {
    viewer.calls.push({ uri, displayName: options.displayName });
    await viewer.open(uri);
    viewer.dismiss = options.onDismiss ?? null;
  },
}));

const {
  VIEWER_FOLDER,
  ViewerError,
  clearViewerFiles,
  downloadError,
  openInSystemViewer,
  redirectsToStorage,
} = await import('../deliverables/open-file');

const FOLDER = `file:///cache/${VIEWER_FOLDER}`;
const RAW_URL = `${SERVER.apiUrl}/api/workspaces/w/files/raw?path=q3.pdf`;
const GENERATED_URL = `${SERVER.apiUrl}/api/documents/generated/q3.pdf`;
const STORAGE = 'https://bucket.storage.example.test/w/q3.pdf?X-Amz-Signature=abc';
const PDF = new TextEncoder().encode('%PDF-1.7');

const server = {
  answers: [] as ((request: TransportRequest) => FakeResponse)[],
};
const transport = fakeTransport((request) => {
  const answer = server.answers.shift();
  if (!answer) throw new Error('an unexpected request');
  return answer(request);
});
const client = createApiClient({
  server: SERVER,
  getToken: async () => 'tok',
  getWorkspaceId: () => 'w',
  transport,
});
const file = (url = RAW_URL) => ({ client, url, fileName: 'q3.pdf', title: 'Q3 plan' });
const pdf = () => partsReply(200, [PDF]);

beforeEach(() => {
  memoryFs.reset();
  transport.calls.length = 0;
  server.answers = [pdf];
  viewer.calls.length = 0;
  viewer.open = () => Promise.resolve();
  viewer.dismiss = null;
});

describe('the system viewer', () => {
  it("downloads into the cache folder with the client's headers, then shows the copy", async () => {
    await openInSystemViewer(file());
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]).toMatchObject({
      url: RAW_URL,
      method: 'GET',
      headers: { Authorization: 'Bearer tok', 'X-Workspace-ID': 'w' },
    });
    expect(memoryFs.files.get(`${FOLDER}/q3.pdf`)).toEqual(PDF);
    expect(viewer.calls).toEqual([{ uri: `${FOLDER}/q3.pdf`, displayName: 'Q3 plan' }]);
  });

  it('deletes the copy when the viewer closes', async () => {
    await openInSystemViewer(file());
    viewer.dismiss?.();
    expect(memoryFs.files.has(`${FOLDER}/q3.pdf`)).toBe(false);
  });

  it('empties the folder on the next open: a copy whose close was never reported goes', async () => {
    memoryFs.folders.add(FOLDER);
    memoryFs.files.set(`${FOLDER}/old.xlsx`, new Uint8Array(3));
    await openInSystemViewer(file());
    expect(memoryFs.files.has(`${FOLDER}/old.xlsx`)).toBe(false);
    expect(memoryFs.ops[0]).toBe(`rmdir ${FOLDER}`);
    clearViewerFiles();
    expect(memoryFs.files.size).toBe(0);
  });

  it("a refused download is the taxonomy's error, and nothing is shown or left", async () => {
    server.answers = [() => reply(404, '{"detail":"File not found"}')];
    await expect(openInSystemViewer(file())).rejects.toMatchObject({
      kind: 'not_found',
      status: 404,
    });
    expect(viewer.calls).toEqual([]);
    expect(memoryFs.files.size).toBe(0);
  });

  it('a viewer that cannot show the file deletes the copy and says so', async () => {
    viewer.open = () => Promise.reject(new Error('No app associated with this mime type'));
    await expect(openInSystemViewer(file())).rejects.toBeInstanceOf(ViewerError);
    expect(memoryFs.files.has(`${FOLDER}/q3.pdf`)).toBe(false);
  });
});

describe('two opens at once', () => {
  /** A body that sends its first part, then waits until the request is aborted, as fetch's does. */
  function stalling(request: TransportRequest): FakeResponse {
    const parts = async function* () {
      yield new TextEncoder().encode('%PDF-first');
      await new Promise<never>((_, reject) => {
        const fail = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        if (request.signal.aborted) fail();
        else request.signal.addEventListener('abort', fail, { once: true });
      });
    };
    return { ...reply(200), parts };
  }

  const partials = () => [...memoryFs.files.keys()].filter((uri) => uri.endsWith('.partial'));

  it('the same file tapped twice: the first download stops, the second shows the one copy', async () => {
    server.answers = [stalling, pdf];
    const first = openInSystemViewer(file());
    await vi.waitFor(() => expect(partials()).toHaveLength(1));
    const second = openInSystemViewer(file());
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await second;
    expect(transport.calls).toHaveLength(2);
    expect(transport.calls[0]?.signal.aborted).toBe(true);
    expect(memoryFs.files.get(`${FOLDER}/q3.pdf`)).toEqual(PDF);
    expect(partials()).toEqual([]);
    expect(viewer.calls).toEqual([{ uri: `${FOLDER}/q3.pdf`, displayName: 'Q3 plan' }]);
  });

  it('a second file opened while the first downloads: only the second lands and is shown', async () => {
    server.answers = [stalling, pdf];
    const first = openInSystemViewer(file());
    await vi.waitFor(() => expect(partials()).toHaveLength(1));
    const other = { ...file(GENERATED_URL), fileName: 'budget.pdf', title: 'Budget' };
    const second = openInSystemViewer(other);
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await second;
    expect([...memoryFs.files.keys()]).toEqual([`${FOLDER}/budget.pdf`]);
    expect(viewer.calls).toEqual([{ uri: `${FOLDER}/budget.pdf`, displayName: 'Budget' }]);
  });

  it('three quick opens: only the last one downloads after the first is stopped', async () => {
    server.answers = [stalling, pdf];
    const first = openInSystemViewer(file());
    await vi.waitFor(() => expect(partials()).toHaveLength(1));
    const second = openInSystemViewer(file());
    const third = openInSystemViewer({ ...file(), fileName: 'q4.pdf', title: 'Q4' });
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    await third;
    expect(transport.calls).toHaveLength(2);
    expect([...memoryFs.files.keys()]).toEqual([`${FOLDER}/q4.pdf`]);
  });
});

describe('a redirect on the way to the file', () => {
  const toStorage = () => reply(302, '', { Location: STORAGE });

  it("a generated document's redirect to storage is followed once, with nothing of the session", async () => {
    server.answers = [toStorage, pdf];
    await openInSystemViewer(file(GENERATED_URL));
    expect(transport.calls.map((call) => call.url)).toEqual([GENERATED_URL, STORAGE]);
    expect(transport.calls[1]?.headers).toEqual({});
    expect(memoryFs.files.get(`${FOLDER}/q3.pdf`)).toEqual(PDF);
  });

  it('any other route that redirects is refused, and nothing goes to the address', async () => {
    server.answers = [toStorage];
    await expect(openInSystemViewer(file())).rejects.toMatchObject({ kind: 'server', status: 302 });
    expect(transport.calls.map((call) => call.url)).toEqual([RAW_URL]);
    expect(viewer.calls).toEqual([]);
  });

  it('knows the generated route by its path on this server only', () => {
    expect(redirectsToStorage(SERVER.apiUrl, GENERATED_URL)).toBe(true);
    expect(redirectsToStorage(`${SERVER.apiUrl}/`, GENERATED_URL.toUpperCase())).toBe(false);
    expect(redirectsToStorage(SERVER.apiUrl, RAW_URL)).toBe(false);
    expect(
      redirectsToStorage(SERVER.apiUrl, 'https://elsewhere.example.test/api/documents/generated/x'),
    ).toBe(false);
  });
});

describe('downloadError', () => {
  it("keeps the client's error, and calls anything else the network", () => {
    const own = new ApiError('auth');
    expect(downloadError(own)).toBe(own);
    expect(downloadError(new Error('no space left on device'))).toMatchObject({ kind: 'network' });
    expect(downloadError('no file url')).toMatchObject({ kind: 'network' });
  });
});
