import { describe, expect, it } from 'vitest';

import {
  hostOfAddress,
  isPrivateNetworkHost,
  storageHost,
  storageHostAllowed,
} from '../private-host';

describe('isPrivateNetworkHost', () => {
  it('knows the private, loopback and link-local blocks, IPv4 and IPv6', () => {
    for (const host of ['10.1.2.3', '172.31.255.1', '192.168.0.1', '127.0.0.2', '0.0.0.0']) {
      expect(isPrivateNetworkHost(host), host).toBe(true);
    }
    expect(isPrivateNetworkHost('169.254.169.254')).toBe(true);
    for (const host of ['[::1]', '[::]', '[fc00::1]', '[fe80::abcd]', '[::ffff:192.168.1.1]']) {
      expect(isPrivateNetworkHost(host), host).toBe(true);
    }
  });

  it('knows the local names, in any case and with a trailing dot', () => {
    for (const host of [
      'localhost',
      'a.localhost',
      'Nas.Local',
      'x.internal',
      'y.lan.',
      'z.home.arpa',
      'minio',
    ]) {
      expect(isPrivateNetworkHost(host), host).toBe(true);
    }
  });

  it('never believes a number that is not a strict dotted quad, or a broken IPv6 literal', () => {
    for (const host of ['0x7f.1', '2130706433', '127.1', '[::gg]', '[1:2]']) {
      expect(isPrivateNetworkHost(host), host).toBe(true);
    }
  });

  it('calls public what is on the internet', () => {
    for (const host of [
      's3.eu-west-1.amazonaws.com',
      '52.95.110.1',
      '172.32.0.1',
      '[2600::1]',
      '[::ffff:8.8.8.8]',
      'local.example.com',
      'lan.example.org',
    ]) {
      expect(isPrivateNetworkHost(host), host).toBe(false);
    }
  });
});

describe('hostOfAddress', () => {
  it('reads the host without its port, an IPv6 literal in its brackets', () => {
    expect(hostOfAddress('https://bucket.example.test:9443/k?x=1')).toBe('bucket.example.test');
    expect(hostOfAddress('https://[fd00::5]:9000/k')).toBe('[fd00::5]');
    expect(hostOfAddress('http://192.168.1.20:8000')).toBe('192.168.1.20');
    expect(hostOfAddress('https://host?x')).toBe('host');
  });

  it('is null with no scheme, no host or an open bracket', () => {
    expect(hostOfAddress('/api/x')).toBeNull();
    expect(hostOfAddress('https:///x')).toBeNull();
    expect(hostOfAddress('https://[fd00::5/x')).toBeNull();
  });
});

describe('storageHostAllowed', () => {
  const PUBLIC = 'https://api.example.test';
  const HOME = 'http://192.168.1.20:8000';

  it('from a public server: a public name of two labels or more, and nothing else', () => {
    expect(storageHostAllowed('s3.eu-west-1.amazonaws.com', PUBLIC)).toBe(true);
    for (const host of ['minio', 'nas.local', 'x.internal', 'y.lan', 'z.home.arpa', '10.0.0.5']) {
      expect(storageHostAllowed(host, PUBLIC), host).toBe(false);
    }
    expect(storageHostAllowed('52.95.110.1', PUBLIC)).toBe(false);
    expect(storageHostAllowed('10.0.0.5', 'not an address')).toBe(false);
  });

  it('from a server on a private network: a name on it, or a private dotted quad', () => {
    for (const host of ['minio', 'nas.local', 'minio.internal', '10.0.0.5', '172.20.1.1']) {
      expect(storageHostAllowed(host, HOME), host).toBe(true);
      expect(storageHostAllowed(host, 'https://automatos.local'), host).toBe(true);
    }
  });

  it('from either: never the phone itself, link-local, a public quad or a number in another form', () => {
    for (const host of [
      'localhost',
      'minio.localhost',
      '127.0.0.1',
      '169.254.169.254',
      '52.95.110.1',
      '0177.0.0.1',
      '0x7f.0.0.1',
      '2130706433',
      '10.1',
    ]) {
      expect(storageHostAllowed(host, HOME), host).toBe(false);
      expect(storageHostAllowed(host, PUBLIC), host).toBe(false);
    }
  });
});

describe('storageHost: what the platform will connect to, read alike or refused', () => {
  it('reads a plain host, lower-cased, without its port', () => {
    expect(storageHost('https://Bucket.S3.Example.test:9443/k?x=1')).toBe('bucket.s3.example.test');
    expect(storageHost('https://192.168.1.30/q3.pdf')).toBe('192.168.1.30');
  });

  it('refuses when the platform reads another host from the same text', () => {
    expect(storageHost('https://bucket.example.test/x', () => 'elsewhere.example.test')).toBeNull();
  });

  it('refuses when the platform cannot read it at all', () => {
    const throws = () => {
      throw new TypeError('Invalid URL');
    };
    expect(storageHost('https://bucket.example.test/x', throws)).toBeNull();
  });

  it('takes the platform reading that differs only by case or a last dot', () => {
    expect(storageHost('https://bucket.example.test/x', () => 'BUCKET.example.test.')).toBe(
      'bucket.example.test',
    );
  });

  it('refuses a label over 63 characters, a name over 253, an empty label and a last dot', () => {
    const long = `${'a'.repeat(64)}.example.test`;
    const huge = `${Array.from({ length: 64 }, () => 'abc').join('.')}.test`;
    for (const host of [long, huge, 'a..example.test', 'bucket.example.test.', '-a.example.test']) {
      expect(storageHost(`https://${host}/x`), host).toBeNull();
    }
  });
});
