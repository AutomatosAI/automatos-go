import { describe, expect, it } from 'vitest';

import {
  comparableHost,
  httpAllowedTo,
  isPlainHost,
  isPlainOrigin,
  isServerOrigin,
  plainLabels,
  readsAsNumber,
} from '../host-text';

const RELEASE = { development: false };
const DEVELOPMENT = { development: true };

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

describe('httpAllowedTo: the one rule for plain http, wherever an address comes from', () => {
  it('allows a home network in every build: a private quad or a name ending .local', () => {
    for (const host of [
      '192.168.1.20',
      '10.0.0.2',
      '172.31.255.1',
      'automatos.local',
      'NAS.local',
    ]) {
      expect(httpAllowedTo(host, RELEASE), host).toBe(true);
      expect(httpAllowedTo(host, DEVELOPMENT), host).toBe(true);
    }
  });

  it('allows the loopback a simulator reaches its computer by, in a development build only', () => {
    for (const host of ['localhost', 'api.localhost', '127.0.0.1', '0.0.0.0', '[::1]']) {
      expect(httpAllowedTo(host, RELEASE), host).toBe(false);
      expect(httpAllowedTo(host, DEVELOPMENT), host).toBe(true);
    }
  });

  it('refuses a public name, a public quad, a look-alike and any other IPv6 literal, in any build', () => {
    for (const host of [
      'api.automatos.app',
      '52.95.110.1',
      '100.64.1.1',
      '169.254.169.254',
      '192.168.1.20.example.test',
      'nas.local.example.test',
      'nas',
      '192.168.1',
      '0xc0.168.1.20',
      '[fd00::1]',
      '[2600::1]',
      '',
    ]) {
      expect(httpAllowedTo(host, DEVELOPMENT), host).toBe(false);
    }
  });
});

describe('isServerOrigin: what the API client may be made over', () => {
  it('takes https to any plain origin, and http where httpAllowedTo allows it', () => {
    for (const origin of [
      'https://api.automatos.app',
      'https://52.95.110.1',
      'https://[::1]:8443',
    ]) {
      expect(isServerOrigin(origin, RELEASE), origin).toBe(true);
    }
    expect(isServerOrigin('http://192.168.1.20:8000', RELEASE)).toBe(true);
    expect(isServerOrigin('http://automatos.local', RELEASE)).toBe(true);
    expect(isServerOrigin('http://localhost:8000', RELEASE)).toBe(false);
    expect(isServerOrigin('http://localhost:8000', DEVELOPMENT)).toBe(true);
  });

  it('refuses http to a public host, and anything that is not a plain origin', () => {
    for (const origin of [
      'http://api.automatos.app',
      'http://52.95.110.1:8000',
      'http://192.168.1.20.example.test',
      'http://192.168.1.20/',
      'https://API.automatos.app',
      'ftp://192.168.1.20',
    ]) {
      expect(isServerOrigin(origin, DEVELOPMENT), origin).toBe(false);
    }
  });
});
