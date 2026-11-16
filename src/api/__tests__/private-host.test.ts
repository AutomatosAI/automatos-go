import { describe, expect, it } from 'vitest';

import { hostOfAddress, isPrivateNetworkHost, storageHostAllowed } from '../private-host';

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
  it('lets a public server reach only public storage, a private one either', () => {
    expect(storageHostAllowed('s3.amazonaws.com', 'https://api.example.test')).toBe(true);
    expect(storageHostAllowed('10.0.0.5', 'https://api.example.test')).toBe(false);
    expect(storageHostAllowed('10.0.0.5', 'http://10.0.0.2:8000')).toBe(true);
    expect(storageHostAllowed('minio.internal', 'https://automatos.local')).toBe(true);
    expect(storageHostAllowed('10.0.0.5', 'not an address')).toBe(false);
  });
});
