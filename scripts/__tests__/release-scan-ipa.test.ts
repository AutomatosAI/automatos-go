// The IPA symbol scan (US-021h, R07, KR12), on synthetic bundles (support/ipa-fixtures.ts): fake
// Mach-O binaries with planted symbol names, an Info.plist passed as JSON with --plist, and an .ipa
// written as a stored zip, so nothing needs Xcode or a real build. It also keeps
// scripts/release/usage-symbols.json in step with docs/native-modules.md 'Symbols and usage keys'
// and docs/release/ios-usage-keys.json, and runs the scan against today's usage keys with every
// reference the foundation found planted.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  type BundleFiles,
  EXECUTABLE,
  FILLER,
  MACH_O_64,
  machO,
  storedZip,
  writeApp,
  writeIpa,
  writePlistJson,
} from '../../src/release/__tests__/support/ipa-fixtures';
import { sectionStartingWith } from '../../src/release/__tests__/support/markdown';
import { neededSymbol, readIosUsageKeys } from '../../src/release/__tests__/support/permissions';
import { readRepoFile } from '../../src/release/__tests__/support/tree';
import {
  AC_REQUIRED,
  readUsageSymbols,
  symbolForDocClass,
  USAGE_SYMBOLS_PATH,
} from '../../src/release/__tests__/support/usage-symbols';
import {
  CHUNK_BYTES,
  loadSymbols,
  run,
  scanBinary,
  ScanError,
  SYMBOLS_PATH,
} from '../release/scan-ipa.mjs';

