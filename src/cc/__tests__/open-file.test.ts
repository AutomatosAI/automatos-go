import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/errors';

// US-013b: open-file.ts over the native modules, replaced (they run on a device only): the copy is
// downloaded into the cache folder with the request's headers, shown by the viewer, deleted when
// the viewer closes, and the folder is emptied before every download.
const native = vi.hoisted(() => {
  const files = new Set<string>();
  const calls: { op: string; uri: string; options?: unknown }[] = [];
  const state = {
    download: (_url: string): Promise<void> => Promise.resolve(),
    open: (_uri: string): Promise<void> => Promise.resolve(),
    dismiss: null as (() => void) | null,
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
    get exists() {
      return [...files].some((uri) => uri.startsWith(`${this.uri}/`)) || files.has(this.uri);
    }
    create(options: unknown) {
      calls.push({ op: 'mkdir', uri: this.uri, options });
      files.add(this.uri);
    }
    delete() {
      calls.push({ op: 'rmdir', uri: this.uri });
      [...files].filter((uri) => uri.startsWith(this.uri)).forEach((uri) => files.delete(uri));
    }
  }
  class FakeFile {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    delete() {
      calls.push({ op: 'rm', uri: this.uri });
      files.delete(this.uri);
    }
    static async downloadFileAsync(url: string, to: FakeFile, options: unknown) {
      calls.push({ op: 'download', uri: to.uri, options: { url, ...(options as object) } });
      await state.download(url);
      files.add(to.uri);
      return new FakeFile(to.uri);
    }
  }
  return { files, calls, state, FakeDirectory, FakeFile, cache: { uri: 'file:///cache' } };
});

vi.mock('expo-file-system', () => ({
  Directory: native.FakeDirectory,
  File: native.FakeFile,
  Paths: { cache: native.cache },
}));

vi.mock('react-native-file-viewer-turbo', () => ({
  open: async (uri: string, options: { displayName?: string; onDismiss?: () => void }) => {
    native.calls.push({ op: 'view', uri, options: { displayName: options.displayName } });
    await native.state.open(uri);
    native.state.dismiss = options.onDismiss ?? null;
  },
}));

const { VIEWER_FOLDER, ViewerError, clearViewerFiles, downloadError, openInSystemViewer } =
  await import('../deliverables/open-file');

const FOLDER = `file:///cache/${VIEWER_FOLDER}`;
const FILE_URL = 'https://api.example.test/api/workspaces/w/files/raw?path=q3.pdf';
const HEADERS = { Authorization: 'Bearer tok', 'X-Workspace-ID': 'w' };
const FILE = { request: { url: FILE_URL, headers: HEADERS }, fileName: 'q3.pdf', title: 'Q3 plan' };

describe('the system viewer', () => {
  beforeEach(() => {
    native.files.clear();
    native.calls.length = 0;
    native.state.download = () => Promise.resolve();
    native.state.open = () => Promise.resolve();
    native.state.dismiss = null;
  });

  it("downloads into the cache folder with the client's headers, then shows the copy", async () => {
    await openInSystemViewer(FILE);
    expect(native.calls.filter((call) => call.op !== 'rmdir')).toEqual([
      { op: 'mkdir', uri: FOLDER, options: { intermediates: true, idempotent: true } },
      {
        op: 'download',
        uri: `${FOLDER}/q3.pdf`,
        options: { url: FILE_URL, headers: HEADERS, idempotent: true },
      },
      { op: 'view', uri: `${FOLDER}/q3.pdf`, options: { displayName: 'Q3 plan' } },
    ]);
    expect(native.files.has(`${FOLDER}/q3.pdf`)).toBe(true);
  });

  it('deletes the copy when the viewer closes', async () => {
    await openInSystemViewer(FILE);
    native.state.dismiss?.();
    expect(native.files.has(`${FOLDER}/q3.pdf`)).toBe(false);
  });

  it('empties the folder on the next open: a copy whose close was never reported goes', async () => {
    native.files.add(`${FOLDER}/old.xlsx`);
    await openInSystemViewer(FILE);
    expect(native.files.has(`${FOLDER}/old.xlsx`)).toBe(false);
    expect(native.calls[0]).toEqual({ op: 'rmdir', uri: FOLDER });
    clearViewerFiles();
    expect(native.files.size).toBe(0);
  });

  it("a refused download is the taxonomy's error, and nothing is shown", async () => {
    native.state.download = () => Promise.reject(new Error('response has status 404'));
    await expect(openInSystemViewer(FILE)).rejects.toMatchObject({
      kind: 'not_found',
      status: 404,
    });
    expect(native.calls.some((call) => call.op === 'view')).toBe(false);
  });

  it('a viewer that cannot show the file deletes the copy and says so', async () => {
    native.state.open = () => Promise.reject(new Error('No app associated with this mime type'));
    await expect(openInSystemViewer(FILE)).rejects.toBeInstanceOf(ViewerError);
    expect(native.files.has(`${FOLDER}/q3.pdf`)).toBe(false);
  });
});

describe('downloadError', () => {
  it("reads the status from either platform's words", () => {
    expect(downloadError(new Error('response has status 401'))).toMatchObject({ kind: 'auth' });
    expect(downloadError(new Error('response has status: 403'))).toMatchObject({
      kind: 'forbidden',
      status: 403,
    });
    expect(downloadError(new Error('response has status 500'))).toMatchObject({ kind: 'server' });
  });

  it('anything else is the network; an ApiError stays itself', () => {
    expect(
      downloadError(new Error('The Internet connection appears to be offline.')),
    ).toMatchObject({ kind: 'network' });
    expect(downloadError('no file url')).toMatchObject({ kind: 'network' });
    const own = new ApiError('auth');
    expect(downloadError(own)).toBe(own);
  });
});
