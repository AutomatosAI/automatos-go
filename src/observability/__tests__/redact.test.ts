// redactText(), the cut every crash-report string goes through (R01, KR7): one case per thing
// replaced, the order that keeps a long quote whole, the 300 character cap, the 4 KB input cut and
// what it may never open up, linear time on hostile text (it runs on the crash path), and what is
// left alone so a crash stays readable.

import { describe, expect, it } from 'vitest';

import { MAX_INPUT_LENGTH, MAX_TEXT_LENGTH, REDACTED, redactText } from '../redact';

/** A pattern that backtracks on these takes seconds; a linear one takes well under this. */
const HOSTILE_BUDGET_MS = 250;
const MEGABYTE = 1024 * 1024;

describe('redactText', () => {
  it.each([
    ['a bearer token', 'retry with Bearer abc.def-ghi_123 now', `retry with ${REDACTED} now`],
    ['a lower-case bearer', 'authorization: bearer tok3n', `authorization: ${REDACTED}`],
    ['a basic credential', 'Authorization: Basic dXNlcjpwYXNz', `Authorization: ${REDACTED}`],
    ['a device token', 'paired amd_Ab3dEfGhIjKlMnOpQrStUvWxYz0123456789-_ab', `paired ${REDACTED}`],
    ['an Expo push token', 'token ExponentPushToken[xxYYzz123] bad', `token ${REDACTED} bad`],
    ['an Expo push token (short form)', 'ExpoPushToken[abc]', REDACTED],
    ['an Expo push token cut short', 'got ExponentPushToken[xxYYzz123', `got ${REDACTED}`],
    ['a Clerk publishable key', 'key pk_live_Y2xlcmsuZXhhbXBsZS5jb20k', `key ${REDACTED}`],
    ['a Clerk test key', 'key pk_test_abc123', `key ${REDACTED}`],
    ['a Clerk secret key', 'key sk_live_abc123', `key ${REDACTED}`],
    ['a JWT', 'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig-part_1', `jwt ${REDACTED}`],
    ['an email address', 'sent to someone.else+tag@example.co.uk', `sent to ${REDACTED}`],
    ['a percent-encoded email', 'q=someone%40example.com', `q=${REDACTED}`],
    ['an https URL', 'GET https://srv.example.com:8443/api/x?y=1 failed', `GET ${REDACTED} failed`],
    ['a pairing link', 'open automatos://go/pair?code=ABCD', `open ${REDACTED}`],
    ['a host and port', 'connect my-server.example:8443 refused', `connect ${REDACTED} refused`],
    ['a home-network name', 'no answer from automatos.local', `no answer from ${REDACTED}`],
    ['an internal name', 'no answer from box.corp.internal', `no answer from ${REDACTED}`],
    ['a UUID', 'chat 0B7E3C1A-5D2F-4E8A-9C6B-7A1D2E3F4A5B gone', `chat ${REDACTED} gone`],
    ['an IP address', 'connect 10.0.0.12:8000 refused', `connect ${REDACTED} refused`],
    ['an IPv6 address', 'from 2001:db8:85a3:0:0:8a2e:370:7334 now', `from ${REDACTED} now`],
    ['a compressed IPv6 address', 'from fe80::1c2b:3d4e now', `from ${REDACTED} now`],
    ['an opaque token', 'key 5e7a1b2c3d4e5f60718293a4b5c6d7e8f9 bad', `key ${REDACTED} bad`],
  ])('replaces %s', (_name, input, expected) => {
    expect(redactText(input)).toBe(expected);
  });

  it('replaces a quoted run longer than 40 characters, in any quote', () => {
    const long = 'x'.repeat(41);
    for (const [open, close] of [
      ['"', '"'],
      ["'", "'"],
      ['`', '`'],
      ['“', '”'],
      ['‘', '’'],
    ]) {
      expect(redactText(`said ${open}${long}${close} once`)).toBe(`said ${REDACTED} once`);
    }
  });

  it('takes out everything after a quote opened and never closed, past 40 characters', () => {
    const tail = 'chat words that the error echoed before it was cut';
    expect(redactText(`Unexpected token in "${tail}`)).toBe(`Unexpected token in ${REDACTED}`);
    expect(redactText(`Unexpected token in “${tail}`)).toBe(`Unexpected token in ${REDACTED}`);
    expect(redactText(`Unexpected token in \`${tail}`)).toBe(`Unexpected token in ${REDACTED}`);
  });

  it('keeps the words after a closed quote, and after an apostrophe', () => {
    const text =
      'Invariant Violation: "main" has not been registered. This can happen if Metro is off';
    expect(redactText(text)).toBe(text);
    const apostrophe = "Can't reach the server because the request took longer than it may";
    expect(redactText(apostrophe)).toBe(apostrophe);
    expect(redactText('short "open quote')).toBe('short "open quote');
  });

  it('keeps a quoted run of 40 characters or fewer (an error names its property)', () => {
    const forty = `'${'y'.repeat(40)}'`;
    expect(redactText(`saw ${forty}`)).toBe(`saw ${forty}`);
    expect(redactText("Cannot read property 'text' of undefined")).toBe(
      "Cannot read property 'text' of undefined",
    );
  });

  it('redacts a long quote whole even when a token inside it would have shortened it', () => {
    const quote = `"note https://srv.example.com/abcdefghij and the rest of it"`;
    expect(redactText(`body ${quote}`)).toBe(`body ${REDACTED}`);
  });

  it('leaves a URL with no host, words, numbers, times and short identifiers alone', () => {
    const text = 'TypeError at app:///main.jsbundle:1:482113 in ChatScreen (v1, 42 items, 10:30)';
    expect(redactText(text)).toBe(text);
  });

  it('cuts the result to 300 characters', () => {
    expect(redactText('word '.repeat(100))).toHaveLength(MAX_TEXT_LENGTH);
    expect(redactText('short')).toBe('short');
  });

  it('is idempotent: redacted text redacts to itself', () => {
    const once = redactText('Bearer abc for a@b.io at https://h.example/x');
    expect(redactText(once)).toBe(once);
  });
});