const SCRIPT = path.join(__dirname, '..', 'release', 'scan-ipa.mjs');
const scratch = mkdtempSync(path.join(os.tmpdir(), 'release-scan-ipa-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
let dirCount = 0;

function freshDir(): string {
  dirCount += 1;
  const dir = path.join(scratch, `case-${dirCount}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const makeApp = (files: BundleFiles) => writeApp(freshDir(), files);
const plistFile = (keys: readonly string[]) => writePlistJson(freshDir(), keys);
const makeIpa = (files: Readonly<Record<string, Buffer>>) => writeIpa(freshDir(), files);

function scan(args: readonly string[], tmpRoot = freshDir()) {
  const out: string[] = [];
  const err: string[] = [];
  const code = run(args, { out: (line) => out.push(line), err: (line) => err.push(line), tmpRoot });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

// ── The scan ───────────────────────────────────────────────────────────────────────────────

describe('scan-ipa.mjs on a synthetic .app (US-021h)', () => {
  it('passes when every referenced symbol has its key, and lists what it scanned', () => {
    const appDir = makeApp({
      [EXECUTABLE]: machO('PHAsset', 'LAContext'),
      'Frameworks/Sentry.framework/Sentry': machO('CMMotionManager'),
    });
    const plist = plistFile([
      'NSPhotoLibraryUsageDescription',
      'NSFaceIDUsageDescription',
      'NSMotionUsageDescription',
    ]);
    const result = scan([appDir, '--plist', plist]);
    expect(result.code).toBe(0);
    expect(result.out).toContain(
      `PHAsset → ${EXECUTABLE} → NSPhotoLibraryUsageDescription → present`,
    );
    expect(result.out).toContain(
      'CMMotionManager → Frameworks/Sentry.framework/Sentry → NSMotionUsageDescription → present',
    );
    expect(result.out).toContain('Scanned 2 binaries');
    expect(result.out).toContain(`Info.plist: from --plist ${plist}`);
    expect(result.out).toMatch(/^PASS: /m);
    expect(result.err).toBe('');
  });

  it('fails with exit 1 naming the missing key, the symbol and the binary', () => {
    const appDir = makeApp({
      [EXECUTABLE]: machO('LAContext'),
      'Frameworks/LiveKitWebRTC.framework/LiveKitWebRTC': machO('AVCaptureDevice'),
    });
    const result = scan([
      appDir,
      '--plist',
      plistFile(['NSFaceIDUsageDescription', 'NSCameraUsageDescription']),
    ]);
    expect(result.code).toBe(1);
    expect(result.out).toContain(
      'AVCaptureDevice → Frameworks/LiveKitWebRTC.framework/LiveKitWebRTC → NSMicrophoneUsageDescription → missing',
    );
    expect(result.err).toContain('NSMicrophoneUsageDescription missing');
    expect(result.err).not.toContain('NSCameraUsageDescription');
  });

  it('counts a key with an empty string as missing', () => {
    const appDir = makeApp({ [EXECUTABLE]: machO('LAContext') });
    const file = path.join(freshDir(), 'plist.json');
    writeFileSync(
      file,
      JSON.stringify({ CFBundleExecutable: EXECUTABLE, NSFaceIDUsageDescription: ' ' }),
    );
    expect(scan([appDir, '--plist', file]).code).toBe(1);
  });

  it('fails with exit 1 on ATTrackingManager, whatever the plist holds (KR10)', () => {
    const appDir = makeApp({
      [EXECUTABLE]: machO(),
      'Frameworks/libTracker.dylib': machO('ATTrackingManager'),
    });
    const result = scan([appDir, '--plist', plistFile(['NSUserTrackingUsageDescription'])]);
    expect(result.code).toBe(1);
    expect(result.out).toContain(
      'ATTrackingManager → Frameworks/libTracker.dylib → no key allowed → forbidden',
    );
    expect(result.err).toContain('ATTrackingManager');
  });

  it('ignores files that are not Mach-O binaries: a framework resource and a text .dylib', () => {
    const appDir = makeApp({
      [EXECUTABLE]: machO(),
      'Frameworks/Notes.framework/Notes': machO(),
      'Frameworks/Notes.framework/notes.txt': 'ATTrackingManager CLLocationManager',
      'Frameworks/libnotes.dylib': 'ATTrackingManager CLLocationManager',
      'main.jsbundle': 'ATTrackingManager',
    });
    const result = scan([appDir, '--plist', plistFile([])]);
    expect(result.code).toBe(0);
    expect(result.out).toContain('Skipped (not a Mach-O binary): Frameworks/libnotes.dylib');
    expect(result.out).toContain('Scanned 2 binaries');
  });

  it('finds a symbol that straddles a read boundary in a real-size chunk', () => {
    const symbol = 'SFSpeechRecognizer';
    const start = CHUNK_BYTES - 7;
    const big = Buffer.concat([
      MACH_O_64,
      Buffer.alloc(start - MACH_O_64.length, FILLER),
      Buffer.from(symbol, 'latin1'),
      Buffer.alloc(64, FILLER),
    ]);
    const appDir = makeApp({ [EXECUTABLE]: machO(), 'Frameworks/Speech.framework/Speech': big });
    const result = scan([appDir, '--plist', plistFile([])]);
    expect(result.code).toBe(1);
    expect(result.err).toContain(`${symbol} in Frameworks/Speech.framework/Speech`);
    expect(result.err).toContain('NSSpeechRecognitionUsageDescription missing');
  });

  it('notes app extensions, which it does not scan', () => {
    const appDir = makeApp({
      [EXECUTABLE]: machO(),
      'PlugIns/Share.appex/Share': machO('CNContactStore'),
    });
    const result = scan([appDir, '--plist', plistFile([])]);
    expect(result.code).toBe(0);
    expect(result.out).toContain(
      'Not scanned (an app extension, own Info.plist): PlugIns/Share.appex',
    );
  });

  it("reads the bundle's Info.plist with plutil where there is one, else asks for --plist", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>${EXECUTABLE}</string>
<key>NSFaceIDUsageDescription</key><string>Automatos Go asks for Face ID.</string></dict></plist>`;
    const appDir = makeApp({ [EXECUTABLE]: machO('LAContext'), 'Info.plist': xml });
    const result = scan([appDir]);
    const hasPlutil = spawnSync('plutil', ['-help']).error === undefined;
    expect(result.code).toBe(hasPlutil ? 0 : 2);
    expect(hasPlutil ? result.out : result.err).toContain(hasPlutil ? 'via plutil' : '--plist');
  });

  it('exits 2 when it cannot scan: bad arguments, no target, no main executable', () => {
    expect(scan([]).code).toBe(2);
    expect(scan(['a.ipa', 'b.ipa']).code).toBe(2);
    expect(scan(['x.app', '--plist']).code).toBe(2);
    expect(scan([path.join(scratch, 'missing.ipa')]).err).toContain('does not exist');
    const noMain = makeApp({ 'Frameworks/libx.dylib': machO() });
    expect(scan([noMain, '--plist', plistFile([])]).err).toContain('main executable');
    expect(scan(['--help']).code).toBe(0);
  });
});

