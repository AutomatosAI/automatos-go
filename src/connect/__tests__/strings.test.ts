import { describe, expect, it } from 'vitest';

import { ADDRESS_COPY, DEVICE_NAME_COPY, PAIR_CODE_COPY, PAIR_REFUSAL_COPY } from '../strings';

const MESSAGES = [
  ...Object.values(ADDRESS_COPY),
  ...Object.values(PAIR_CODE_COPY),
  ...Object.values(PAIR_REFUSAL_COPY),
  ...Object.values(DEVICE_NAME_COPY),
];

describe('connect copy', () => {
  it('asks for just the server address in the words of the PRD', () => {
    expect(ADDRESS_COPY.not_bare).toBe(
      'Type just the server address, like https://automatos.example.com',
    );
  });

  it('says how to fix each pairing refusal', () => {
    expect(PAIR_REFUSAL_COPY.bad_code).toMatch(/10 minutes and work once/);
    expect(PAIR_REFUSAL_COPY.bad_code).toMatch(/Studio → Settings → Phones & devices/);
    expect(PAIR_REFUSAL_COPY.pairing_off).toMatch(/LOCAL_REMOTE_ACCESS=paired/);
    for (const message of Object.values(PAIR_REFUSAL_COPY)) {
      expect(message).toMatch(/try again|Studio|LOCAL_REMOTE_ACCESS|Update the app/i);
    }
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
