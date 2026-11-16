// The redirect to storage, against parser differentials (security review of the template's
// copies, 16 Nov): the redirect's Location is read by the app's own text rules, then connected to
// by the phone's networking stack, which reads the same string its own way. Any string the two
// read differently could be judged a public name and reach a private or local address. So a host
// is refused first unless it is written plainly (src/lib/host-text.ts) and the platform's URL
// reads the same host (src/api/private-host.ts storageHost); each test below names the
// differential it closes. Every form is refused from a public server and from a home one.

import { describe, expect, it } from 'vitest';

import { storageAddress } from '../transfer-request';

const PUBLIC_SERVER = 'https://api.example.test';
const HOME_SERVER = 'http://192.168.1.20:8000';

function refusedFromEither(locations: readonly string[]): void {
  for (const location of locations) {
    expect(storageAddress(location, PUBLIC_SERVER), JSON.stringify(location)).toBeNull();
    expect(storageAddress(location, HOME_SERVER), JSON.stringify(location)).toBeNull();
  }
}

describe('the storage hop refuses a host the platform could read another way', () => {
  it('a percent-escape in the host: a URL parser decodes it (169.254.169.254%2e is the metadata address)', () => {
    refusedFromEither([
      'https://169.254.169.254%2e/latest/meta-data',
      'https://%31%32%37.0.0.1/x',
      'https://exa%6dple.com/x',
    ]);
  });

  it('a non-ASCII character: one parser maps it to ASCII (IDNA), another keeps it', () => {
    refusedFromEither(['https://b\u00fccher.example/x', 'https://xn--bcher-kva.example\u00e9/x']);
  });

  it('a letter mapped to ASCII by its case: the Kelvin sign lower-cases to k', () => {
    const kelvin = String.fromCharCode(0x212a);
    refusedFromEither([
      `https://bucket.${kelvin}ey.example.test/x`,
      `https://${kelvin}.example.test/x`,
    ]);
  });

  it('a full-width character: full-width digits and dots normalise to an address', () => {
    refusedFromEither([
      'https://\uff11\uff12\uff17.\uff10.\uff10.\uff11/x',
      'https://\uff45\uff58\uff41\uff4d\uff50\uff4c\uff45.com/x',
      'https://example\uff0ecom/x',
    ]);
  });

  it('a backslash: some parsers read it as a slash and end the host there', () => {
    refusedFromEither([
      'https://bucket.example.test\\@127.0.0.1/x',
      'https://127.0.0.1\\.example.com/x',
    ]);
  });

  it('an embedded tab or newline: a URL parser strips it and joins the halves', () => {
    refusedFromEither([
      'https://exa\tmple.com/x',
      'https://example.com\n.evil/x',
      'https://ex\rample.com/x',
    ]);
  });

  it('a bracketed IPv6 address: mapped, NAT64 and local forms reach IPv4 and local hosts', () => {
    refusedFromEither([
      'https://[::1]/x',
      'https://[::ffff:7f00:1]/x',
      'https://[::ffff:127.0.0.1]/x',
      'https://[64:ff9b::a9fe:a9fe]/x',
      'https://[::127.0.0.1]/x',
      'https://[2600:1f18::1]/x',
    ]);
  });

  it('a zone id in an IPv6 address: the stack picks an interface the text does not show', () => {
    refusedFromEither(['https://[fe80::1%25en0]/x', 'https://[fe80::1%en0]/x']);
  });

  it('an IPv4 address in octal: 0177.0.0.1 is 127.0.0.1 and 010.0.0.1 is 8.0.0.1', () => {
    refusedFromEither(['https://0177.0.0.1/x', 'https://010.0.0.1/x', 'https://0300.0250.0.1/x']);
  });

  it('an IPv4 address in hex: 0x7f.0.0.1 and 0xa9fea9fe are loopback and the metadata address', () => {
    refusedFromEither(['https://0x7f.0.0.1/x', 'https://0xa9fea9fe/x', 'https://0XC0.0xA8.1.1/x']);
  });

  it('an IPv4 address as one integer: 2130706433 is 127.0.0.1, 2852039166 is 169.254.169.254', () => {
    refusedFromEither(['https://2130706433/x', 'https://2852039166/x', 'https://3232235777/x']);
  });

  it('an IPv4 address in fewer than four parts: 127.1 is 127.0.0.1, 192.168.1 is 192.168.0.1', () => {
    refusedFromEither(['https://127.1/x', 'https://10.1/x', 'https://192.168.1/x']);
  });

  it('a trailing dot or an empty label: the stack and the text rules end the name differently', () => {
    refusedFromEither(['https://bucket.example.test./x', 'https://bucket..example.test/x']);
  });
});

describe('what the storage hop still takes', () => {
  it('a public name, written plainly, from either server', () => {
    const s3 = 'https://bucket.s3.eu-west-1.amazonaws.com/k?X-Amz-Signature=abc';
    expect(storageAddress(s3, PUBLIC_SERVER)).toBe(s3);
    expect(storageAddress(s3, HOME_SERVER)).toBe(s3);
  });

  it('a dotted quad only as a strict private one, and only from a server on a private network', () => {
    expect(storageAddress('https://192.168.1.30:9000/k', HOME_SERVER)).toBe(
      'https://192.168.1.30:9000/k',
    );
    expect(storageAddress('https://192.168.1.30:9000/k', PUBLIC_SERVER)).toBeNull();
    expect(storageAddress('https://52.95.110.1/k', HOME_SERVER)).toBeNull();
  });

  it('a name of one label only from a server on a private network', () => {
    expect(storageAddress('https://minio:9000/k', HOME_SERVER)).toBe('https://minio:9000/k');
    expect(storageAddress('https://minio:9000/k', PUBLIC_SERVER)).toBeNull();
  });
});
