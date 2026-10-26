// R10 / KR9 as a test that keeps running in CI: every keychain item the app writes is in ONE
// registry (src/storage/secure-registry.ts), named there and nowhere else, and written this phone
// only. The whole product tree is read through its syntax tree (support/keychain-calls.ts): every
// expo-secure-store import, every call that reaches the keychain (the module, the SecureKeyStore
// port, the key registry) and the key it passes, every keychainAccessible value and keychain
// class, every string literal. A file that writes the keychain with a key of its own, a literal
// key, a weaker class or no options fails here with its path and line.
// src/release/__tests__/user-data.test.ts proves what the registry's lists do at sign-out and at
// the first launch after a reinstall.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isSecureKey } from '../../lib/secure-keys';
import {
  CLERK_CLIENT_ITEM,
  INSTALL_ID_ITEM,
  SECURE_KEYS,
  type SecureKeyEntry,
} from '../../storage/secure-registry';
import {
  SECURE_STORE_MODULE,
  exportedStrings,
  scanKeychain,
  type KeychainCall,
} from './support/keychain-calls';
import { productFiles, repoRoot } from './support/tree';

const REGISTRY_FILE = 'src/storage/secure-registry.ts';
/** The two files wired to the native module (the one keychain options object, the MMKV key). */
const ADAPTERS: readonly string[] = ['src/lib/secure-store.ts', 'src/storage/mmkv.ts'];
/** The classes that never leave this phone (KR9): no iCloud Keychain, no backup onto another. */
const DEVICE_ONLY: readonly string[] = [
  'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
];
/** The options a raw keychain write may pass: the app's KEYCHAIN_OPTIONS, under its names. */
const WRITE_OPTIONS: readonly string[] = [
  'options',
  'KEYCHAIN_OPTIONS',
  'keychain.options',
  'registry.options',
];

type Forwarder = Readonly<{ file: string; arg: string; reason: string }>;

/** Calls that pass on a key they were given; who gives it is audited here too. */
const FORWARDERS: readonly Forwarder[] = [
  {
    file: 'src/lib/secure-keys.ts',
    arg: 'key',
    reason: "The registry's own write, remove and wipe: the key its caller passed.",
  },
  {
    file: 'src/lib/secure-keys.ts',
    arg: 'checkedKey(key)',
    reason: "The registry's read: the caller's key, checked against expo-secure-store's rule.",
  },
  {
    file: 'src/storage/mmkv.ts',
    arg: 'key',
    reason: "The SecureKeyStore adapter: encrypted-storage.ts's STORAGE_KEY_ITEM.",
  },
  {
    file: 'src/auth/token-cache.ts',
    arg: 'key',
    reason: "Clerk's own key: the registry's write names it in the index before the item.",
  },
  {
    file: REGISTRY_FILE,
    arg: 'key',
    reason: 'clearUserKeys deletes what the registry lists.',
  },
];

/** Raw keychain writes with no options: a port whose one adapter adds them. */
const PORT_WRITES: readonly Readonly<{ file: string; receiver: string; reason: string }>[] = [
  {
    file: 'src/storage/encrypted-storage.ts',
    receiver: 'deps.secureStore',
    reason: 'SecureKeyStore: its one adapter, src/storage/mmkv.ts, writes with KEYCHAIN_OPTIONS.',
  },
];

const products = productFiles();
const scans = products.map(scanKeychain);
const calls = scans.flatMap((scan) => scan.calls);
/** The registry's constants: NAME → key. */
const names = exportedStrings(REGISTRY_FILE);
const nameOf = (key: string) => [...names].find(([, value]) => value === key)?.[0];
const where = (found: { file: string; line: number }) => `${found.file}:${found.line}`;

function isForwarded(call: KeychainCall): boolean {
  return FORWARDERS.some((entry) => entry.file === call.file && entry.arg === call.args[0]);
}

describe('the registry (src/storage/secure-registry.ts)', () => {
  it('lists each key once, by a constant of its own, with a valid name, an owner and a reason', () => {
    const keys = SECURE_KEYS.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    SECURE_KEYS.forEach((entry: SecureKeyEntry) => {
      expect(isSecureKey(entry.key), entry.key).toBe(true);
      expect(nameOf(entry.key), entry.key).toBeDefined();
      expect(products, entry.key).toContain(entry.owner);
      expect(entry.reason.length, entry.key).toBeGreaterThan(30);
    });
  });

  it('keeps one item through a reinstall, the install id, and it is not the person’s', () => {
    const survivors = SECURE_KEYS.filter((entry) => entry.survivesReinstall);
    expect(survivors.map((entry) => entry.key)).toEqual([INSTALL_ID_ITEM]);
    expect(SECURE_KEYS.filter((entry) => entry.userBound && entry.survivesReinstall)).toEqual([]);
  });

  it('names each key in that file only: no other product file spells one', () => {
    const keys = new Set(SECURE_KEYS.map((entry) => entry.key));
    const spelled = scans
      .filter((scan) => scan.file !== REGISTRY_FILE)
      .flatMap((scan) => scan.literals.filter((literal) => keys.has(literal.value)))
      .map((literal) => `${where(literal)} '${literal.value}'`);
    expect(spelled).toEqual([]);
  });
});

