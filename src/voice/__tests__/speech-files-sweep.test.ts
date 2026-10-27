// The server voice's cache folder is swept once per launch, at app start (the root layout), whether
// or not the server voice is used: a crash's leftover MP3s go. A sweep that fails is logged and
// never throws, so it can never stop the launch; the first write does not sweep again.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => {
  const files = new Map<string, Uint8Array>();
  const failures = { construct: false, remove: false };
  const join = (parts: unknown[]) =>
    parts
      .map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri))
      .join('/');
  class Directory {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      if (failures.construct) throw new Error('no cache directory');
      this.uri = join(parts);
    }
    get exists() {
      return [...files.keys()].some((uri) => uri.startsWith(this.uri));
    }
    create() {}
    delete() {
      if (failures.remove) throw new Error('permission denied');
      [...files.keys()]
        .filter((uri) => uri.startsWith(this.uri))
        .forEach((uri) => files.delete(uri));
    }
  }
  class File {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      files.set(this.uri, new Uint8Array());
    }
    write(bytes: Uint8Array) {
      files.set(this.uri, bytes);
    }
    delete() {
      files.delete(this.uri);
    }
  }
  // One logger for every fresh module the tests load (vi.resetModules gives each its own).
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return {
    files,
    failures,
    logger,
    fs: { Directory, File, Paths: { cache: { uri: 'file:///cache' } } },
  };
});
vi.mock('expo-file-system', () => native.fs);
vi.mock('../../lib/logger', () => ({ logger: native.logger }));

const LEFTOVER = 'file:///cache/server-voice/sentence-crash.mp3';

/** A fresh module: the sweep's once-per-launch flag starts over, as at a new launch. */
async function freshLaunch() {
  vi.resetModules();
  return import('../server/speech-files');
}

beforeEach(() => {
  native.files.clear();
  native.failures.construct = false;
  native.failures.remove = false;
  native.logger.warn.mockClear();
});

describe('sweepSpeechFiles', () => {
  it("removes a crash's leftover MP3s at start, with no write that launch", async () => {
    native.files.set(LEFTOVER, new Uint8Array([1]));
    const files = await freshLaunch();
    files.sweepSpeechFiles();
    expect(native.files.has(LEFTOVER)).toBe(false);
  });

  it('sweeps once per launch: a later call and the first write leave new files alone', async () => {
    const files = await freshLaunch();
    files.sweepSpeechFiles();
    native.files.set(LEFTOVER, new Uint8Array([1]));
    files.sweepSpeechFiles();
    const written = files.speechFiles.write(new Uint8Array([2]));
    expect(native.files.has(LEFTOVER)).toBe(true);
    expect(native.files.has(written)).toBe(true);
  });

  it('the first write sweeps when the start did not', async () => {
    native.files.set(LEFTOVER, new Uint8Array([1]));
    const files = await freshLaunch();
    const written = files.speechFiles.write(new Uint8Array([2]));
    expect(native.files.has(LEFTOVER)).toBe(false);
    expect(native.files.has(written)).toBe(true);
  });

  it('never throws: a folder that cannot be deleted is logged', async () => {
    native.files.set(LEFTOVER, new Uint8Array([1]));
    native.failures.remove = true;
    const files = await freshLaunch();
    expect(() => files.sweepSpeechFiles()).not.toThrow();
    expect(native.logger.warn).toHaveBeenCalledWith(
      '[voice] a server voice file could not be deleted',
      expect.any(Error),
    );
  });

  it('never throws: a cache directory that cannot be opened is logged', async () => {
    native.failures.construct = true;
    const files = await freshLaunch();
    expect(() => files.sweepSpeechFiles()).not.toThrow();
    expect(native.logger.warn).toHaveBeenCalledWith(
      '[voice] the server voice folder could not be swept',
      expect.any(Error),
    );
  });
});

describe('the root layout', () => {
  it('sweeps at app start, after crash reporting starts and before the layout renders', () => {
    const root = readFileSync(path.resolve(__dirname, '..', '..', '..', 'app/_layout.tsx'), 'utf8');
    expect(root).toContain("import { sweepSpeechFiles } from '../src/voice/server/speech-files';");
    const calls = [...root.matchAll(/^sweepSpeechFiles\(\);$/gm)];
    expect(calls).toHaveLength(1);
    const call = calls[0]?.index ?? -1;
    expect(call).toBeGreaterThan(root.indexOf('initCrashReporting();'));
    expect(call).toBeLessThan(root.indexOf('export default function RootLayout'));
  });
});
