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
// "Never the phone itself, never link-local" holds of what is WRITTEN: literals and local names.
// A name can resolve to any address, a private one included, and no reading of its text can see
// that. What bounds that case is the hop itself: https only, one hop, a GET carrying no header
// at all (no bearer, no workspace, no cookie), its body under the same byte cap, and a TLS
// certificate the platform must find valid for that very name, which a host inside a private
// network does not hold for a public name it was pointed at.
//
// The server's own host (from the build's address or a pairing, both already held to a strict
// form) is private when it is an IP literal in a private, loopback or link-local block, IPv6 too
// (::1, ::, fc00::/7, fe80::/10, an IPv4-mapped address in one of those), localhost or a name
// under it, a name ending .local, .internal, .lan or .home.arpa, or a name of one label. A host
// this file cannot read (a number that is not a strict dotted quad, an IPv6 literal that does not
// parse, a name not written plainly) is NOT private: an unreadable server never widens where
// storage may lead.

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
const IPV6_LITERAL = /^\[([^\]]+)\]$/;
const SCHEME_END = '://';
const AUTHORITY_END = /[/?#]/;

function isLocalIpv4(quad: Ipv4Quad): boolean {
  return LOCAL_BLOCKS.some((range) => inIpv4Range(quad, range));
}

function isLocalIpv6(literal: string): boolean {
  const groups = parseIpv6(IPV6_LITERAL.exec(literal)?.[1] ?? '');
  if (!groups) return false; // not an address anyone can check: never widens what storage may be
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
  if (host.startsWith('[')) return isLocalIpv6(host.toLowerCase());
  const labels = plainLabels(host);
  if (!labels) return false; // not written plainly: never widens what storage may be
  const name = labels.join('.');
  if (readsAsNumber(labels)) {
    const quad = parseIpv4(name);
    return quad !== null && isLocalIpv4(quad);
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
