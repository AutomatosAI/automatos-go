import { describe, expect, it } from 'vitest';

import { hostKind, isPrivateHost, parseServerAddress } from '../address';

function originOf(input: string) {
  const parsed = parseServerAddress(input);
  return parsed.ok ? { origin: parsed.origin, insecure: parsed.insecure } : parsed.reason;
}

describe('isPrivateHost: the hosts http:// is allowed on (KC6)', () => {
  it.each([
    ['10.0.0.1'],
    ['10.255.255.255'],
    ['172.16.0.1'],
    ['172.31.255.255'],
    ['192.168.0.1'],
    ['192.168.1.10'],
    ['nas.local'],
    ['NAS.Local'],
    ['automatos.home.local'],
  ])('%s is private', (host) => {
    expect(isPrivateHost(host)).toBe(true);
  });

  it.each([
    ['172.15.255.255', 'below 172.16.0.0/12'],
    ['172.32.0.1', 'above 172.16.0.0/12'],
    ['100.64.0.1', "Tailscale's range: use its HTTPS name"],
    ['100.127.255.255', 'Tailscale, the top of 100.64.0.0/10'],
    ['169.254.10.20', 'link-local'],
    ['203.0.113.5', 'a public address'],
    ['8.8.8.8', 'a public address'],
    ['192.169.0.1', 'next to 192.168.0.0/16'],
    ['11.0.0.1', 'next to 10.0.0.0/8'],
    ['[fd00::1]', 'every IPv6 literal, a unique-local one included'],
    ['[fe80::1]', 'every IPv6 literal, link-local included'],
    ['[::ffff:192.168.1.10]', 'an IPv4-mapped IPv6 literal is still IPv6'],
    ['example.com', 'any other name'],
    ['nas', 'a single-label name'],
    ['local', 'the suffix alone is not a name under it'],
    ['nas.local.example.com', '.local not at the end'],
    ['nas.localhost', 'a name under localhost is the phone'],
    ['localhost', 'the phone itself'],
    ['127.0.0.1', 'the phone itself'],
  ])('%s is not private (%s)', (host) => {
    expect(isPrivateHost(host)).toBe(false);
  });

  it.each([
    ['010.0.0.1', 'a leading zero (octal to a URL parser)'],
    ['192.168.01.1', 'a leading zero'],
    ['3232235777', 'the integer form of 192.168.1.1'],
    ['0xc0a80101', 'the hex form'],
    ['0xc0.168.1.1', 'a hex octet'],
    ['192.168.1', 'three parts (192.168.0.1 to a URL parser)'],
    ['192.168.1.256', 'an octet over 255'],
    ['1.2.3.4.5', 'five parts'],
    ['nas.local.', 'a trailing dot'],
    ['nas_box.local', 'an underscore'],
    ['-nas.local', 'a label starting with a hyphen'],
    ['nas..local', 'an empty label'],
    ['nås.local', 'a non-ASCII name'],
    ['', 'nothing'],
    ['[192.168.1.10]', 'an IPv4 address in brackets'],
    ['[fe80::1%en0]', 'an IPv6 zone'],
  ])('%s is not a usable host (%s)', (host) => {
    expect(isPrivateHost(host)).toBe(false);
    expect(hostKind(host)).toBe('invalid');
  });
});

describe('hostKind: the phone itself is refused (KC6)', () => {
  it.each([
    ['localhost'],
    ['LOCALHOST'],
    ['api.localhost'],
    ['127.0.0.1'],
    ['127.1.2.3'],
    ['0.0.0.0'],
    ['[::1]'],
    ['[::]'],
    ['[0:0:0:0:0:0:0:1]'],
    ['[::ffff:127.0.0.1]'],
    ['[::ffff:7f00:1]'],
  ])('%s is loopback', (host) => {
    expect(hostKind(host)).toBe('loopback');
  });

  it('names a public IPv6 literal public, so it may be used over https', () => {
    expect(hostKind('[2001:db8::1]')).toBe('public');
    expect(hostKind('[2001:db8:0:0:0:0:2:1]')).toBe('public');
    expect(hostKind('[::ffff:192.168.1.10]')).toBe('public');
  });

  it('refuses a malformed IPv6 literal', () => {
    for (const host of ['[1::2::3]', '[1:2:3:4:5:6:7:8:9]', '[1:2:3]', '[12345::]', '[:1]', '[]']) {
      expect(hostKind(host)).toBe('invalid');
    }
  });
});

