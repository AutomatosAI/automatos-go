// Synthetic iOS bundles for the IPA symbol scan's test (test-only, US-021h): fake Mach-O binaries
// with planted symbol names, an Info.plist as the JSON `plutil -convert json` prints, and an .ipa
// written as a stored (uncompressed) zip that the system unzip extracts. Nothing here needs Xcode
// or a real build.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** The main executable's name in every synthetic bundle (its Info.plist's CFBundleExecutable). */
export const EXECUTABLE = 'AutomatosGo';
/** MH_MAGIC_64 as it sits on disk (little-endian): what an arm64 binary starts with. */
export const MACH_O_64 = Buffer.from([0xcf, 0xfa, 0xed, 0xfe]);
export const FILLER = 0x2e;

export type BundleFiles = Readonly<Record<string, Buffer | string>>;

/** A fake Mach-O: the header magic, filler, then each symbol as a binary names an imported class. */
export function machO(...symbols: string[]): Buffer {
  const names = symbols.map((symbol) => Buffer.from(`\0_OBJC_CLASS_$_${symbol}\0`, 'latin1'));
  return Buffer.concat([MACH_O_64, Buffer.alloc(64, FILLER), ...names]);
}

/** Writes files (path inside the .app → bytes) into dir/AutomatosGo.app; returns the .app path. */
export function writeApp(dir: string, files: BundleFiles): string {
  const appDir = path.join(dir, `${EXECUTABLE}.app`);
  for (const [rel, bytes] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(appDir, rel)), { recursive: true });
    writeFileSync(path.join(appDir, rel), bytes);
  }
  return appDir;
}

/** dir/Info.plist.json: the executable's name and a test string for each usage key. */
export function writePlistJson(dir: string, keys: readonly string[]): string {
  const plist = Object.fromEntries([
    ['CFBundleExecutable', EXECUTABLE],
    ...keys.map((key) => [key, `Automatos Go uses this for a test (${key}).`]),
  ]);
  const file = path.join(dir, 'Info.plist.json');
  writeFileSync(file, JSON.stringify(plist));
  return file;
}

// ── A stored zip ────────────────────────────────────────────────────────────────────────────

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type ZipRecord = Readonly<{ name: Buffer; data: Buffer; crc: number }>;

const DOS_DATE_1980 = 0x21;
const ZIP_VERSION = 20;

function localEntry({ name, data, crc }: ZipRecord): Buffer {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(ZIP_VERSION, 4);
  header.writeUInt16LE(DOS_DATE_1980, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  return Buffer.concat([header, name, data]);
}

function centralEntry({ name, data, crc }: ZipRecord, offset: number): Buffer {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(ZIP_VERSION, 4);
  header.writeUInt16LE(ZIP_VERSION, 6);
  header.writeUInt16LE(DOS_DATE_1980, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, name]);
}

/** A zip of the entries (zip path → bytes), stored without compression. */
export function storedZip(entries: Readonly<Record<string, Buffer>>): Buffer {
  const records = Object.entries(entries).map(([name, data]) => ({
    name: Buffer.from(name),
    data,
    crc: crc32(data),
  }));
  const locals = records.map(localEntry);
  const offsetOf = (index: number) =>
    locals.slice(0, index).reduce((sum, local) => sum + local.length, 0);
  const central = Buffer.concat(
    records.map((record, index) => centralEntry(record, offsetOf(index))),
  );
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(records.length, 8);
  end.writeUInt16LE(records.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offsetOf(locals.length), 16);
  return Buffer.concat([...locals, central, end]);
}

/** dir/automatos-go.ipa holding the files under Payload/AutomatosGo.app/; returns its path. */
export function writeIpa(dir: string, files: Readonly<Record<string, Buffer>>): string {
  const prefixed = Object.fromEntries(
    Object.entries(files).map(([rel, bytes]) => [`Payload/${EXECUTABLE}.app/${rel}`, bytes]),
  );
  const ipa = path.join(dir, 'automatos-go.ipa');
  writeFileSync(ipa, storedZip(prefixed));
  return ipa;
}
