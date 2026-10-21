// This install's id (KC9; POST /pair's install_id): 16 random bytes from expo-crypto as base64url,
// made once and kept in expo-secure-store, so pairing this phone again reuses its row in Studio
// instead of adding one. It is the one keychain item deliberately OUTSIDE the app's key registry
// (src/lib/secure-keys.ts): sign-out, Forget this server and the reinstall wipe delete every
// registered item, and this one survives them all. It is written with the app's keychain options
// (this phone only, after first unlock), so a backup restored onto another phone does not carry it.
// The keychain and the random source are injected; tests pass fakes.

import { getRandomBytesAsync } from 'expo-crypto';

import { logger } from '../lib/logger';
import type { AsyncSecureStore, Keychain } from '../lib/secure-keys';
import { keychain as appKeychain } from '../lib/secure-store';
import { INSTALL_ID_BYTES, INSTALL_ID_ITEM } from './config';

/** The server's install_id rule (automatos-ai api/mobile_devices.py INSTALL_ID_PATTERN). */
export const INSTALL_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export type InstallIdDeps = {
  readonly keychain: Keychain;
  readonly randomBytes: (byteCount: number) => Promise<Uint8Array>;
};

const NATIVE: InstallIdDeps = Object.freeze({
  keychain: appKeychain,
  randomBytes: getRandomBytesAsync,
});

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const BYTE_BITS = 8;
const CHARACTER_BITS = 6;
const CHARACTER_MASK = 0b111111;
/** Three bytes are four characters; a last, shorter group has no padding. */
const GROUP_BYTES = 3;
const GROUP_BITS = GROUP_BYTES * BYTE_BITS;

function groupCharacters(bytes: Uint8Array, start: number): string {
  // past the end a Uint8Array reads undefined: those bits are zero and their characters dropped
  const group =
    ((bytes[start] ?? 0) << (2 * BYTE_BITS)) |
    ((bytes[start + 1] ?? 0) << BYTE_BITS) |
    (bytes[start + 2] ?? 0);
  const count = Math.min(GROUP_BYTES, bytes.length - start);
  const characters = Math.ceil((count * BYTE_BITS) / CHARACTER_BITS);
  return Array.from({ length: characters }, (_, index) => {
    const shift = GROUP_BITS - CHARACTER_BITS * (index + 1);
    return BASE64URL_ALPHABET[(group >> shift) & CHARACTER_MASK];
  }).join('');
}

/** RFC 4648 §5 base64url without padding (16 bytes → 22 characters). */
export function base64url(bytes: Uint8Array): string {
  const groups = Math.ceil(bytes.length / GROUP_BYTES);
  return Array.from({ length: groups }, (_, group) =>
    groupCharacters(bytes, group * GROUP_BYTES),
  ).join('');
}

async function newInstallId(randomBytes: InstallIdDeps['randomBytes']): Promise<string> {
  const bytes = await randomBytes(INSTALL_ID_BYTES);
  if (bytes.length !== INSTALL_ID_BYTES) throw new RangeError('the random source fell short');
  return base64url(bytes);
}

async function readOrCreate({ keychain, randomBytes }: InstallIdDeps): Promise<string> {
  const stored = await keychain.store.getItemAsync(INSTALL_ID_ITEM, keychain.options);
  if (stored !== null && INSTALL_ID_PATTERN.test(stored)) return stored;
  if (stored !== null) logger.warn('[connect] the install id is unreadable; making a new one');
  const id = await newInstallId(randomBytes);
  await keychain.store.setItemAsync(INSTALL_ID_ITEM, id, keychain.options);
  return id;
}

/** Calls that overlap on a first launch share one read, so the id is made once. */
const inFlight = new WeakMap<AsyncSecureStore, Promise<string>>();

/** This install's id; a keychain failure throws, before any code is sent to a server. */
export function getInstallId(deps: InstallIdDeps = NATIVE): Promise<string> {
  const store = deps.keychain.store;
  const running = inFlight.get(store);
  if (running) return running;
  const next = readOrCreate(deps).finally(() => inFlight.delete(store));
  inFlight.set(store, next);
  return next;
}
