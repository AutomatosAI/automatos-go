import { describe, expect, it } from 'vitest';

import {
  ADDRESS_COPY,
  CONNECT_FAILURE_COPY,
  DEVICE_NAME_COPY,
  DEVICE_REFUSAL_COPY,
  PAIR_CODE_COPY,
  PAIR_REFUSAL_COPY,
} from '../strings';

const MESSAGES = [
  ...Object.values(ADDRESS_COPY),
  ...Object.values(PAIR_CODE_COPY),
  ...Object.values(PAIR_REFUSAL_COPY),
  ...Object.values(CONNECT_FAILURE_COPY),
  ...Object.values(DEVICE_NAME_COPY),
  ...Object.values(DEVICE_REFUSAL_COPY).map((words) => words('Home NAS')),
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

  it("says how to turn pairing on, naming the setting and the self-hosting docs' heading", () => {
    for (const message of [PAIR_REFUSAL_COPY.pairing_off, CONNECT_FAILURE_COPY.pairing_off]) {
      expect(message).toMatch(/LOCAL_REMOTE_ACCESS=paired/);
      expect(message).toMatch(/'Reach your install from your phone'/);
    }
  });

  it('gives every way Connect stops short its words, with what to do next', () => {
    expect(CONNECT_FAILURE_COPY.unsupported).toMatch(/^This server needs a newer Automatos Go\./);
    expect(CONNECT_FAILURE_COPY.hosted).toMatch(/Sign in to Automatos/);
    expect(CONNECT_FAILURE_COPY.not_saved).toMatch(/new code in Studio/);
    for (const message of Object.values(CONNECT_FAILURE_COPY)) {
      expect(message).toMatch(/try again|Studio|LOCAL_REMOTE_ACCESS|update|instead/i);
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