describe('scan-ipa.mjs on an .ipa', () => {
  it('extracts it with unzip into a temp folder and removes the folder after a PASS or a FAIL', () => {
    const tmpRoot = freshDir();
    const passing = makeIpa({
      [EXECUTABLE]: machO('LAContext'),
      'Frameworks/hermes.framework/hermes': machO(),
    });
    const ok = scan([passing, '--plist', plistFile(['NSFaceIDUsageDescription'])], tmpRoot);
    expect(ok.code).toBe(0);
    expect(ok.out).toContain(`Extracting ${passing} to ${path.join(tmpRoot, 'scan-ipa-')}`);
    expect(readdirSync(tmpRoot)).toEqual([]);
    const failing = makeIpa({ [EXECUTABLE]: machO('ATTrackingManager') });
    expect(scan([failing, '--plist', plistFile([])], tmpRoot).code).toBe(1);
    expect(readdirSync(tmpRoot)).toEqual([]);
  });

  it('removes the temp folder when the .ipa holds no app (exit 2)', () => {
    const tmpRoot = freshDir();
    const empty = path.join(freshDir(), 'empty.ipa');
    writeFileSync(empty, storedZip({ 'Payload/readme.txt': Buffer.from('no app') }));
    const result = scan([empty, '--plist', plistFile([])], tmpRoot);
    expect(result.code).toBe(2);
    expect(result.err).toContain('Payload/*.app');
    expect(readdirSync(tmpRoot)).toEqual([]);
  });

  it('runs as a command: exit codes from node, the temp folder under TMPDIR removed', () => {
    const tmpRoot = freshDir();
    const ipa = makeIpa({ [EXECUTABLE]: machO('PHPhotoLibrary') });
    const command = (keys: readonly string[]) =>
      spawnSync(process.execPath, [SCRIPT, ipa, '--plist', plistFile(keys)], {
        encoding: 'utf8',
        env: { ...process.env, TMPDIR: tmpRoot },
      });
    const failed = command([]);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain('NSPhotoLibraryUsageDescription missing');
    expect(command(['NSPhotoLibraryUsageDescription']).status).toBe(0);
    expect(readdirSync(tmpRoot)).toEqual([]);
  });
});

describe('scanBinary reads in chunks without missing a name cut in two', () => {
  it.each([4, 32])('finds the symbol at every cut, with %i-byte chunks', (chunk) => {
    const symbol = 'SFSpeechRecognizer';
    const dir = freshDir();
    for (let cut = 1; cut < symbol.length; cut += 1) {
      const file = path.join(dir, `cut-${cut}`);
      const lead = Buffer.alloc(chunk * symbol.length - cut, FILLER);
      writeFileSync(file, Buffer.concat([lead, Buffer.from(symbol), Buffer.alloc(chunk, FILLER)]));
      expect(scanBinary(file, [symbol, 'PHAsset'], chunk), `cut ${cut}`).toEqual(new Set([symbol]));
    }
  });

  it('finds nothing in a file without the names', () => {
    const file = path.join(freshDir(), 'clean');
    writeFileSync(file, machO('PHAsse', 'SFSpeech'));
    expect(scanBinary(file, ['PHAsset', 'SFSpeechRecognizer'], 8)).toEqual(new Set());
  });
});

