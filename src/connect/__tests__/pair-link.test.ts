import { describe, expect, it } from 'vitest';

import { parsePairLink } from '../pair-link';

const STUDIO = 'https://studio.example.test';
const CODE = 'ABCD-EFGH';
/** The api parameter for https://a.test, url-encoded as the server sends it. */
const API = 'api=https%3A%2F%2Fa.test';
/** A well-formed query: the api and the code. */
const QUERY = `${API}&code=${CODE}`;

/** As the server builds it: `{web_url}/go/pair?` + urlencode({api, code}) (pairing.py). */
function serverLink(api: string, code = CODE, web = STUDIO): string {
  return `${web}/go/pair?api=${encodeURIComponent(api)}&code=${encodeURIComponent(code)}`;
}

describe('parsePairLink: the QR code from Studio and the /go/pair link', () => {
  it('reads the link the server builds', () => {
    expect(parsePairLink(serverLink('https://api.example.test'))).toEqual({
      apiOrigin: 'https://api.example.test',
      insecure: false,
      code: CODE,
    });
  });

  it("reads a home install's link: an http API on a private address, insecure", () => {
    const link = `${STUDIO}/go/pair?api=http%3A%2F%2F192.168.1.20%3A8000&code=${CODE}`;
    expect(parsePairLink(link)).toEqual({
      apiOrigin: 'http://192.168.1.20:8000',
      insecure: true,
      code: CODE,
    });
  });

  it("reads a link on a home install's http web address, which is never contacted", () => {
    const api = 'http://192.168.1.20:8000';
    for (const web of ['http://192.168.1.20:3000', 'http://localhost:3000', 'http://nas.local']) {
      expect(parsePairLink(serverLink(api, CODE, web))?.apiOrigin).toBe(api);
    }
  });

  it('reads the app-scheme link automatos://go/pair', () => {
    const api = encodeURIComponent('https://nas.local:8443');
    const link = `automatos://go/pair?api=${api}&code=abcd%20efgh`;
    expect(parsePairLink(link)).toEqual({
      apiOrigin: 'https://nas.local:8443',
      insecure: false,
      code: CODE,
    });
  });

  it('puts the code in the hyphenated form the server hashed, from any form in the link', () => {
    expect(parsePairLink(serverLink('https://api.example.test', 'abcdefgh'))?.code).toBe(CODE);
    expect(parsePairLink(`${STUDIO}/go/pair?${API}&code=abcd+efgh`)?.code).toBe(CODE);
  });

  it('reads the parameters in either order and ignores any other parameter', () => {
    const link = `${STUDIO}/go/pair?utm_source=qr&code=${CODE}&api=https%3A%2F%2Fapi.example.test`;
    expect(parsePairLink(link)?.apiOrigin).toBe('https://api.example.test');
  });

  it('trims the scanned text', () => {
    expect(parsePairLink(`  ${serverLink('https://api.example.test')}\n`)?.code).toBe(CODE);
  });

  it.each([
    ['an http API on a public address', serverLink('http://203.0.113.5')],
    ['an http API on a public name', serverLink('http://api.example.test')],
    ['an API on loopback', serverLink('http://127.0.0.1:8000')],
    ['an API with a path', serverLink('https://api.example.test/api')],
    ['an API in another scheme', serverLink('javascript:alert(1)')],
    ['a code with a zero', serverLink('https://api.example.test', 'ABCD-EFG0')],
    ['a short code', serverLink('https://api.example.test', 'ABCD')],
  ])('refuses %s', (_why, link) => {
    expect(parsePairLink(link)).toBeNull();
  });

  it.each([
    ['two code parameters', `${STUDIO}/go/pair?${QUERY}&code=WXYZ-2345`],
    ['two api parameters', `${STUDIO}/go/pair?${QUERY}&api=https%3A%2F%2Fb.test`],
    ['no code', `${STUDIO}/go/pair?${API}`],
    ['no api', `${STUDIO}/go/pair?code=${CODE}`],
    ['no query', `${STUDIO}/go/pair`],
    ['an empty api', `${STUDIO}/go/pair?api=&code=${CODE}`],
    ['a malformed escape', `${STUDIO}/go/pair?${API}%E0%A4%A&code=${CODE}`],
  ])('refuses a link with %s', (_why, link) => {
    expect(parsePairLink(link)).toBeNull();
  });

  it.each([
    ['another path', `${STUDIO}/go/pairing?${QUERY}`],
    ['a path under /go/pair', `${STUDIO}/go/pair/x?${QUERY}`],
    ['a prefix before /go/pair', `${STUDIO}/x/go/pair?${QUERY}`],
    ['a fragment', `${STUDIO}/go/pair?${QUERY}#x`],
    ['user info on the link', `https://evil@studio.example.test/go/pair?${QUERY}`],
    ['a malformed link host', `https://studio..test/go/pair?${QUERY}`],
    ['javascript:', `javascript:alert(1)//go/pair?${QUERY}`],
    ['data:', `data:text/html,go/pair?${QUERY}`],
    ['file:', `file:///go/pair?${QUERY}`],
    ['ftp:', `ftp://studio.example.test/go/pair?${QUERY}`],
    ['another app scheme', `otherapp://go/pair?${QUERY}`],
    ['the app scheme on another path', `automatos://go/other?${QUERY}`],
    ['the app scheme with a host', `automatos://x/go/pair?${QUERY}`],
    ['whitespace inside', `${STUDIO}/go/pair?${API}&code=ABCD EFGH`],
    ['a backslash', `${STUDIO}\\go/pair?${QUERY}`],
    ['another QR code (a plain URL)', 'https://example.com/menu'],
    ['another QR code (text)', 'WIFI:S:home;T:WPA;P:secret;;'],
    ['nothing', ''],
    ['an over-long link', `${STUDIO}/go/pair?${QUERY}&x=${'a'.repeat(3000)}`],
  ])('refuses %s', (_why, link) => {
    expect(parsePairLink(link)).toBeNull();
  });

  it('returns a frozen result', () => {
    expect(Object.isFrozen(parsePairLink(serverLink('https://api.example.test')))).toBe(true);
  });
});
