// The parts of the signature check (KP6 = W2 K9): UTF-8 bytes equal to Buffer.from(text, 'utf8');
// HMAC-SHA256 against RFC 4231 and node:crypto's createHmac; the canonical message exactly as
// W2's json.dumps(separators=(',', ':'), ensure_ascii=False) writes it; and, read from the source,
// expo-crypto in sha256-native.ts only, no test importing it, no logger and no TextEncoder.

import { createHash, createHmac } from 'node:crypto';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { signedMessage } from '../signature/canonical';
import { hmacSha256, toHex, type Sha256 } from '../signature/hmac';
import { utf8Bytes } from '../signature/utf8';
import { FULL, IAT, MINIMAL, WS } from './data-fixtures';
import { importsOf, sources } from './source-files';

const PUSH_DIR = path.resolve(__dirname, '..');
const SIGNATURE_DIR = path.join(PUSH_DIR, 'signature');

const nodeSha256: Sha256 = async (bytes) =>
  new Uint8Array(createHash('sha256').update(bytes).digest());

/** Deterministic bytes: a SHA-256 chain from a seed, cut to length. */
function seededBytes(seed: string, length: number): Uint8Array {
  const chunks: Buffer[] = [];
  let block = createHash('sha256').update(seed).digest();
  while (chunks.length * block.length < length) {
    chunks.push(block);
    block = createHash('sha256').update(block).digest();
  }
  return new Uint8Array(Buffer.concat(chunks).subarray(0, length));
}

describe('utf8Bytes', () => {
  it.each([
    ['ASCII', 'Ship the Lisbon deck?'],
    ['the empty string', ''],
    ['accented Latin', 'Publicar às 09:00 — café, Não'],
    ['CJK', '会议改到明天吗？'],
    ['an astral emoji', 'Done ☕ 🚀 👩🏽‍💻'],
    ['control characters', 'line\none\ttab\u0000\u007f'],
    ['every boundary', '\u007f\u0080߿ࠀ￿\u{10000}\u{10ffff}'],
  ])('%s equals Buffer.from(text, "utf8")', (_name, text) => {
    expect(Buffer.from(utf8Bytes(text))).toEqual(Buffer.from(text, 'utf8'));
  });

  it.each([
    ['a lone high surrogate', 'a\ud83db'],
    ['a lone low surrogate', 'a\ude80b'],
    ['a high surrogate at the end', 'end\ud83d'],
    ['two high surrogates', '\ud83d\ud83d'],
  ])('%s becomes EF BF BD, as TextEncoder does', (_name, text) => {
    const bytes = utf8Bytes(text);
    expect(toHex(bytes)).toContain('efbfbd');
    expect(Buffer.from(bytes)).toEqual(Buffer.from(new TextEncoder().encode(text)));
  });
});

describe('hmacSha256 (RFC 2104) over an injected SHA-256', () => {
  const ascii = (text: string) => new Uint8Array(Buffer.from(text, 'ascii'));
  const filled = (length: number, byte: number) => new Uint8Array(length).fill(byte);

  it.each([
    [
      'RFC 4231 case 1',
      filled(20, 0x0b),
      ascii('Hi There'),
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    ],
    [
      'RFC 4231 case 2',
      ascii('Jefe'),
      ascii('what do ya want for nothing?'),
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    ],
    [
      'RFC 4231 case 3',
      filled(20, 0xaa),
      filled(50, 0xdd),
      '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe',
    ],
    [
      'RFC 4231 case 6 (a 131-byte key, hashed first)',
      filled(131, 0xaa),
      ascii('Test Using Larger Than Block-Size Key - Hash Key First'),
      '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
    ],
  ])('%s', async (_name, key, message, expected) => {
    expect(toHex(await hmacSha256(key, message, nodeSha256))).toBe(expected);
  });

  it('200 seeded keys (0 to 149 bytes, across the 64-byte block) and messages equal createHmac', async () => {
    const cases = Array.from({ length: 200 }, (_, index) => ({
      key: seededBytes(`key-${index}`, index % 150),
      message: seededBytes(`message-${index}`, (index * 7) % 300),
    }));
    const results = await Promise.all(
      cases.map(async ({ key, message }) => ({
        ours: toHex(await hmacSha256(key, message, nodeSha256)),
        node: createHmac('sha256', key).update(message).digest('hex'),
      })),
    );
    expect(results.every(({ ours, node }) => ours === node)).toBe(true);
    expect(results.filter(({ ours, node }) => ours !== node)).toEqual([]);
  });

  it('does not change the key or the message it is given', async () => {
    const key = filled(80, 0x11);
    const message = filled(10, 0x22);
    await hmacSha256(key, message, nodeSha256);
    expect([key.every((b) => b === 0x11), message.every((b) => b === 0x22)]).toEqual([true, true]);
  });

  it('toHex writes lowercase, two characters a byte', () => {
    expect(toHex(Uint8Array.from([0, 9, 10, 171, 255]))).toBe('00090aabff');
  });
});

