// Server addresses (PRD-001 §4.5, D-HTTPS, KC6): the trust boundary for every address a person
// types or a pairing link carries. Parsed by hand, not with URL: React Native's URL is a partial
// polyfill, and a strict grammar refuses what a WHATWG parser would quietly reinterpret (192.168.1
// as 192.168.0.1, 0x7f.1, an integer host, a backslash, user:pass@). What a host is, and where
// http may go, is decided once in src/lib/host-text.ts (hostKind, httpAllowedTo), which the build's
// addresses and the API client ask too. Pure.

import { hostKind, httpAllowedTo } from '../lib/host-text';
import { ADDRESS_MAX_LENGTH, DEFAULT_PORTS, INSECURE_SCHEME, SECURE_SCHEME } from './config';

export { hostKind, type HostKind } from '../lib/host-text';

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
const SERVER_SCHEMES: ReadonlySet<string> = new Set([SECURE_SCHEME, INSECURE_SCHEME]);
/** A paired server is never the phone itself, in any build: loopback is refused before http. */
const PAIRING_BUILD = Object.freeze({ development: false });

function refuse(reason: AddressRefusal): ServerAddress {
  return Object.freeze({ ok: false, reason });
}

/**
 * May this host be reached over http:// (D-HTTPS, KC6)? IPv4 literals in 10.0.0.0/8,
 * 172.16.0.0/12 and 192.168.0.0/16 (strict dotted quads), and names ending in '.local'.
 */
export function isPrivateHost(host: string): boolean {
  return httpAllowedTo(host, PAIRING_BUILD);
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
  if (insecure && !httpAllowedTo(host, PAIRING_BUILD)) return refuse('http_public');
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