describe('redactText on over-long text (the 4 KB cut)', () => {
  it('still redacts a long quote the cut leaves open: the text ends before the quote', () => {
    const text = `JSON Parse error in "${'chat words '.repeat(MAX_INPUT_LENGTH)}" at 3`;
    expect(redactText(text)).toBe(`JSON Parse error in ${REDACTED}`);
  });

  it('drops the last word the cut may have halved', () => {
    const text = `${'word '.repeat(818)}amd_${'x'.repeat(100)}`;
    expect(text.length).toBeGreaterThan(MAX_INPUT_LENGTH);
    expect(redactText(text)).not.toContain('amd_');
    expect(redactText(text)).not.toContain('xxxx');
  });

  it('turns over-long text with no space or quote into one mark', () => {
    expect(redactText('a'.repeat(MAX_INPUT_LENGTH + 1))).toBe(REDACTED);
  });

  it('leaves text at the limit uncut', () => {
    const text = `${'a '.repeat(MAX_INPUT_LENGTH / 2 - 1)}ok`;
    expect(text).toHaveLength(MAX_INPUT_LENGTH);
    expect(redactText(text)).toBe(text.slice(0, MAX_TEXT_LENGTH));
  });
});

describe('redactText runs in linear time on hostile text (it runs on the crash path)', () => {
  const units = [
    'a',
    'a-',
    'a.',
    'a@',
    'eyJ',
    'eyJ.',
    'amd_',
    'ExponentPushToken[',
    '“a',
    '‘a',
    '"a',
    "'a",
    '1.',
    '1:',
    'a::',
    'Bearer ',
    'a.local',
    'a.b:12 ',
    'aaaa1aaaa',
  ];

  it.each(units)("a megabyte of '%s' takes under the budget", (unit) => {
    const text = unit.repeat(Math.ceil(MEGABYTE / unit.length));
    const started = performance.now();
    redactText(text);
    expect(performance.now() - started).toBeLessThan(HOSTILE_BUDGET_MS);
  });

  it('a 4 KB hostile head (the most any pattern reads) takes under the budget per unit', () => {
    for (const unit of units) {
      const text = unit.repeat(Math.floor(MAX_INPUT_LENGTH / unit.length));
      const started = performance.now();
      redactText(text);
      expect(performance.now() - started).toBeLessThan(HOSTILE_BUDGET_MS);
    }
  });
});
