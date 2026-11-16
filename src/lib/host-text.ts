// How a host must be written before the app judges it from its text (refuse first, never list the
// tricks): ASCII letters, digits and hyphens in dot-separated labels of legal length, and nothing
// else. A percent-escape, a non-ASCII or full-width character, a backslash, whitespace, brackets,
// an empty label or a trailing dot is refused before any classification, because the phone's
// networking stack would read such a string its own way. And a host whose last label reads as a
// number (digits, or 0x hex) is an IP address to a URL parser in every form it takes (octal, hex,
// one integer, fewer than four parts), so it is numeric, never a name. Pure.

import { parseIpv4 } from './ip';

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

/**
 * An origin and nothing more: http or https in lower case, a plain host (isPlainHost) and an
 * optional port from 1 to 65535. No user name, path, query, fragment or trailing slash.
 */
export function isPlainOrigin(text: string): boolean {
  const match = ORIGIN.exec(text);
  if (!match) return false;
  const [, , host = '', port] = match;
  const portFits = port === undefined || (Number(port) >= 1 && Number(port) <= MAX_PORT);
  return portFits && isPlainHost(host);
}
