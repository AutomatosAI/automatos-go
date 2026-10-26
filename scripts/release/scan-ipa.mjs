// IPA symbol scan (US-021h, R07, KR12). App Store processing bounces a binary that references a
// privacy framework without its NS…UsageDescription (ITMS-90683), even when the app never asks.
// The CocoaPods fetched at build time (Sentry, MMKVCore, LiveKitWebRTC, the GoogleSignIn chain) are
// not in node_modules, so only the built binary tells the truth: this script byte-searches the
// main executable, every Frameworks/*.framework binary and every Frameworks/*.dylib for the
// symbols in usage-symbols.json and checks the app's Info.plist has each key they need.
//
//   node scripts/release/scan-ipa.mjs <app.ipa | path/to/X.app> [--plist <Info.plist as JSON>]
//
// Exit 0: PASS. Exit 1: a required key is missing or a forbidden symbol (ATTrackingManager) is
// referenced. Exit 2: the scan could not run. Node 22, no dependency; an .ipa is extracted with the
// system unzip into a temp folder that is removed afterwards. Nothing is uploaded or fetched.
// How to get the IPA and read the result: docs/release/ipa-scan.md.

import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Bytes read per step; a symbol cut by a step boundary is still found (the overlap below). */
export const CHUNK_BYTES = 1024 * 1024;
export const SYMBOLS_PATH = fileURLToPath(new URL('./usage-symbols.json', import.meta.url));

const USAGE =
  'usage: node scripts/release/scan-ipa.mjs <app.ipa | path/to/X.app> [--plist <Info.plist as JSON>]';
// Mach-O thin (32/64-bit) and fat headers, in both byte orders.
const MACH_O_MAGICS = new Set([
  0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca,
]);
const SYMBOL_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const PLIST_KEY = /^[A-Za-z]+UsageDescription$/;

/** A scan that cannot run: bad arguments, a missing tool or an unreadable bundle (exit 2). */
export class ScanError extends Error {}

/**
 * The symbol list, checked: each entry a searchable name with its required keys, or forbidden.
 * @returns {{ symbol: string, keys: string[], forbidden: boolean }[]}
 */
export function loadSymbols(file = SYMBOLS_PATH) {
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(parsed?.symbols) || parsed.symbols.length === 0) {
    throw new ScanError(`${file}: no symbols list`);
  }
  return parsed.symbols.map((entry) => {
    const keys = Array.isArray(entry?.keys) ? entry.keys : [];
    const forbidden = entry?.forbidden === true;
    const valid =
      SYMBOL_NAME.test(String(entry?.symbol)) &&
      keys.every((key) => PLIST_KEY.test(String(key))) &&
      (forbidden ? keys.length === 0 : keys.length > 0);
    if (!valid) throw new ScanError(`${file}: bad entry ${JSON.stringify(entry)}`);
    return Object.freeze({ symbol: entry.symbol, keys: [...keys], forbidden });
  });
}

/** @returns {{ target: string, plist: string | undefined, help: boolean }} */
export function parseArgs(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    return { target: '', plist: undefined, help: true };
  }
  const plistAt = argv.indexOf('--plist');
  const plist = plistAt === -1 ? undefined : argv[plistAt + 1];
  if (plistAt !== -1 && (plist === undefined || plist.startsWith('-'))) throw new ScanError(USAGE);
  const rest = argv.filter(
    (_, index) => plistAt === -1 || (index !== plistAt && index !== plistAt + 1),
  );
  if (rest.length !== 1 || rest[0].startsWith('-')) throw new ScanError(USAGE);
  return { target: rest[0], plist, help: false };
}

/** True when the file starts with a Mach-O header (thin or fat). */
export function isMachO(file) {
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(4);
    return readSync(fd, head, 0, 4, 0) === 4 && MACH_O_MAGICS.has(head.readUInt32BE(0));
  } finally {
    closeSync(fd);
  }
}

/** The file's bytes, chunk by chunk; each chunk is a fresh copy. */
function* chunksOf(fd, chunkBytes) {
  const buffer = Buffer.alloc(chunkBytes);
  for (;;) {
    const read = readSync(fd, buffer, 0, chunkBytes, null);
    if (read === 0) return;
    yield Buffer.from(buffer.subarray(0, read));
  }
}

/**
 * Which of the symbols the file's bytes contain. Each step searches the previous step's last
 * (longest symbol - 1) bytes too, so a name split across two reads is found.
 * @param {string} file
 * @param {readonly string[]} symbols
 * @returns {Set<string>}
 */
