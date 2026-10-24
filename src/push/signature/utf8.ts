// A string's UTF-8 bytes, without the global TextEncoder (Hermes builds differ in what they ship).
// The signed message and the push key are hashed as UTF-8 (KP6 = W2 K9), so this must equal
// Buffer.from(text, 'utf8') byte for byte: a lone surrogate becomes U+FFFD (EF BF BD), as
// TextEncoder does. Pure: no React, React Native or Expo.

const REPLACEMENT_CHARACTER = 0xfffd;
const SURROGATE_FIRST = 0xd800;
const SURROGATE_LAST = 0xdfff;
const ONE_BYTE_LIMIT = 0x80;
const TWO_BYTE_LIMIT = 0x800;
const THREE_BYTE_LIMIT = 0x10000;
const CONTINUATION = 0x80;
const SIX_BITS = 0x3f;

function continuation(codePoint: number, shift: number): number {
  return CONTINUATION | ((codePoint >> shift) & SIX_BITS);
}

/** One code point's UTF-8 bytes (1 to 4). */
function encodeCodePoint(codePoint: number): readonly number[] {
  if (codePoint < ONE_BYTE_LIMIT) return [codePoint];
  if (codePoint < TWO_BYTE_LIMIT) return [0xc0 | (codePoint >> 6), continuation(codePoint, 0)];
  if (codePoint < THREE_BYTE_LIMIT) {
    return [0xe0 | (codePoint >> 12), continuation(codePoint, 6), continuation(codePoint, 0)];
  }
  return [
    0xf0 | (codePoint >> 18),
    continuation(codePoint, 12),
    continuation(codePoint, 6),
    continuation(codePoint, 0),
  ];
}

function isSurrogate(codePoint: number): boolean {
  return codePoint >= SURROGATE_FIRST && codePoint <= SURROGATE_LAST;
}

/** The UTF-8 bytes of text. A string iterates by code point, so a lone surrogate comes alone. */
export function utf8Bytes(text: string): Uint8Array {
  const bytes = Array.from(text).flatMap((char) => {
    const codePoint = char.codePointAt(0) ?? REPLACEMENT_CHARACTER;
    return encodeCodePoint(isSurrogate(codePoint) ? REPLACEMENT_CHARACTER : codePoint);
  });
  return Uint8Array.from(bytes);
}