describe('the canonical message (KP6 = W2 K9)', () => {
  it('a full payload: the fixed order, compact separators, iat an integer', () => {
    expect(signedMessage(FULL)).toBe(
      `["v2","needs_answer","${WS}","1001","42","question","42","0419",` +
        `"Ship the Lisbon deck?",["Yes","No","Later"],${IAT}]`,
    );
  });

  it('a field the payload omits is "", absent options are []', () => {
    expect(signedMessage(MINIMAL)).toBe(
      `["v2","auto_message","${WS}","","","","","","",[],${IAT}]`,
    );
  });

  it('strings as received: never trimmed, non-ASCII unescaped (ensure_ascii=False)', () => {
    const message = signedMessage({ ...MINIMAL, question: '  café ☕ 🚀  ', options: [' Sim'] });
    expect(message).toContain('"  café ☕ 🚀  ",[" Sim"]');
  });

  it('escapes as json.dumps does: quotes, backslash, newline, tab and other control characters', () => {
    const message = signedMessage({ ...MINIMAL, question: 'a "b" \\ c\nd\te\u0001f\u007f' });
    expect(message).toContain('"a \\"b\\" \\\\ c\\nd\\te\\u0001f\u007f"');
  });

  it('a lone surrogate is escaped as ASCII (well-formed JSON.stringify), so it can never verify', () => {
    // W2 cannot sign one (Python's .encode('utf-8') raises on it): the phone fails closed.
    const message = signedMessage({ ...MINIMAL, question: 'a\ud800b' });
    expect(message).toContain('"a\\ud800b"');
    expect(Buffer.from(utf8Bytes(message)).toString('ascii')).toBe(message);
  });

  it('leaves sig and every unknown key out', () => {
    const otherSig = { ...FULL, sig: '0'.repeat(64), badge: 3 };
    const message = signedMessage(otherSig);
    expect(message).toBe(signedMessage(FULL));
    expect(message).not.toContain(FULL.sig);
  });
});

describe('read from the source', () => {
  const pushSources = sources(PUSH_DIR);

  it('only signature/sha256-native.ts imports expo-crypto', () => {
    const importers = pushSources
      .filter(({ text }) => importsOf(text, /^expo-crypto$/).length > 0)
      .map(({ file }) => path.relative(PUSH_DIR, file));
    expect(importers).toEqual([path.join('signature', 'sha256-native.ts')]);
  });

  it('no test imports signature/sha256-native', () => {
    const tests = pushSources.filter(({ file }) =>
      file.includes(`${path.sep}__tests__${path.sep}`),
    );
    expect(tests.filter(({ text }) => importsOf(text, /sha256-native$/).length > 0)).toEqual([]);
  });

  it('nothing in src/push/signature imports the logger or uses TextEncoder', () => {
    const signature = sources(SIGNATURE_DIR);
    expect(signature.length).toBeGreaterThanOrEqual(5);
    expect(signature.filter(({ text }) => importsOf(text, /logger/).length > 0)).toEqual([]);
    const usesTextEncoder = /(new\s+|globalThis\.|global\.)TextEncoder/;
    expect(signature.filter(({ text }) => usesTextEncoder.test(text))).toEqual([]);
  });

  it('the pure modules import no react, react-native or expo-*', () => {
    const pure = sources(SIGNATURE_DIR).filter(({ file }) => !file.endsWith('sha256-native.ts'));
    const native = /^(react|react-native|expo)(?:[-/].*)?$|^@expo\//;
    expect(pure.filter(({ text }) => importsOf(text, native).length > 0)).toEqual([]);
  });
});