describe('every keychain call in the product tree', () => {
  it('is found by the scan (the audit reads what it claims to)', () => {
    expect(products.length).toBeGreaterThan(300);
    const files = new Set(calls.map((call) => call.file));
    for (const owner of SECURE_KEYS.map((entry) => entry.owner)) expect(files).toContain(owner);
    expect(calls.filter((call) => call.kind === 'native').length).toBeGreaterThan(5);
  });

  it('imports expo-secure-store as a module only in the two adapters; elsewhere a class or types', () => {
    const imports = scans.flatMap((scan) => scan.imports);
    const modules = imports.filter((found) => found.namespace !== null && !found.typeOnly);
    expect(modules.map((found) => found.file).sort()).toEqual([...ADAPTERS].sort());
    const values = imports.flatMap((found) => found.values.map((name) => ({ ...found, name })));
    const loose = values.filter((found) => !DEVICE_ONLY.includes(found.name));
    expect(loose.map((found) => `${where(found)} ${found.name}`)).toEqual([]);
  });

  it('passes a registry key, or one it was given, and never a literal', () => {
    const wrong = calls
      .filter((call) => !names.has(call.args[0] ?? '') && !isForwarded(call))
      .map((call) => `${where(call)} ${call.receiver}.${call.method}(${call.args[0] ?? ''})`);
    expect(wrong).toEqual([]);
  });

  it('leaves no registry entry unused: its owner calls the keychain with it', () => {
    const stale = SECURE_KEYS.filter((entry) => entry.key !== CLERK_CLIENT_ITEM)
      .filter((entry) => {
        const name = nameOf(entry.key);
        return !calls.some((call) => call.file === entry.owner && call.args[0] === name);
      })
      .map((entry) => `${entry.key} (${entry.owner})`);
    expect(stale).toEqual([]);
  });

  it("Clerk's item is the key @clerk/expo asks for; its token cache goes only through the registry", () => {
    const constants = readFileSync(
      path.join(repoRoot(), 'node_modules/@clerk/expo/dist/constants.js'),
      'utf8',
    );
    expect(constants).toContain(`const CLERK_CLIENT_JWT_KEY = "${CLERK_CLIENT_ITEM}";`);
    const cache = calls.filter((call) => call.file === 'src/auth/token-cache.ts');
    expect(cache.map((call) => `${call.kind}:${call.method}`).sort()).toEqual([
      'registry:read',
      'registry:remove',
      'registry:write',
    ]);
  });
});

describe('every keychain write is this phone only', () => {
  it('passes the app’s keychain options, or goes through a port whose adapter adds them', () => {
    const writes = calls.filter((call) => call.kind !== 'registry' && /^setItem/.test(call.method));
    expect(writes.length).toBeGreaterThan(3);
    const bare = writes
      .filter((call) => !WRITE_OPTIONS.includes(call.args[2] ?? ''))
      .filter(
        (call) =>
          !PORT_WRITES.some((port) => port.file === call.file && port.receiver === call.receiver),
      )
      .map((call) => `${where(call)} ${call.receiver}.${call.method}(…${call.args.length} args)`);
    expect(bare).toEqual([]);
  });

  it('sets keychainAccessible once, to a THIS_DEVICE_ONLY class, and names no other class', () => {
    const accessible = scans.flatMap((scan) => scan.accessible);
    expect(accessible.map((found) => [found.file, found.value])).toEqual([
      ['src/lib/secure-store.ts', `SecureStore.${DEVICE_ONLY[0]}`],
    ]);
    const weaker = scans
      .flatMap((scan) => scan.classes)
      .filter((found) => !DEVICE_ONLY.includes(found.name))
      .map((found) => `${where(found)} ${found.name}`);
    expect(weaker).toEqual([]);
  });

  it(`keeps ${SECURE_STORE_MODULE} out of the token cache and the stores (they use the registry)`, () => {
    const direct = scans
      .filter((scan) => scan.imports.some((found) => !found.typeOnly && found.namespace !== null))
      .map((scan) => scan.file);
    expect(direct).not.toContain('src/auth/token-cache.ts');
    expect(direct).not.toContain('src/connect/device-store.ts');
    expect(direct).not.toContain('src/push/registration/key-store.ts');
  });
});
