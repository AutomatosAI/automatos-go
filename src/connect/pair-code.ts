// The 8-character pairing code (KC7): typed, pasted or read from a pairing link, in any case, with
// or without spaces and hyphens. The server mints 'XXXX-XXXX' and looks it up by the hash of that
// canonical form, so the app always sends it hyphenated. Pure.

import {
  PAIR_CODE_GROUP_LENGTH,
  PAIR_CODE_INPUT_MAX_LENGTH,
  PAIR_CODE_LENGTH,
  PAIR_CODE_SEPARATOR,
  PAIRING_ALPHABET,
} from './config';

export type PairCodeRefusal =
  | 'empty'
  /** not 8 characters once spaces and hyphens are gone */
  | 'length'
  /** a character outside the alphabet (O, 0, I, 1, punctuation, a non-ASCII letter) */
  | 'alphabet';

export type PairCode =
  | { readonly ok: true; readonly code: string }
  | { readonly ok: false; readonly reason: PairCodeRefusal };

/** Spaces and hyphens a person types between groups, and any other whitespace a paste carries. */
const SEPARATORS = /[\s-]+/g;
/** Checked before upper-casing: 'ß'.toUpperCase() is 'SS', and no such letter is in a code. */
const ASCII_ALPHANUMERIC = /^[A-Za-z0-9]+$/;
const ALPHABET: ReadonlySet<string> = new Set(PAIRING_ALPHABET);

function refuse(reason: PairCodeRefusal): PairCode {
  return Object.freeze({ ok: false, reason });
}

/** A code as the server hashed it ('ABCD-EFGH'), or why it cannot be one. */
export function normalizePairCode(input: string): PairCode {
  if (input.length > PAIR_CODE_INPUT_MAX_LENGTH) return refuse('length');
  const bare = input.replace(SEPARATORS, '');
  if (bare === '') return refuse('empty');
  if (!ASCII_ALPHANUMERIC.test(bare)) return refuse('alphabet');
  if (bare.length !== PAIR_CODE_LENGTH) return refuse('length');
  const upper = bare.toUpperCase();
  if (![...upper].every((character) => ALPHABET.has(character))) return refuse('alphabet');
  const head = upper.slice(0, PAIR_CODE_GROUP_LENGTH);
  const tail = upper.slice(PAIR_CODE_GROUP_LENGTH);
  return Object.freeze({ ok: true, code: `${head}${PAIR_CODE_SEPARATOR}${tail}` });
}
