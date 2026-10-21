import { describe, expect, it } from 'vitest';

import { ADDRESS_COPY, PAIR_CODE_COPY } from '../strings';

const MESSAGES = [...Object.values(ADDRESS_COPY), ...Object.values(PAIR_CODE_COPY)];

describe('connect copy', () => {
  it('asks for just the server address in the words of the PRD', () => {
    expect(ADDRESS_COPY.not_bare).toBe(
      'Type just the server address, like https://automatos.example.com',
    );
  });

  it('names no status code and no internal', () => {
    // a three-digit number on its own, not an octet of the example addresses
    const statusCode = /(?<![\d.])[1-5]\d\d(?![\d.])/;
    for (const message of MESSAGES) {
      expect(message).not.toMatch(statusCode);
      expect(message).not.toMatch(/status|error|exception|null|undefined|reason/i);
    }
  });

  it('points nowhere near making an account (D-SIGNIN)', () => {
    for (const message of MESSAGES) {
      expect(message).not.toMatch(/account|sign[ -]?up|register/i);
    }
  });
});
