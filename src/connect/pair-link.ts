// The pairing link (PRD-001 §4.5, KC8, KC13): the QR code Studio shows, or a link the OS hands the
// app: `{web_url}/go/pair?api=<API address>&code=<code>` (automatos-ai services/mobile/pairing.py)
// or automatos://go/pair?…. The link's own host is never contacted, so any http(s) host serves (a
// home install's web address is often http://, even localhost): only its api parameter is, after
// parseServerAddress, and only once the person confirms (KC8). Pure.

import {
  hasOnlySafeCharacters,
  hostKind,
  parseAuthority,
  parseServerAddress,
  splitAuthority,
} from './address';
import {
  APP_PAIR_LINK,
  INSECURE_SCHEME,
  PAIR_LINK_API_PARAM,
  PAIR_LINK_CODE_PARAM,
  PAIR_LINK_MAX_LENGTH,
  PAIR_LINK_PATH,
  SECURE_SCHEME,
} from './config';
import { normalizePairCode } from './pair-code';

export type PairLink = {
  /** the API address the server named, as parseServerAddress keeps it */
  readonly apiOrigin: string;
  readonly insecure: boolean;
  /** 'XXXX-XXXX', as the server hashed it */
  readonly code: string;
};

type Param = readonly [name: string | null, value: string | null];

const WEB_LINK_PREFIX = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//;
const WEB_LINK_SCHEMES: ReadonlySet<string> = new Set([SECURE_SCHEME, INSECURE_SCHEME]);
const PLUS = /\+/g;

/** Everything before the '?': automatos://go/pair, or http(s)://<a well-formed host>/go/pair. */
function isPairTarget(target: string): boolean {
  if (target === APP_PAIR_LINK) return true;
  const match = WEB_LINK_PREFIX.exec(target);
  if (!match || !WEB_LINK_SCHEMES.has(match[1].toLowerCase())) return false;
  const { authority, tail } = splitAuthority(target.slice(match[0].length));
  const parsed = parseAuthority(authority);
  return tail === PAIR_LINK_PATH && parsed !== null && hostKind(parsed.host) !== 'invalid';
}

function decode(text: string): string | null {
  try {
    return decodeURIComponent(text.replace(PLUS, ' '));
  } catch {
    return null; // a malformed escape: not a link the server built
  }
}

function param(part: string): Param {
  const at = part.indexOf('=');
  return at < 0 ? [decode(part), ''] : [decode(part.slice(0, at)), decode(part.slice(at + 1))];
}

/** The link's api and code, each exactly once; null when one is missing, repeated or malformed. */
function pairParams(query: string): { readonly api: string; readonly code: string } | null {
  const params = query.split('&').map(param);
  if (params.some(([name, value]) => name === null || value === null)) return null;
  const valuesOf = (wanted: string): readonly string[] =>
    params.flatMap(([name, value]) => (name === wanted && value !== null ? [value] : []));
  const [api, code] = [valuesOf(PAIR_LINK_API_PARAM), valuesOf(PAIR_LINK_CODE_PARAM)];
  return api.length === 1 && code.length === 1 ? { api: api[0], code: code[0] } : null;
}

/**
 * A scanned or opened pairing link as the server to confirm and the code to pair with; null for
 * anything else (another QR code, a missing or repeated parameter, an http api on a public host,
 * javascript:, data:, file: or any other scheme). Other parameters are ignored.
 */
export function parsePairLink(text: string): PairLink | null {
  const link = text.trim();
  const readable = link.length <= PAIR_LINK_MAX_LENGTH && hasOnlySafeCharacters(link);
  if (!readable || link.includes('#')) return null;
  const at = link.indexOf('?');
  if (at < 0 || !isPairTarget(link.slice(0, at))) return null;
  const params = pairParams(link.slice(at + 1));
  if (!params) return null;
  const api = parseServerAddress(params.api);
  const code = normalizePairCode(params.code);
  if (!api.ok || !code.ok) return null;
  return Object.freeze({ apiOrigin: api.origin, insecure: api.insecure, code: code.code });
}