describe('parseServerAddress: what a person types', () => {
  it.each([
    ['https://automatos.example.com', 'https://automatos.example.com'],
    ['https://automatos.example.com/', 'https://automatos.example.com'],
    ['  automatos.example.com  ', 'https://automatos.example.com'],
    ['HTTPS://Automatos.Example.COM', 'https://automatos.example.com'],
    ['https://automatos.example.com:8443', 'https://automatos.example.com:8443'],
    ['https://automatos.example.com:443', 'https://automatos.example.com'],
    ['automatos.example.com:8443', 'https://automatos.example.com:8443'],
    ['192.168.1.10:8000', 'https://192.168.1.10:8000'],
    ['https://203.0.113.5', 'https://203.0.113.5'],
    ['https://100.64.0.1', 'https://100.64.0.1'],
    ['https://[2001:DB8::1]:8443', 'https://[2001:db8::1]:8443'],
    ['https://nas.local', 'https://nas.local'],
  ])('%s → %s over https', (input, origin) => {
    expect(originOf(input)).toEqual({ origin, insecure: false });
  });

  it.each([
    ['http://192.168.1.10:8000', 'http://192.168.1.10:8000'],
    ['http://192.168.1.10:8000/', 'http://192.168.1.10:8000'],
    ['http://10.0.0.5', 'http://10.0.0.5'],
    ['http://172.31.255.255:8000', 'http://172.31.255.255:8000'],
    ['http://nas.local', 'http://nas.local'],
    ['HTTP://NAS.LOCAL:80', 'http://nas.local'],
  ])('%s → %s, insecure (the unencrypted home network note)', (input, origin) => {
    expect(originOf(input)).toEqual({ origin, insecure: true });
  });

  it.each([
    ['http://example.com'],
    ['http://203.0.113.5'],
    ['http://172.32.0.1'],
    ['http://100.64.0.1'],
    ['http://169.254.1.1'],
    ['http://[fd00::1]'],
    ['http://nas'],
  ])('%s is refused: http only on a private host', (input) => {
    expect(originOf(input)).toBe('http_public');
  });

  it.each([
    ['http://localhost'],
    ['https://localhost:8000'],
    ['localhost:8000'],
    ['http://127.0.0.1:8000'],
    ['https://0.0.0.0'],
    ['https://[::1]'],
  ])('%s is refused: on a phone it is the phone', (input) => {
    expect(originOf(input)).toBe('loopback');
  });

  it.each([
    ['https://automatos.example.com/api'],
    ['https://automatos.example.com/go/pair'],
    ['https://automatos.example.com?x=1'],
    ['https://automatos.example.com/?x=1'],
    ['https://automatos.example.com#top'],
    ['https://user:pass@automatos.example.com'],
    ['https://user@automatos.example.com'],
    ['automatos.example.com/path'],
  ])('%s is refused: just the server address', (input) => {
    expect(originOf(input)).toBe('not_bare');
  });

  it.each([
    ['ftp://automatos.example.com'],
    ['ws://automatos.example.com'],
    ['javascript:alert(1)'],
    ['data:text/html,hi'],
    ['file:///etc/hosts'],
    ['mailto:ops@example.com'],
    ['://automatos.example.com'],
  ])('%s is refused: only http and https', (input) => {
    expect(originOf(input)).toBe('scheme');
  });

  it.each([
    ['http://010.0.0.1'],
    ['https://3232235777'],
    ['https://0x7f.1'],
    ['https://192.168.1'],
    ['https://automatos.example.com:0'],
    ['https://automatos.example.com:65536'],
    ['https://automatos.example.com:http'],
    ['https://automatos.example.com:'],
    ['https://'],
    ['https://auto matos.example.com'],
    ['https://automatos.example.com\\@evil.example'],
    ['https://automatos.example.com\n'.repeat(2)],
    ['https://ëxample.com'],
    [`https://${'a'.repeat(600)}.com`],
  ])('%j is refused: not an address', (input) => {
    expect(originOf(input)).toBe('not_an_address');
  });

  it('refuses nothing typed', () => {
    expect(originOf('')).toBe('empty');
    expect(originOf('   ')).toBe('empty');
  });

  it('returns a frozen result', () => {
    expect(Object.isFrozen(parseServerAddress('nas.local'))).toBe(true);
    expect(Object.isFrozen(parseServerAddress('http://example.com'))).toBe(true);
  });
});
