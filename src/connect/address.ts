// Server addresses (PRD-001 §4.5, D-HTTPS, KC6): the trust boundary for every address a person
// types or a pairing link carries. Parsed by hand, not with URL: React Native's URL is a partial
// polyfill, and a strict grammar refuses what a WHATWG parser would quietly reinterpret (192.168.1
// as 192.168.0.1, 0x7f.1, an integer host, a backslash, user:pass@). Pure.

import {
  ADDRESS_MAX_LENGTH,
  DEFAULT_PORTS,
  INSECURE_SCHEME,
  LOOPBACK_IPV4_RANGES,
  LOOPBACK_NAME,
  PRIVATE_IPV4_RANGES,
  PRIVATE_NAME_SUFFIX,
  SECURE_SCHEME,
} from './config';
import { inIpv4Range, isIpv6SelfAddress, mappedIpv4, parseIpv4, parseIpv6 } from './ip';

export type AddressRefusal =
  | 'empty'
  /** a scheme other than http or https */
  | 'scheme'
  /** a path, a query, a fragment or user:pass@ — more than the server's address */
  | 'not_bare'
  | 'not_an_address'
  /** http:// to a host that is not on a private network */
  | 'http_public'
  /** localhost, 127.0.0.0/8 and the like: on a phone, the phone itself */
  | 'loopback';

export type ServerAddress =
  | {
      readonly ok: true;
      /** scheme://lower-cased host[:port], no trailing slash, the default port dropped */
      readonly origin: string;
      /** http:// on a private network: the app shows the unencrypted home network note */
      readonly insecure: boolean;
    }
  | { readonly ok: false; readonly reason: AddressRefusal };

export type HostKind = 'private' | 'public' | 'loopback' | 'invalid';

export type Authority = { readonly host: string; readonly port: number | null };

const SCHEME_PREFIX = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//;
const SCHEME_SEPARATOR = '://';
/** 'javascript:…', 'data:…', 'mailto:…': a scheme with no '//' (host:port has a digit after). */
const OPAQUE_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:(?!\d)/;
/** Whitespace, a control character or a backslash: never in an address anyone built. */
const UNSAFE_CHARACTERS = /[\s\u0000-\u001f\u007f\\]/;
const AUTHORITY_END = /[/?#]/;
/** What may follow the host and port: nothing, or the root path. */
const BARE_TAILS: ReadonlySet<string> = new Set(['', '/']);
const PORT = /^\d{1,5}$/;
const MAX_PORT = 65535;
/** A URL parser reads a host whose last label is a number as IPv4 (WHATWG "ends in a number"). */
const NUMERIC_LABEL = /^(\d+|0x[0-9a-f]*)$/;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DNS_NAME_MAX_LENGTH = 253;
const IPV6_LITERAL = /^\[([^\]]+)\]$/;
const SERVER_SCHEMES: ReadonlySet<string> = new Set([SECURE_SCHEME, INSECURE_SCHEME]);

function refuse(reason: AddressRefusal): ServerAddress {
  return Object.freeze({ ok: false, reason });
}

function isDnsName(name: string): boolean {
  const labels = name.split('.');
  return name.length <= DNS_NAME_MAX_LENGTH && labels.every((label) => DNS_LABEL.test(label));
}

function ipv4Kind(name: string): HostKind {
  const quad = parseIpv4(name);
  if (!quad) return 'invalid';
  if (LOOPBACK_IPV4_RANGES.some((range) => inIpv4Range(quad, range))) return 'loopback';
  return PRIVATE_IPV4_RANGES.some((range) => inIpv4Range(quad, range)) ? 'private' : 'public';
}

/** Every IPv6 literal is public (KC6), except those that reach the phone itself. */
function ipv6Kind(literal: string): HostKind {
  const inner = IPV6_LITERAL.exec(literal)?.[1];
  const groups = inner === undefined ? null : parseIpv6(inner);
  if (!groups) return 'invalid';
  const mapped = mappedIpv4(groups);
  const mappedLoopback = mapped !== null && ipv4Kind(mapped.join('.')) === 'loopback';
  return isIpv6SelfAddress(groups) || mappedLoopback ? 'loopback' : 'public';
}

