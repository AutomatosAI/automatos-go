// How a host must be written before the app judges it from its text (refuse first, never list the
// tricks): ASCII letters, digits and hyphens in dot-separated labels of legal length, and nothing
// else. A percent-escape, a non-ASCII or full-width character, a backslash, whitespace, brackets,
// an empty label or a trailing dot is refused before any classification, because the phone's
// networking stack would read such a string its own way. And a host whose last label reads as a
// number (digits, or 0x hex) is an IP address to a URL parser in every form it takes (octal, hex,
// one integer, fewer than four parts), so it is numeric, never a name.
//
// Then what a server's host is, and where plain http may go (D-HTTPS, KC6), decided here once:
// https may reach any host; http only a home network (a private, RFC 1918, strict dotted quad or a
// name ending .local), and the loopback a simulator reaches its computer by in a development build
// only. Pairing (src/connect/address.ts, which refuses the phone itself for either scheme), the
// build's addresses (src/lib/env.ts) and the API client (src/api/client.ts, whoever built its
// server) all ask httpAllowedTo, so the bearer never goes in clear to a host it refuses. Pure.

import {
  inIpv4Range,
  isIpv6SelfAddress,
  LOOPBACK_IPV4_RANGES,
  mappedIpv4,
  parseIpv4,
  parseIpv6,
  PRIVATE_IPV4_RANGES,
} from './ip';

/** The text as written: ASCII letters, digits, hyphens and dots, tested BEFORE any case mapping. */
const ASCII_HOST = /^[A-Za-z0-9.-]+$/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** An IPv6 literal as a parser writes it: hex digits, colons and dots in brackets, nothing else. */
const IPV6_LITERAL = /^\[[0-9a-f:.]+\]$/;
/** scheme://host[:port] and nothing more: the host is judged by isPlainHost, the port by range. */
const ORIGIN = /^(https?):\/\/(\[[^\]]*\]|[^/:?#@]+)(?::(\d{1,5}))?$/;
const MAX_PORT = 65_535;
const NAME_MAX_LENGTH = 253;
/** A URL parser reads a host whose last label is a number as IPv4 (WHATWG "ends in a number"). */
const NUMBER_LABEL = /^(?:\d+|0x[0-9a-f]*)$/;
/** An IPv6 literal's inside, for the kind of host it is (parseIpv6 reads it strictly). */
const IPV6_INSIDE = /^\[([^\]]+)\]$/;
const SECURE_SCHEME = 'https';

/** 'localhost' and every name under it (RFC 6761) are the phone itself. */
export const LOOPBACK_NAME = 'localhost';
/** Names on the home network (mDNS) may use http:// (D-HTTPS). */
export const PRIVATE_NAME_SUFFIX = '.local';

export type HostKind = 'private' | 'public' | 'loopback' | 'invalid';

/** Whether the app may call http here: the build it runs in (a development build or not). */
export type HttpBuild = Readonly<{ development: boolean }>;

/**
 * The host's labels, lower-cased, when it is written plainly; null for anything else. The text is
 * tested as written first: lower-casing maps some non-ASCII letters to ASCII (the Kelvin sign
 * U+212A to `k`), and the network is handed the text, not its lower case.
 */
export function plainLabels(host: string): readonly string[] | null {
  if (!ASCII_HOST.test(host)) return null;
  const name = host.toLowerCase();
  if (name.length > NAME_MAX_LENGTH) return null;
  const labels = name.split('.');
  return labels.every((label) => LABEL.test(label)) ? Object.freeze(labels) : null;
}

/** Whether a URL parser would read these labels as an IP address rather than a name. */
export function readsAsNumber(labels: readonly string[]): boolean {
  return NUMBER_LABEL.test(labels[labels.length - 1] ?? '');
}

/** A host as the platform's URL reads it, compared as the app reads one: lower case, no last dot. */
export function comparableHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, '');
}

/**
 * A host every parser reads alike, as written: plain lower-case labels (a strict dotted quad when
 * it reads as a number) or an IPv6 literal.
 */
export function isPlainHost(host: string): boolean {
  if (IPV6_LITERAL.test(host)) return true;
  const labels = plainLabels(host);
  if (!labels || labels.join('.') !== host) return false;
  return !readsAsNumber(labels) || parseIpv4(host) !== null;
}

/** A plain origin's scheme and host (isPlainOrigin); null for any other text. */
function plainOriginParts(text: string): Readonly<{ scheme: string; host: string }> | null {
  const match = ORIGIN.exec(text);
  if (!match) return null;
  const [, scheme = '', host = '', port] = match;
  const portFits = port === undefined || (Number(port) >= 1 && Number(port) <= MAX_PORT);
  return portFits && isPlainHost(host) ? { scheme, host } : null;
}

/**
 * An origin and nothing more: http or https in lower case, a plain host (isPlainHost) and an
 * optional port from 1 to 65535. No user name, path, query, fragment or trailing slash.
 */
export function isPlainOrigin(text: string): boolean {
  return plainOriginParts(text) !== null;
}

function ipv4Kind(name: string): HostKind {
  const quad = parseIpv4(name);
  if (!quad) return 'invalid';
  if (LOOPBACK_IPV4_RANGES.some((range) => inIpv4Range(quad, range))) return 'loopback';
  return PRIVATE_IPV4_RANGES.some((range) => inIpv4Range(quad, range)) ? 'private' : 'public';
}

/** Every IPv6 literal is public (KC6), except those that reach the phone itself. */
function ipv6Kind(literal: string): HostKind {
  const inside = IPV6_INSIDE.exec(literal)?.[1];
  const groups = inside === undefined ? null : parseIpv6(inside);
  if (!groups) return 'invalid';
  const mapped = mappedIpv4(groups);
  const mappedLoopback = mapped !== null && ipv4Kind(mapped.join('.')) === 'loopback';
  return isIpv6SelfAddress(groups) || mappedLoopback ? 'loopback' : 'public';
}

function nameKind(name: string): HostKind {
  const labels = name.split('.');
  const named = name.length <= NAME_MAX_LENGTH && labels.every((label) => LABEL.test(label));
  if (!named) return 'invalid';
  if (name === LOOPBACK_NAME || name.endsWith(`.${LOOPBACK_NAME}`)) return 'loopback';
  return name.endsWith(PRIVATE_NAME_SUFFIX) ? 'private' : 'public';
}

/** What a host (a name, an IPv4 literal or a bracketed IPv6 literal) is, for the HTTPS rule. */
export function hostKind(host: string): HostKind {
  const name = host.toLowerCase();
  if (name.startsWith('[')) return ipv6Kind(name);
  const labels = name.split('.');
  return NUMBER_LABEL.test(labels[labels.length - 1] ?? '') ? ipv4Kind(name) : nameKind(name);
}

/**
 * May plain http reach this host (D-HTTPS, KC6)? A home network only: a private (RFC 1918) strict
 * dotted quad or a name ending .local; and the loopback (localhost, 127.0.0.0/8, [::1]) only in a
 * development build. The one rule for http, wherever an address comes from.
 */
export function httpAllowedTo(host: string, build: HttpBuild): boolean {
  const kind = hostKind(host);
  return kind === 'private' || (build.development && kind === 'loopback');
}

/**
 * An origin the API client may be made over, and send the bearer to: a plain origin
 * (isPlainOrigin), with https to any host and http only where httpAllowedTo allows it.
 */
export function isServerOrigin(text: string, build: HttpBuild): boolean {
  const parts = plainOriginParts(text);
  if (!parts) return false;
  return parts.scheme === SECURE_SCHEME || httpAllowedTo(parts.host, build);
}
