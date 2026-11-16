// Whether a host is on a private network, for the storage hop (transfer-request.ts, decided
// policy): a public server may not point the phone into one. Pure; the IP parsing and the blocks
// are src/lib/ip.ts's, shared with the server-address rule (src/connect/address.ts). Private is
// an IP literal in a private (RFC 1918), loopback or link-local block, IPv6 too (::1, ::,
// fc00::/7, fe80::/10, and an IPv4-mapped address in one of those blocks); localhost and every
// name under it; a name ending .local, .internal, .lan or .home.arpa; a name of one label, which
// only a local resolver answers; and any number a URL parser would read as an address but is not
// a strict dotted quad (0x7f.1, 2130706433), which is never believed to be public.

import {
  inIpv4Range,
  isIpv6LocalNetwork,
  isIpv6SelfAddress,
  LINK_LOCAL_IPV4_RANGES,
  LOOPBACK_IPV4_RANGES,
  mappedIpv4,
  parseIpv4,
  parseIpv6,
  PRIVATE_IPV4_RANGES,
  type Ipv4Quad,
} from '../lib/ip';

const LOCAL_BLOCKS = [...PRIVATE_IPV4_RANGES, ...LOOPBACK_IPV4_RANGES, ...LINK_LOCAL_IPV4_RANGES];
const LOCALHOST = 'localhost';
const PRIVATE_NAME_SUFFIXES: readonly string[] = Object.freeze([
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home.arpa',
]);
/** A URL parser reads a host whose last label is a number as IPv4 (WHATWG "ends in a number"). */
const NUMERIC_LABEL = /^(\d+|0x[0-9a-f]*)$/;
const IPV6_LITERAL = /^\[([^\]]+)\]$/;
const SCHEME_END = '://';
const AUTHORITY_END = /[/?#]/;

function isLocalIpv4(quad: Ipv4Quad): boolean {
  return LOCAL_BLOCKS.some((range) => inIpv4Range(quad, range));
}

function isLocalIpv6(literal: string): boolean {
  const groups = parseIpv6(IPV6_LITERAL.exec(literal)?.[1] ?? '');
  if (!groups) return true; // not an address anyone can check: never believed public
  const mapped = mappedIpv4(groups);
  if (mapped) return isLocalIpv4(mapped);
  return isIpv6SelfAddress(groups) || isIpv6LocalNetwork(groups);
}

function isLocalName(name: string): boolean {
  if (!name.includes('.')) return true;
  return name === LOCALHOST || PRIVATE_NAME_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/** Is `host` (a name, an IPv4 literal or a bracketed IPv6 literal) on a private network? */
export function isPrivateNetworkHost(host: string): boolean {
  const name = host.toLowerCase().replace(/\.$/, '');
  if (name.startsWith('[')) return isLocalIpv6(name);
  const labels = name.split('.');
  if (NUMERIC_LABEL.test(labels[labels.length - 1] ?? '')) {
    const quad = parseIpv4(name);
    return quad === null || isLocalIpv4(quad);
  }
  return isLocalName(name);
}

/** The host of an absolute address (scheme://host[:port]…), without its port; null if none. */
export function hostOfAddress(address: string): string | null {
  const start = address.indexOf(SCHEME_END);
  if (start < 0) return null;
  const rest = address.slice(start + SCHEME_END.length);
  const end = rest.search(AUTHORITY_END);
  const authority = end < 0 ? rest : rest.slice(0, end);
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']');
    return close < 0 ? null : authority.slice(0, close + 1);
  }
  const host = authority.split(':')[0] ?? '';
  return host === '' ? null : host;
}

/** Whether a storage host may be reached for this server: a private one only from a private one. */
export function storageHostAllowed(storageHost: string, apiUrl: string): boolean {
  if (!isPrivateNetworkHost(storageHost)) return true;
  const serverHost = hostOfAddress(apiUrl);
  return serverHost !== null && isPrivateNetworkHost(serverHost);
}
