// A server that has moved to https (D-HTTPS, docs/app-standard.md rule 13.2c), pure. The app never
// follows a redirect (src/api/transport.ts). But a person may type or scan the http address of a
// server whose proxy now answers "use https": then Connect reads where that redirect pointed and,
// only when it is the same server's own https address, checks that address in its place. The
// person still sees the address on the card and still presses Pair (KC8): nothing is adopted
// unseen. Any other redirect is a failure like any other.

import { hasOnlySafeCharacters, parseAuthority, parseServerAddress } from './address';
import { SECURE_SCHEME } from './config';

const SCHEME_END = '://';
const SECURE_PREFIX = `${SECURE_SCHEME}${SCHEME_END}`;
const PATH_SEPARATOR = '/';

/** The host of an origin the address parser built (scheme://host[:port]). */
function hostOf(origin: string): string | null {
  const authority = origin.slice(origin.indexOf(SCHEME_END) + SCHEME_END.length);
  return parseAuthority(authority)?.host.toLowerCase() ?? null;
}

/**
 * `to` as the https address of the very server asked at `origin`: an https address the app would
 * accept, on the same host as an http one it accepted. Ports may differ (http on 8000, https on
 * 443). Null for anything else. Both callers go through here: the lookup below, and the flow's
 * reducer, which trusts no action to have been checked.
 */
export function httpsAddressOfSameServer(origin: string, to: string): string | null {
  const asked = parseServerAddress(origin);
  if (!asked.ok || !asked.insecure) return null;
  const target = parseServerAddress(to);
  if (!target.ok || target.insecure) return null;
  const host = hostOf(asked.origin);
  return host !== null && host === hostOf(target.origin) ? target.origin : null;
}

/**
 * The https address a server answers at, read from the redirect it gave when asked at its http
 * one: an absolute https address, on the same host, for the very path that was asked, written
 * with no stray character. Anything else is null: another host, another path, a query, http
 * again, a relative address, a space or a second slash before the path, an address the parser
 * refuses, or a server that was already asked over https.
 */
export function httpsTwin(
  origin: string,
  redirectTo: string | undefined,
  askedPath: string,
): string | null {
  if (!redirectTo || !hasOnlySafeCharacters(redirectTo)) return null;
  if (!redirectTo.startsWith(SECURE_PREFIX) || !redirectTo.endsWith(askedPath)) return null;
  const before = redirectTo.slice(0, redirectTo.length - askedPath.length);
  if (before.endsWith(PATH_SEPARATOR)) return null;
  return httpsAddressOfSameServer(origin, before);
}