export function scanBinary(file, symbols, chunkBytes = CHUNK_BYTES) {
  const needles = symbols.map((symbol) => ({ symbol, bytes: Buffer.from(symbol, 'latin1') }));
  const overlap = Math.max(0, ...needles.map(({ bytes }) => bytes.length - 1));
  const found = new Set();
  const fd = openSync(file, 'r');
  try {
    let carry = Buffer.alloc(0);
    for (const chunk of chunksOf(fd, chunkBytes)) {
      const window = Buffer.concat([carry, chunk]);
      needles
        .filter(({ symbol, bytes }) => !found.has(symbol) && window.includes(bytes))
        .forEach(({ symbol }) => found.add(symbol));
      if (found.size === needles.length) break;
      carry = window.subarray(Math.max(0, window.length - overlap));
    }
  } finally {
    closeSync(fd);
  }
  return found;
}

const isFile = (file) => existsSync(file) && lstatSync(file).isFile();
const entriesOf = (dir) =>
  readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

/** A framework's Mach-O files (its binary, whatever it is named); its resources are not scanned. */
function frameworkBinaries(appDir, name) {
  const dir = path.join('Frameworks', name);
  return entriesOf(path.join(appDir, dir))
    .filter((entry) => entry.isFile() && isMachO(path.join(appDir, dir, entry.name)))
    .map((entry) => path.posix.join('Frameworks', name, entry.name));
}

/**
 * The bundle's binaries, relative to the .app: the main executable first, then Frameworks/.
 * A .dylib that is not Mach-O is skipped and reported; app extensions (PlugIns/) are noted.
 */
export function binariesOf(appDir, executable) {
  if (!isFile(path.join(appDir, executable)) || !isMachO(path.join(appDir, executable))) {
    throw new ScanError(`the main executable ${executable} is not a Mach-O file in ${appDir}`);
  }
  const frameworksDir = path.join(appDir, 'Frameworks');
  const entries = existsSync(frameworksDir) ? entriesOf(frameworksDir) : [];
  const dylibs = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.dylib'))
    .map((entry) => path.posix.join('Frameworks', entry.name));
  const isBinary = (rel) => isMachO(path.join(appDir, rel));
  const pluginsDir = path.join(appDir, 'PlugIns');
  return {
    binaries: [
      executable,
      ...entries
        .filter((entry) => entry.isDirectory() && entry.name.endsWith('.framework'))
        .flatMap((entry) => frameworkBinaries(appDir, entry.name)),
      ...dylibs.filter(isBinary),
    ],
    skipped: dylibs.filter((rel) => !isBinary(rel)),
    extensions: existsSync(pluginsDir)
      ? entriesOf(pluginsDir).map((entry) => path.posix.join('PlugIns', entry.name))
      : [],
  };
}

function parsePlistJson(text, from) {
  const plist = JSON.parse(text);
  if (plist === null || typeof plist !== 'object' || Array.isArray(plist)) {
    throw new ScanError(`${from} is not an Info.plist dictionary`);
  }
  return plist;
}

/** The app's Info.plist: --plist when given, else the bundle's own through macOS plutil. */
export function readInfoPlist(appDir, plistArg) {
  if (plistArg !== undefined) {
    const plist = parsePlistJson(readFileSync(plistArg, 'utf8'), plistArg);
    return { plist, source: `from --plist ${plistArg} (not read from the bundle)` };
  }
  const file = path.join(appDir, 'Info.plist');
  if (!isFile(file)) throw new ScanError(`no Info.plist in ${appDir}`);
  const result = spawnSync('plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8' });
  if (result.error) {
    throw new ScanError('plutil is not on this machine (it ships with macOS): pass --plist <JSON>');
  }
  if (result.status !== 0) {
    throw new ScanError(`plutil could not convert ${file}: ${result.stderr.trim()}; pass --plist`);
  }
  return { plist: parsePlistJson(result.stdout, file), source: `the bundle's own, via plutil` };
}

const hasKey = (plist, key) => typeof plist[key] === 'string' && plist[key].trim() !== '';

/**
 * One row per referenced symbol, binary and key: present, missing or forbidden.
 * @param {ReturnType<typeof loadSymbols>} symbols
 * @param {Record<string, unknown>} plist
 * @param {ReadonlyMap<string, Set<string>>} hits binary → the symbols found in it
 */
export function evaluate(symbols, plist, hits) {
  return symbols.flatMap((entry) =>
    [...hits]
      .filter(([, found]) => found.has(entry.symbol))
      .flatMap(([binary]) =>
        entry.forbidden
          ? [{ symbol: entry.symbol, binary, key: 'no key allowed', status: 'forbidden' }]
          : entry.keys.map((key) => ({
              symbol: entry.symbol,
              binary,
              key,
              status: hasKey(plist, key) ? 'present' : 'missing',
            })),
      ),
  );
}

