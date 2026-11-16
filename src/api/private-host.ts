// Where the storage hop may lead (transfer-request.ts, decided policy), and whether the app's own
// server is on a private network. Pure, but for the platform's URL, which reads the address too.
//
// A storage address's host is refused first, never classified from a reading the phone's
// networking stack might not share (src/lib/host-text.ts): only ASCII letters, digits, hyphens and
// dots in labels of legal length, with an optional numeric port, and the platform's own URL must
// read the very same host from the same text, or the address is refused (the check is on what will
// be connected to, not only on what was written). Then, from a public server, storage is a NAME:
// two labels at least, not numeric in any form, never localhost, .local, .internal, .lan or
// .home.arpa. From a server on a private network (an install on a home or office network),
// storage may be any such name on that network, or a strict dotted quad in a private (RFC 1918)
// block, which is what such a server sends; never the phone itself (localhost, loopback) and never
// link-local. Nothing bracketed, no IPv6 literal, from either.
//
// The server's own host (from the build's address or a pairing, both already held to a strict
// form) is private when it is an IP literal in a private, loopback or link-local block, IPv6 too
// (::1, ::, fc00::/7, fe80::/10, an IPv4-mapped address in one of those), localhost or a name
// under it, a name ending .local, .internal, .lan or .home.arpa, or a name of one label.

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
import { comparableHost, plainLabels, readsAsNumber } from '../lib/host-text';

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

/**
 * Is the app's own server's `host` (a name, an IPv4 literal or a bracketed IPv6 literal, held to a
 * strict form where it was set) on a private network?
 */
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

/** host[:port], the port digits only. */
const AUTHORITY = /^([^:]+)(?::\d{1,5})?$/;

/** The platform's own reading of an address's host (Expo's URL on a phone). */
function platformHost(address: string): string {
  return new URL(address).hostname;
}

/**
 * A storage address's host, lower-cased, when it is written plainly and the platform's URL reads
 * the same host from it; null for anything else, a parse that throws included.
 */
export function storageHost(
  address: string,
  readHost: (address: string) => string = platformHost,
): string | null {
  const start = address.indexOf(SCHEME_END);
  const rest = start < 0 ? '' : address.slice(start + SCHEME_END.length);
  const end = rest.search(AUTHORITY_END);
  const host = AUTHORITY.exec(end < 0 ? rest : rest.slice(0, end))?.[1];
  const labels = host === undefined ? null : plainLabels(host);
  if (!labels) return null;
  const ours = labels.join('.');
  try {
    return comparableHost(readHost(address)) === ours ? ours : null;
  } catch {
    return null; // the platform cannot read it: nothing will connect to it
  }
}

function isPhoneItself(name: string): boolean {
  return name === LOCALHOST || name.endsWith(`.${LOCALHOST}`);
}

/** A storage host from a server on a private network: a name, or a private dotted quad. */
function allowedOnPrivateNetwork(host: string, labels: readonly string[]): boolean {
  if (!readsAsNumber(labels)) return true;
  const quad = parseIpv4(host);
  return quad !== null && PRIVATE_IPV4_RANGES.some((range) => inIpv4Range(quad, range));
}

/**
 * Whether a storage host (as storageHost read it) may be reached for this server: from a public
 * server a public name only; from a server on a private network a name or a private dotted quad.
 */
export function storageHostAllowed(host: string, apiUrl: string): boolean {
  const labels = plainLabels(host);
  if (!labels || isPhoneItself(host)) return false;
  const serverHost = hostOfAddress(apiUrl);
  if (serverHost !== null && isPrivateNetworkHost(serverHost)) {
    return allowedOnPrivateNetwork(host, labels);
  }
  return labels.length >= 2 && !readsAsNumber(labels) && !isLocalName(host);
}