describe('scan-ipa.mjs never touches the network', () => {
  it('imports only local Node modules and runs only plutil and unzip', () => {
    const source = readRepoFile('scripts/release/scan-ipa.mjs');
    const imports = [...source.matchAll(/from '([^']+)'/g)].map(([, name]) => name).sort();
    expect(imports).toEqual([
      'node:buffer',
      'node:child_process',
      'node:fs',
      'node:os',
      'node:path',
      'node:process',
      'node:url',
    ]);
    const spawned = [...source.matchAll(/spawnSync\('([^']+)'/g)].map(([, name]) => name).sort();
    expect(spawned).toEqual(['plutil', 'unzip']);
    expect(source).not.toMatch(/\bfetch\(|https?:\/\/|node:(https?|net|tls|dgram)/);
  });
});

// ── The symbol list, in step with the foundation's records ────────────────────────────────

describe('usage-symbols.json (KR12)', () => {
  const { symbols } = readUsageSymbols();
  const byName = new Map(symbols.map((entry) => [entry.symbol, entry]));
  const usage = readIosUsageKeys().keys;

  it('fits its schema, lists each symbol once, and is the file the script loads', () => {
    expect(byName.size).toBe(symbols.length);
    expect(path.relative(path.join(__dirname, '..', '..'), SYMBOLS_PATH)).toBe(USAGE_SYMBOLS_PATH);
    expect(loadSymbols().map((entry) => entry.symbol)).toEqual([...byName.keys()]);
  });

  it("maps every symbol of the AC's list to its key(s), ATTrackingManager forbidden", () => {
    for (const [symbol, keys] of Object.entries(AC_REQUIRED)) {
      const entry = byName.get(symbol);
      expect(entry, symbol).toBeDefined();
      if (keys === 'forbidden') expect(entry?.forbidden, symbol).toBe(true);
      else expect(entry?.keys, symbol).toEqual(expect.arrayContaining([...keys]));
    }
  });

  it('the script refuses a malformed list: not a usage key, or a forbidden entry with keys', () => {
    const file = path.join(freshDir(), 'symbols.json');
    const write = (entry: object) => writeFileSync(file, JSON.stringify({ symbols: [entry] }));
    write({ symbol: 'PHAsset', keys: ['Photos'] });
    expect(() => loadSymbols(file)).toThrow(ScanError);
    write({
      symbol: 'ATTrackingManager',
      keys: ['NSUserTrackingUsageDescription'],
      forbidden: true,
    });
    expect(() => loadSymbols(file)).toThrow(ScanError);
  });

  it("covers every class ios-usage-keys.json (so docs/native-modules.md's table) maps to a key", () => {
    for (const { key, needs } of usage) {
      for (const need of needs) {
        const entry = symbolForDocClass(symbols, neededSymbol(need));
        expect(entry, need).toBeDefined();
        expect(entry?.framework, need).toBe(need.split(':')[0]);
        expect(entry?.keys, need).toContain(key);
      }
    }
  });

  it('covers every class docs/native-modules.md checked and found unreferenced (no key today)', () => {
    const doc = readRepoFile('docs/native-modules.md');
    const section = sectionStartingWith(doc, 'Symbols and usage keys');
    const start = section.indexOf('Checked and referenced');
    const list = section.slice(start, section.indexOf('How it was checked', start));
    const heads = list
      .split(/\n- /)
      .slice(1)
      .map((bullet) => bullet.slice(0, bullet.indexOf(':')));
    const classes = heads.flatMap((head) =>
      [...head.matchAll(/`([^`]+)`/g)].map(([, name]) => name).filter((name) => !/^NS/.test(name)),
    );
    expect(classes).toEqual(expect.arrayContaining(['CLLocationManager', 'ATTrackingManager']));
    for (const name of classes) expect(byName.has(name), name).toBe(true);
  });

  it("passes today's keys with every reference the foundation found; fails what they miss", () => {
    const referenced = usage.flatMap(({ needs }) =>
      needs.map((need) => symbolForDocClass(symbols, neededSymbol(need))?.symbol ?? need),
    );
    const plist = plistFile(usage.map((entry) => entry.key));
    expect(scan([makeApp({ [EXECUTABLE]: machO(...referenced) }), '--plist', plist]).code).toBe(0);
    const keys = new Set(usage.map((entry) => entry.key));
    const uncovered = symbols.filter(
      (entry) => entry.forbidden || !entry.keys.every((key) => keys.has(key)),
    );
    expect(uncovered.map((entry) => entry.symbol)).toContain('CLLocationManager');
    for (const { symbol } of uncovered) {
      const result = scan([makeApp({ [EXECUTABLE]: machO(symbol) }), '--plist', plist]);
      expect(result.code, symbol).toBe(1);
    }
  });
});