function report(rows, symbols, scan, io) {
  const referenced = new Set(rows.map((row) => row.symbol));
  rows.forEach((row) => io.out(`  ${row.symbol} → ${row.binary} → ${row.key} → ${row.status}`));
  const unseen = symbols.filter((entry) => !referenced.has(entry.symbol));
  io.out(`Not referenced: ${unseen.map((entry) => entry.symbol).join(', ') || 'none'}`);
  scan.skipped.forEach((rel) => io.out(`Skipped (not a Mach-O binary): ${rel}`));
  scan.extensions.forEach((rel) =>
    io.out(`Not scanned (an app extension, own Info.plist): ${rel}`),
  );
  const failures = rows.filter((row) => row.status !== 'present');
  if (failures.length === 0) {
    io.out('PASS: every referenced symbol has its usage key, and nothing forbidden is referenced.');
    return 0;
  }
  failures.forEach((row) =>
    io.err(`FAIL: ${row.symbol} in ${row.binary}: ${row.key} ${row.status}`),
  );
  io.err(`FAIL: ${failures.length} problem(s); see docs/release/ipa-scan.md 'When it fails'.`);
  return 1;
}

function scanApp(appDir, plistArg, io) {
  const symbols = loadSymbols();
  const { plist, source } = readInfoPlist(appDir, plistArg);
  const executable =
    typeof plist.CFBundleExecutable === 'string' && plist.CFBundleExecutable.trim() !== ''
      ? plist.CFBundleExecutable
      : path.basename(appDir, '.app');
  const scan = binariesOf(appDir, executable);
  const names = symbols.map((entry) => entry.symbol);
  const hits = new Map(
    scan.binaries.map((rel) => [rel, scanBinary(path.join(appDir, rel), names)]),
  );
  io.out(`App: ${path.basename(appDir)}; Info.plist: ${source}`);
  io.out(`Scanned ${scan.binaries.length} binaries for ${names.length} symbols:`);
  return report(evaluate(symbols, plist, hits), symbols, scan, io);
}

/** The one Payload/*.app of an extracted .ipa. */
function payloadApp(dir) {
  const payload = path.join(dir, 'Payload');
  const apps = existsSync(payload)
    ? entriesOf(payload).filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
    : [];
  if (apps.length !== 1) {
    throw new ScanError(`expected one Payload/*.app in the .ipa, found ${apps.length}`);
  }
  return path.join(payload, apps[0].name);
}

/** Runs scan on the target .app, extracting an .ipa into a temp folder removed afterwards. */
function withApp(target, io, scan) {
  if (!existsSync(target)) throw new ScanError(`${target} does not exist`);
  if (lstatSync(target).isDirectory()) {
    if (!target.replace(/\/+$/, '').endsWith('.app')) {
      throw new ScanError(`${target} is not an .app`);
    }
    return scan(target);
  }
  const tmp = mkdtempSync(path.join(io.tmpRoot, 'scan-ipa-'));
  try {
    io.out(`Extracting ${target} to ${tmp} (removed when the scan ends)`);
    const unzip = spawnSync('unzip', ['-q', '-o', target, '-d', tmp], { encoding: 'utf8' });
    if (unzip.error) throw new ScanError('unzip is not on this machine');
    if (unzip.status !== 0) throw new ScanError(`unzip failed: ${unzip.stderr.trim()}`);
    return scan(payloadApp(tmp));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * The command: the exit code for the given arguments (0 PASS, 1 FAIL, 2 could not scan).
 * @param {readonly string[]} argv
 * @param {{ out: (line: string) => void, err: (line: string) => void, tmpRoot: string }} [io]
 * @returns {number}
 */
export function run(argv, io = defaultIo()) {
  try {
    const args = parseArgs(argv);
    if (args.help) {
      io.out(USAGE);
      return 0;
    }
    return withApp(args.target, io, (appDir) => scanApp(appDir, args.plist, io));
  } catch (error) {
    io.err(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

function defaultIo() {
  return {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
    tmpRoot: os.tmpdir(),
  };
}

// Node runs the main module from its real path, so compare real paths (a symlinked checkout).
function invokedDirectly() {
  const entry = process.argv[1];
  return (
    entry !== undefined &&
    existsSync(entry) &&
    pathToFileURL(realpathSync(entry)).href === import.meta.url
  );
}

if (invokedDirectly()) process.exitCode = run(process.argv.slice(2));
