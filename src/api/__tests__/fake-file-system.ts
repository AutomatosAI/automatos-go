// expo-file-system in memory, for the tests of the modules that write files (it runs on a device
// only). A test mocks the module with it, as
//   vi.mock('expo-file-system', async () => (await import('<path>/fake-file-system')).fakeExpoFileSystem);
// and reads what was written from `memoryFs`: the files and their bytes, the folders, and every
// operation in order. Only what the app uses is here: File (exists, size, create, open, a handle's
// writeBytes and close, delete, move), Directory (exists, create, delete) and Paths.cache.

type Part = string | { readonly uri: string };

function joined(parts: readonly Part[]): string {
  return parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
}

export const memoryFs = {
  files: new Map<string, Uint8Array>(),
  folders: new Set<string>(),
  ops: [] as string[],
  /** Handles opened and not yet closed. */
  openHandles: 0,
  /** Set to make the next writeBytes throw (a full disk). */
  failWrites: false,
  reset() {
    this.files.clear();
    this.folders.clear();
    this.ops.length = 0;
    this.openHandles = 0;
    this.failWrites = false;
  },
};

function parentOf(uri: string): string {
  return uri.slice(0, uri.lastIndexOf('/'));
}

const SCHEME = 'file://';

/** Every folder above a path, nearest first: `intermediates` makes all of them, as the device does. */
function foldersAbove(uri: string): readonly string[] {
  const parent = parentOf(uri);
  return parent.length <= SCHEME.length ? [] : [parent, ...foldersAbove(parent)];
}

class FakeHandle {
  #open = true;
  constructor(private readonly uri: string) {
    memoryFs.openHandles += 1;
  }
  writeBytes(bytes: Uint8Array): void {
    if (!this.#open) throw new Error('the handle is closed');
    if (memoryFs.failWrites) throw new Error('no space left on device');
    const before = memoryFs.files.get(this.uri) ?? new Uint8Array(0);
    const after = new Uint8Array(before.byteLength + bytes.byteLength);
    after.set(before);
    after.set(bytes, before.byteLength);
    memoryFs.files.set(this.uri, after);
  }
  close(): void {
    if (this.#open) memoryFs.openHandles -= 1;
    this.#open = false;
  }
}

export class FakeDirectory {
  readonly uri: string;
  constructor(...parts: Part[]) {
    this.uri = joined(parts);
  }
  get exists(): boolean {
    return memoryFs.folders.has(this.uri);
  }
  create(): void {
    memoryFs.ops.push(`mkdir ${this.uri}`);
    memoryFs.folders.add(this.uri);
  }
  delete(): void {
    memoryFs.ops.push(`rmdir ${this.uri}`);
    [...memoryFs.files.keys()]
      .filter((uri) => uri.startsWith(`${this.uri}/`))
      .forEach((uri) => memoryFs.files.delete(uri));
    [...memoryFs.folders]
      .filter((uri) => uri === this.uri || uri.startsWith(`${this.uri}/`))
      .forEach((uri) => memoryFs.folders.delete(uri));
  }
}

export class FakeFile {
  uri: string;
  constructor(...parts: Part[]) {
    this.uri = joined(parts);
  }
  get exists(): boolean {
    return memoryFs.files.has(this.uri);
  }
  get size(): number {
    return memoryFs.files.get(this.uri)?.byteLength ?? 0;
  }
  get parentDirectory(): FakeDirectory {
    return new FakeDirectory(parentOf(this.uri));
  }
  create(options?: { intermediates?: boolean; overwrite?: boolean }): void {
    if (this.exists && !options?.overwrite) throw new Error('it already exists');
    memoryFs.ops.push(`create ${this.uri}`);
    if (options?.intermediates) foldersAbove(this.uri).forEach((uri) => memoryFs.folders.add(uri));
    memoryFs.files.set(this.uri, new Uint8Array(0));
  }
  open(): FakeHandle {
    if (!this.exists) throw new Error('the file does not exist');
    return new FakeHandle(this.uri);
  }
  delete(): void {
    memoryFs.ops.push(`rm ${this.uri}`);
    memoryFs.files.delete(this.uri);
  }
  move(to: FakeFile): void {
    if (to.exists) throw new Error('the destination already exists');
    memoryFs.ops.push(`mv ${this.uri} -> ${to.uri}`);
    memoryFs.files.set(to.uri, memoryFs.files.get(this.uri) ?? new Uint8Array(0));
    memoryFs.files.delete(this.uri);
    this.uri = to.uri;
  }
  /** The file system's own downloader: never called by the app (transfer.ts writes the bytes). */
  static downloadFileAsync(): never {
    throw new Error('File.downloadFileAsync was called: files are fetched through transfer.ts');
  }
}

export const CACHE_URI = 'file:///cache';

export const fakeExpoFileSystem = {
  File: FakeFile,
  Directory: FakeDirectory,
  Paths: { cache: new FakeDirectory(CACHE_URI) },
};

/** The text of a file written in memory, or null when there is none. */
export function textOf(uri: string): string | null {
  const bytes = memoryFs.files.get(uri);
  return bytes ? new TextDecoder().decode(bytes) : null;
}