function nameKind(name: string): HostKind {
  if (!isDnsName(name)) return 'invalid';
  if (name === LOOPBACK_NAME || name.endsWith(`.${LOOPBACK_NAME}`)) return 'loopback';
  return name.endsWith(PRIVATE_NAME_SUFFIX) ? 'private' : 'public';
}

/** What a host (a name, an IPv4 literal or a bracketed IPv6 literal) is, for the HTTPS rule. */
export function hostKind(host: string): HostKind {
  const name = host.toLowerCase();
  if (name.startsWith('[')) return ipv6Kind(name);
  const labels = name.split('.');
  return NUMERIC_LABEL.test(labels[labels.length - 1]) ? ipv4Kind(name) : nameKind(name);
}

/**
 * May this host be reached over http:// (D-HTTPS, KC6)? IPv4 literals in 10.0.0.0/8,
 * 172.16.0.0/12 and 192.168.0.0/16 (strict dotted quads), and names ending in '.local'.
 */
export function isPrivateHost(host: string): boolean {
  return hostKind(host) === 'private';
}

function parsePort(text: string): number | null {
  if (!PORT.test(text)) return null;
  const port = Number(text);
  return port >= 1 && port <= MAX_PORT ? port : null;
}

/** host[:port] (an IPv6 host in brackets) with no user info; null when malformed. */
export function parseAuthority(authority: string): Authority | null {
  if (authority.includes('@')) return null;
  const hostEnd = authority.startsWith('[') ? authority.indexOf(']') + 1 : 0;
  const colon = authority.indexOf(':', hostEnd);
  if (colon < 0) return { host: authority, port: null };
  const port = parsePort(authority.slice(colon + 1));
  return port === null ? null : { host: authority.slice(0, colon), port };
}

/** The scheme (lower-cased; https when none was typed) and what follows; null for another one. */
function splitScheme(text: string): { readonly scheme: string; readonly rest: string } | null {
  const match = SCHEME_PREFIX.exec(text);
  if (!match) {
    const otherScheme = text.includes(SCHEME_SEPARATOR) || OPAQUE_SCHEME.test(text);
    return otherScheme ? null : { scheme: SECURE_SCHEME, rest: text };
  }
  const scheme = match[1].toLowerCase();
  return SERVER_SCHEMES.has(scheme) ? { scheme, rest: text.slice(match[0].length) } : null;
}

/** The authority, and everything after it (path, query, fragment). */
export function splitAuthority(rest: string): {
  readonly authority: string;
  readonly tail: string;
} {
  const end = rest.search(AUTHORITY_END);
  if (end < 0) return { authority: rest, tail: '' };
  return { authority: rest.slice(0, end), tail: rest.slice(end) };
}

function originFor(scheme: string, { host, port }: Authority): ServerAddress {
  const kind = hostKind(host);
  if (kind === 'invalid') return refuse('not_an_address');
  if (kind === 'loopback') return refuse('loopback');
  const insecure = scheme === INSECURE_SCHEME;
  if (insecure && kind !== 'private') return refuse('http_public');
  const portSuffix = port === null || port === DEFAULT_PORTS[scheme] ? '' : `:${port}`;
  const origin = `${scheme}://${host.toLowerCase()}${portSuffix}`;
  return Object.freeze({ ok: true, origin, insecure });
}

/**
 * A typed or scanned server address as the origin the app will call: trimmed; https:// when no
 * scheme is given; only http and https; nothing but the host, the port and an optional '/';
 * http:// only to a private host (KC6).
 */
export function parseServerAddress(input: string): ServerAddress {
  const text = input.trim();
  if (text === '') return refuse('empty');
  if (text.length > ADDRESS_MAX_LENGTH || !hasOnlySafeCharacters(text)) {
    return refuse('not_an_address');
  }
  const split = splitScheme(text);
  if (!split) return refuse('scheme');
  const { authority, tail } = splitAuthority(split.rest);
  if (!BARE_TAILS.has(tail) || authority.includes('@')) return refuse('not_bare');
  const parsed = parseAuthority(authority);
  return parsed ? originFor(split.scheme, parsed) : refuse('not_an_address');
}

/** Is `text` free of whitespace, control characters and backslashes? */
export function hasOnlySafeCharacters(text: string): boolean {
  return !UNSAFE_CHARACTERS.test(text);
}
