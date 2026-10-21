import { describe, expect, it } from 'vitest';

import { PAIRING_ALPHABET } from '../config';
import { normalizePairCode } from '../pair-code';
import { PAIR_CODE_COPY } from '../strings';

/** automatos-ai core/auth/pairing.py: the alphabet every code the server mints is drawn from. */
const SERVER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function codeOf(input: string) {
  const parsed = normalizePairCode(input);
  return parsed.ok ? parsed.code : parsed.reason;
}

describe('normalizePairCode: the code the server hashed, in any form a person types (KC7)', () => {
  it("uses the server's alphabet: no O, 0, I or 1", () => {
    expect(PAIRING_ALPHABET).toBe(SERVER_ALPHABET);
    for (const character of 'O0I1') expect(PAIRING_ALPHABET).not.toContain(character);
  });

  it.each([
    ['ABCD-EFGH', 'ABCD-EFGH'],
    ['abcd efgh', 'ABCD-EFGH'],
    ['abcdefgh', 'ABCD-EFGH'],
    ['ABCDEFGH', 'ABCD-EFGH'],
    ['abcd-efgh', 'ABCD-EFGH'],
    ['  AbCd - EfGh  ', 'ABCD-EFGH'],
    ['A B C D E F G H', 'ABCD-EFGH'],
    ['AB-CD-EF-GH', 'ABCD-EFGH'],
    ['ABCD\tEFGH\n', 'ABCD-EFGH'],
    ['2345-6789', '2345-6789'],
    ['zzzz-2222', 'ZZZZ-2222'],
  ])('%j → %s', (input, code) => {
    expect(codeOf(input)).toBe(code);
  });

  it.each([
    ['ABCD-EFG0', 'a zero'],
    ['ABCD-EFGO', 'the letter O'],
    ['ABCD-EFG1', 'a one'],
    ['ABCD-EFGI', 'the letter I'],
    ['abcd-efgi', 'a lower-case i'],
    ['ABCD.EFGH', 'a full stop'],
    ['ABCD_EFGH', 'an underscore'],
    ['ABCDEFGß', "ß, which upper-cases to 'SS'"],
    ['ABCDÉFGH', 'a non-ASCII letter'],
  ])('%j is refused: %s', (input) => {
    expect(codeOf(input)).toBe('alphabet');
  });

  it.each([
    ['ABCD-EFG', 'seven characters'],
    ['ABCD-EFGHJ', 'nine characters'],
    ['ABC', 'three characters'],
    ['A'.repeat(40), 'far too long to read'],
  ])('%j is refused: %s', (input) => {
    expect(codeOf(input)).toBe('length');
  });

  it('refuses nothing typed', () => {
    expect(codeOf('')).toBe('empty');
    expect(codeOf(' - ')).toBe('empty');
  });

  it('returns a frozen result', () => {
    expect(Object.isFrozen(normalizePairCode('abcd efgh'))).toBe(true);
  });

  it('says what a code is made of when it refuses one', () => {
    for (const message of [PAIR_CODE_COPY.length, PAIR_CODE_COPY.alphabet]) {
      expect(message).toContain('letters and the digits 2-9, with no O, 0, I or 1');
    }
  });
});
