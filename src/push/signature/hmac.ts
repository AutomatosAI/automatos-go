// HMAC-SHA256 per RFC 2104 over an injected SHA-256 (KP6 = W2 K9): the phone passes expo-crypto's
// native digest (sha256-native.ts), the tests pass node:crypto's createHash. Pure: no React, React
// Native or Expo, and no state.

/** A SHA-256 digest of bytes: 32 bytes. */
export type Sha256 = (bytes: Uint8Array) => Promise<Uint8Array>;

/** SHA-256's block size (RFC 2104 'B'); a longer key is hashed first. */
const BLOCK_BYTES = 64;
const INNER_PAD = 0x36;
const OUTER_PAD = 0x5c;
const HEX_RADIX = 16;

function concat(first: Uint8Array, second: Uint8Array): Uint8Array {
  const joined = new Uint8Array(first.length + second.length);
  joined.set(first);
  joined.set(second, first.length);
  return joined;
}

/** The key as one block: hashed when longer than a block, then zero-padded to 64 bytes. */
async function blockKey(key: Uint8Array, sha256: Sha256): Promise<Uint8Array> {
  const short = key.length > BLOCK_BYTES ? await sha256(key) : key;
  const block = new Uint8Array(BLOCK_BYTES);
  block.set(short);
  return block;
}

function padded(block: Uint8Array, pad: number): Uint8Array {
  return block.map((byte) => byte ^ pad);
}

/** HMAC-SHA256(key, message) = H((K' ⊕ opad) ‖ H((K' ⊕ ipad) ‖ message)). */
export async function hmacSha256(
  key: Uint8Array,
  message: Uint8Array,
  sha256: Sha256,
): Promise<Uint8Array> {
  const block = await blockKey(key, sha256);
  const inner = await sha256(concat(padded(block, INNER_PAD), message));
  return sha256(concat(padded(block, OUTER_PAD), inner));
}

/** Lowercase hex, two characters a byte. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(2, '0')).join('');
}
