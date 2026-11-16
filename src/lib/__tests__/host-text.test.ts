import { describe, expect, it } from 'vitest';

import {
  comparableHost,
  isPlainHost,
  isPlainOrigin,
  plainLabels,
  readsAsNumber,
} from '../host-text';

describe('plainLabels: a host written plainly, or nothing', () => {
  it('reads ASCII letters, digits and hyphens in labels of legal length, lower-cased', () => {
    expect(plainLabels('Bucket.S3-eu.Example.test')).toEqual([
      'bucket',
      's3-eu',
      'example',
      'test',
    ]);
    expect(plainLabels('192.168.1.30')).toEqual(['192', '168', '1', '30']);
    expect(plainLabels(`${'a'.repeat(63)}.test`)).not.toBeNull();
  });

  it('refuses anything else: an escape, a space, brackets, an empty label, a long one', () => {
    for (const host of [
      '',
      'exa%6dple.com',
      'exa mple.com',
      '[::1]',
      'a..b',
      'a.',
      '.a',
      '-a.test',
      'a-.test',
      'a_b.test',
      `${'a'.repeat(64)}.test`,
      `${'abc.'.repeat(64)}test`,
    ]) {
      expect(plainLabels(host), host).toBeNull();
    }
  });
  it('tests the text as written, before any case mapping: a letter whose lower case is ASCII', () => {
    // the Kelvin sign lower-cases to k, the dotted capital I to i and a combining dot, and the
    // long s stays itself: the network is handed the text, so each is refused as written
    for (const host of [
      'bucKet.example.test'.replace('K', String.fromCharCode(0x212a)),
      'Iinfo.example.test'.replace('I', String.fromCharCode(0x130)),
      'sstore.example.test'.replace('s', String.fromCharCode(0x17f)),
    ]) {
      expect(plainLabels(host), JSON.stringify(host)).toBeNull();
    }
    expect(String.fromCharCode(0x212a).toLowerCase()).toBe('k');
  });
});

describe('readsAsNumber: what a URL parser takes for an IP address', () => {
  it('is a last label of digits or 0x hex, in any number of parts', () => {
    for (const host of [
      '2130706433',
      '127.1',
      '0177.0.0.1',
      '0x7f.0.0.1',
      'a.0x',
      '192.168.1.30',
    ]) {
      expect(readsAsNumber(host.split('.')), host).toBe(true);
    }
    for (const host of ['example.com', '1.example', '0x7f.example', 's3.amazonaws.com']) {
      expect(readsAsNumber(host.split('.')), host).toBe(false);
    }
  });
});

describe('comparableHost', () => {
  it('lower-cases and drops one last dot', () => {
    expect(comparableHost('Bucket.Example.TEST.')).toBe('bucket.example.test');
  });
});

describe('isPlainOrigin: a scheme, a plain host and a port, and nothing more', () => {
  it('takes the origins the app is given', () => {
    for (const origin of [
      'https://api.automatos.app',
      'https://api.automatos.app:8443',
      'http://192.168.1.20:8000',
      'https://nas',
      'https://[::1]:8443',
    ]) {
      expect(isPlainOrigin(origin), origin).toBe(true);
    }
  });

  it('refuses a path, a slash, a user, a query, capitals, another scheme or a port out of range', () => {
    for (const origin of [
      'https://api.automatos.app/',
      'https://api.automatos.app/api',
      'https://user@api.automatos.app',
      'https://api.automatos.app?x=1',
      'https://API.automatos.app',
      'HTTPS://api.automatos.app',
      'ftp://api.automatos.app',
      'https://api.automatos.app:0',
      'https://api.automatos.app:65536',
      'https://0x7f.1',
      'https://127.1',
      'https://[::G]',
      'api.automatos.app',
      '',
    ]) {
      expect(isPlainOrigin(origin), origin).toBe(false);
    }
  });

  it('isPlainHost: lower-case plain labels, a strict quad when numeric, or an IPv6 literal', () => {
    expect(['a.example', '10.0.0.1', '[fd00::1]'].map(isPlainHost)).toEqual([true, true, true]);
    expect(['A.example', '10.1', '[x]'].map(isPlainHost)).toEqual([false, false, false]);
  });
});
