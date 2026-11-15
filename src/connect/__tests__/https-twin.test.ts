// When Connect may check a server's https address in place of the http one a person gave
// (https-twin.ts): only when the server itself, asked at its http address, answered with a redirect
// to its own https address for the very path that was asked. Every other redirect is refused.

import { describe, expect, it } from 'vitest';

import { httpsAddressOfSameServer, httpsTwin } from '../https-twin';

const PATH = '/.well-known/automatos.json';
const LAN = 'http://192.168.1.20:8000';
const NAMED = 'http://automatos.local';

describe('httpsTwin', () => {
  it.each([
    ['the same IP address over https', LAN, `https://192.168.1.20${PATH}`, 'https://192.168.1.20'],
    ['with another port', LAN, `https://192.168.1.20:8443${PATH}`, 'https://192.168.1.20:8443'],
    ['a named host', NAMED, `https://automatos.local${PATH}`, 'https://automatos.local'],
    ['capitals in the host', NAMED, `https://Automatos.Local${PATH}`, 'https://automatos.local'],
    [
      'the default port written out',
      NAMED,
      `https://automatos.local:443${PATH}`,
      'https://automatos.local',
    ],
  ])('adopts %s', (_what, origin, redirectTo, twin) => {
    expect(httpsTwin(origin, redirectTo, PATH)).toBe(twin);
  });

  it.each([
    ['another host', `https://elsewhere.example.test${PATH}`],
    ['a host that only starts the same', `https://192.168.1.200${PATH}`],
    ['a host that only ends the same', `https://x192.168.1.20${PATH}`],
    ['another path', 'https://192.168.1.20/login'],
    ['a longer path that ends the same', `https://192.168.1.20/x${PATH}`],
    ['a query', `https://192.168.1.20${PATH}?next=x`],
    ['http again', `http://192.168.1.20:8080${PATH}`],
    ['a relative address', PATH],
    ['an address with no scheme', `192.168.1.20${PATH}`],
    ['a user name before the host', `https://user@192.168.1.20${PATH}`],
    ['another host hidden behind an @', `https://192.168.1.20@elsewhere.example.test${PATH}`],
    ['a backslash', `https://192.168.1.20\\@elsewhere.example.test${PATH}`],
    ['another scheme', `ftp://192.168.1.20${PATH}`],
    ['a space before the path', `https://192.168.1.20 ${PATH}`],
    ['a tab before the path', `https://192.168.1.20\t${PATH}`],
    ['a second slash before the path', `https://192.168.1.20/${PATH}`],
    ['a line break in it', `https://192.168.1.20\n${PATH}`],
    ['capitals in the scheme', `HTTPS://192.168.1.20${PATH}`],
    ['nothing', ''],
    ['nothing at all', undefined],
  ])('refuses %s', (_what, redirectTo) => {
    expect(httpsTwin(LAN, redirectTo, PATH)).toBeNull();
  });

  it('never moves a server that was already asked over https', () => {
    const secure = 'https://automatos.example.com';
    expect(httpsTwin(secure, `https://automatos.example.com${PATH}`, PATH)).toBeNull();
    expect(httpsTwin(secure, `https://elsewhere.example.test${PATH}`, PATH)).toBeNull();
  });

  it('refuses when the address asked is not one the app would have asked', () => {
    expect(httpsTwin('not an address', `https://192.168.1.20${PATH}`, PATH)).toBeNull();
    expect(httpsTwin('http://8.8.8.8', `https://8.8.8.8${PATH}`, PATH)).toBeNull();
  });
});

describe('httpsAddressOfSameServer', () => {
  it('is the https address when it is the same host as the http one asked', () => {
    expect(httpsAddressOfSameServer(LAN, 'https://192.168.1.20')).toBe('https://192.168.1.20');
    expect(httpsAddressOfSameServer(LAN, 'https://192.168.1.20:8443/')).toBe(
      'https://192.168.1.20:8443',
    );
    expect(httpsAddressOfSameServer(NAMED, 'https://AUTOMATOS.local')).toBe(
      'https://automatos.local',
    );
  });

  it.each([
    ['another host', LAN, 'https://elsewhere.example.test'],
    ['http again', LAN, 'http://192.168.1.20'],
    ['a path', LAN, 'https://192.168.1.20/login'],
    ['words', LAN, 'not an address'],
    [
      'an origin that was already https',
      'https://automatos.example.com',
      'https://automatos.example.com',
    ],
    ['an origin that is no address', 'nope', 'https://192.168.1.20'],
  ])('is null for %s', (_what, origin, to) => {
    expect(httpsAddressOfSameServer(origin, to)).toBeNull();
  });
});
