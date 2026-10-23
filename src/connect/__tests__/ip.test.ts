import { describe, expect, it } from 'vitest';

import { PRIVATE_IPV4_RANGES } from '../config';
import { inIpv4Range, isIpv6SelfAddress, mappedIpv4, parseIpv4, parseIpv6 } from '../ip';

describe('parseIpv4: a strict dotted quad', () => {
  it('reads four decimal octets 0-255', () => {
    expect(parseIpv4('192.168.1.10')).toEqual([192, 168, 1, 10]);
    expect(parseIpv4('0.0.0.0')).toEqual([0, 0, 0, 0]);
    expect(parseIpv4('255.255.255.255')).toEqual([255, 255, 255, 255]);
  });

  it.each(['010.0.0.1', '1.2.3', '1.2.3.4.5', '256.1.1.1', '0x7f.0.0.1', '3232235777', '1.2.3.-4'])(
    'refuses %j',
    (text) => {
      expect(parseIpv4(text)).toBeNull();
    },
  );

  it('refuses surrounding whitespace', () => {
    expect(parseIpv4('1.2.3.4 ')).toBeNull();
  });
});

describe('inIpv4Range: CIDR membership', () => {
  const [ten, oneSevenTwo, oneNineTwo] = PRIVATE_IPV4_RANGES;

  it('includes both ends of a block and nothing past them', () => {
    expect(inIpv4Range([172, 16, 0, 0], oneSevenTwo)).toBe(true);
    expect(inIpv4Range([172, 31, 255, 255], oneSevenTwo)).toBe(true);
    expect(inIpv4Range([172, 15, 255, 255], oneSevenTwo)).toBe(false);
    expect(inIpv4Range([172, 32, 0, 0], oneSevenTwo)).toBe(false);
    expect(inIpv4Range([10, 255, 255, 255], ten)).toBe(true);
    expect(inIpv4Range([11, 0, 0, 0], ten)).toBe(false);
    expect(inIpv4Range([192, 168, 255, 255], oneNineTwo)).toBe(true);
    expect(inIpv4Range([192, 169, 0, 0], oneNineTwo)).toBe(false);
  });
});

describe('parseIpv6: eight groups, :: at most once', () => {
  it('expands :: and reads an IPv4 tail', () => {
    expect(parseIpv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(parseIpv6('::')).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(parseIpv6('2001:DB8::2:1')).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 2, 1]);
    expect(parseIpv6('fe80::')).toEqual([0xfe80, 0, 0, 0, 0, 0, 0, 0]);
    expect(parseIpv6('::ffff:192.168.1.10')).toEqual([0, 0, 0, 0, 0, 0xffff, 0xc0a8, 0x010a]);
    expect(parseIpv6('1:2:3:4:5:6:7:8')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it.each([
    '1::2::3',
    '1:2:3:4:5:6:7:8:9',
    '1:2:3',
    '12345::',
    ':1',
    '1:',
    ':::',
    '1.2.3.4::',
    '::1.2.3',
    '1:2:3:4:5:6:7::8',
    'g::1',
    '',
  ])('refuses %j', (text) => {
    expect(parseIpv6(text)).toBeNull();
  });
});

describe('the IPv6 addresses that reach the phone itself', () => {
  it('reads an IPv4-mapped address', () => {
    expect(mappedIpv4([0, 0, 0, 0, 0, 0xffff, 0x7f00, 1])).toEqual([127, 0, 0, 1]);
    expect(mappedIpv4([0, 0, 0, 0, 0, 0, 0x7f00, 1])).toBeNull();
    expect(mappedIpv4([1, 0, 0, 0, 0, 0xffff, 0x7f00, 1])).toBeNull();
  });

  it('knows :: and ::1', () => {
    expect(isIpv6SelfAddress([0, 0, 0, 0, 0, 0, 0, 0])).toBe(true);
    expect(isIpv6SelfAddress([0, 0, 0, 0, 0, 0, 0, 1])).toBe(true);
    expect(isIpv6SelfAddress([0, 0, 0, 0, 0, 0, 0, 2])).toBe(false);
    expect(isIpv6SelfAddress([1, 0, 0, 0, 0, 0, 0, 1])).toBe(false);
  });
});
