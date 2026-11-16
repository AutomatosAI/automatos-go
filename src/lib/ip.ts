// IP literals, parsed strictly, and the IPv4 blocks that are not the public internet: shared by
// the server-address rule (src/connect/address.ts, KC6) and the storage hop's private-network
// rule (src/api/private-host.ts). An IPv4 address is four decimal octets 0-255 with no leading
// zeros (never the integer, octal or hex forms a URL parser would quietly reinterpret); an IPv6
// address is eight 16-bit groups, '::' at most once, an IPv4 tail allowed. Pure.

export type Ipv4Quad = readonly [number, number, number, number];
export type Ipv4Range = { readonly base: Ipv4Quad; readonly prefix: number };

/**
 * The private (RFC 1918) blocks. connect lets http:// reach them (D-HTTPS, KC6): 172.16.0.0/12
 * joins the PRD's 10.x and 192.168.x; 100.64.0.0/10 (Tailscale: use its HTTPS name) and
 * 169.254.0.0/16 do not.
 */
export const PRIVATE_IPV4_RANGES: readonly Ipv4Range[] = Object.freeze([
  { base: [10, 0, 0, 0], prefix: 8 },
  { base: [172, 16, 0, 0], prefix: 12 },
  { base: [192, 168, 0, 0], prefix: 16 },
]);
/** On a phone these reach the phone itself: 127.0.0.0/8, and 0.0.0.0/8, which connects there. */
export const LOOPBACK_IPV4_RANGES: readonly Ipv4Range[] = Object.freeze([
  { base: [127, 0, 0, 0], prefix: 8 },
  { base: [0, 0, 0, 0], prefix: 8 },
]);
/** Link-local (RFC 3927): the network the phone is on, never the internet. */
export const LINK_LOCAL_IPV4_RANGES: readonly Ipv4Range[] = Object.freeze([
  { base: [169, 254, 0, 0], prefix: 16 },
]);

const IPV4_OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4_QUAD = new RegExp(`^${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`);
const IPV6_GROUP = /^[0-9a-f]{1,4}$/;
const IPV6_GROUP_COUNT = 8;
const IPV6_COMPRESSION = '::';
const IPV4_MAPPED_MARKER = 0xffff;
const IPV4_BITS = 32;
const OCTET_VALUES = 256;

export type Ipv6Groups = readonly number[];

/** A strict dotted quad as four octets; null for anything else. */
export function parseIpv4(text: string): Ipv4Quad | null {
  const match = IPV4_QUAD.exec(text);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}

function ipv4Number(quad: Ipv4Quad): number {
  return quad.reduce((value, octet) => value * OCTET_VALUES + octet, 0);
}

/** Is `quad` inside `range` (a CIDR block)? */
export function inIpv4Range(quad: Ipv4Quad, range: Ipv4Range): boolean {
  const size = 2 ** (IPV4_BITS - range.prefix);
  return Math.floor(ipv4Number(quad) / size) === Math.floor(ipv4Number(range.base) / size);
}

/** One ':'-separated piece: a hex group, or (last in the address only) an IPv4 tail: two groups. */
function pieceGroups(piece: string, quadAllowed: boolean): Ipv6Groups | null {
  if (IPV6_GROUP.test(piece)) return [parseInt(piece, 16)];
  const quad = quadAllowed ? parseIpv4(piece) : null;
  if (!quad) return null;
  return [quad[0] * OCTET_VALUES + quad[1], quad[2] * OCTET_VALUES + quad[3]];
}

function partGroups(part: string, quadAllowedLast: boolean): Ipv6Groups | null {
  if (part === '') return [];
  const pieces = part.split(':');
  const groups = pieces.map((piece, at) =>
    pieceGroups(piece, quadAllowedLast && at === pieces.length - 1),
  );
  return groups.every((group): group is Ipv6Groups => group !== null) ? groups.flat() : null;
}

/** An IPv6 literal (without brackets) as its eight groups; null for anything else. */
export function parseIpv6(text: string): Ipv6Groups | null {
  const halves = text.toLowerCase().split(IPV6_COMPRESSION);
  if (halves.length > 2) return null;
  const compressed = halves.length === 2;
  const head = partGroups(halves[0], !compressed);
  const tail = compressed ? partGroups(halves[1], true) : [];
  if (!head || !tail) return null;
  const missing = IPV6_GROUP_COUNT - head.length - tail.length;
  if (compressed ? missing < 1 : missing !== 0) return null;
  return [...head, ...new Array<number>(compressed ? missing : 0).fill(0), ...tail];
}

/** The IPv4 address an IPv4-mapped IPv6 address (::ffff:a.b.c.d) carries; null if it is not one. */
export function mappedIpv4(groups: Ipv6Groups): Ipv4Quad | null {
  const prefixIsZero = groups.slice(0, 5).every((group) => group === 0);
  if (!prefixIsZero || groups[5] !== IPV4_MAPPED_MARKER) return null;
  const [high, low] = [groups[6], groups[7]];
  return [
    Math.floor(high / OCTET_VALUES),
    high % OCTET_VALUES,
    Math.floor(low / OCTET_VALUES),
    low % OCTET_VALUES,
  ];
}

/** :: (unspecified, which connects to the phone itself) or ::1. */
export function isIpv6SelfAddress(groups: Ipv6Groups): boolean {
  const leadingZero = groups.slice(0, IPV6_GROUP_COUNT - 1).every((group) => group === 0);
  const last = groups[IPV6_GROUP_COUNT - 1];
  return leadingZero && (last === 0 || last === 1);
}

const IPV6_UNIQUE_LOCAL = { mask: 0xfe00, prefix: 0xfc00 }; // fc00::/7
const IPV6_LINK_LOCAL = { mask: 0xffc0, prefix: 0xfe80 }; // fe80::/10

/** fc00::/7 (unique local) or fe80::/10 (link-local): a private network, never the internet. */
export function isIpv6LocalNetwork(groups: Ipv6Groups): boolean {
  const first = groups[0] ?? 0;
  return [IPV6_UNIQUE_LOCAL, IPV6_LINK_LOCAL].some(({ mask, prefix }) => (first & mask) === prefix);
}
