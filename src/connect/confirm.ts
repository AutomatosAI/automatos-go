// The confirm card and the pairing it leads to (KC5, KC8, KC9, KC10). What the card shows comes
// from the discovery document, read at the origin the person typed or scanned: that origin is the
// one every later call uses, and the document's api_url is only shown when it names another
// address (on a local install without PUBLIC_API_HOST it is the request's base URL, which behind a
// reverse proxy can be an internal one). web_url is Studio's address when it is http(s) with a
// host, else the origin. push.expo is recorded for wave A4 and nothing asks about push (KC10).
// The paired record joins the card with POST /pair's answer; the flow's own state keeps it
// WITHOUT the token, which lives only in the device store (KC9). Pure.

import type { Discovery } from '../api/discovery';
import { withoutTrailingSlash } from '../api/url';
import { hasOnlySafeCharacters, hostKind, parseAuthority, splitAuthority } from './address';
import type { PairedDevice } from './api';
import { SERVER_NAME_MAX_LENGTH } from './config';
import type { PairedRecord } from './device-store';
import { isSameOrigin } from './next-step';

/** What the confirm card shows and Pair sends. */
export type ConfirmDetails = {
  /** The origin that answered discovery: every call goes here (KC5). */
  readonly origin: string;
  /** http:// on a private address: the unencrypted home network note (D-HTTPS). */
  readonly insecure: boolean;
  readonly serverName: string;
  /** As the document sends it ('local', 'saas', …); the card puts it in words. */
  readonly edition: string;
  /** Studio on the web for this server. */
  readonly webUrl: string;
  /** The document names another API address than the origin: the card shows it. */
  readonly apiUrlDiffers: boolean;
  /** The document's api_url: shown when it differs, never called (KC5). */
  readonly documentApiUrl: string;
  /** This server sends push through Expo (recorded for wave A4; nothing asks, KC10). */
  readonly pushExpo: boolean;
  /** The pairing code as the server hashed it, 'XXXX-XXXX' (KC7). */
  readonly code: string;
};

/** What discovery was read for: the parsed origin and the canonical code. */
export type CheckedServer = Pick<ConfirmDetails, 'origin' | 'insecure' | 'code'>;

/** A saved pairing as the flow keeps it: everything but the token (KC9). */
export type ConnectedRecord = Readonly<Omit<PairedRecord, 'token'>>;

const WEB_ADDRESS = /^(https?):\/\/(.*)$/i;
const SCHEME_SEPARATOR = '://';

/** host[:port] of an origin parseServerAddress returned. */
export function authorityOf(origin: string): string {
  return origin.slice(origin.indexOf(SCHEME_SEPARATOR) + SCHEME_SEPARATOR.length);
}

/** The document's name, trimmed and cut to length; blank → the server's address. */
export function serverNameFrom(name: string | undefined, origin: string): string {
  const trimmed = Array.from(name?.trim() ?? '')
    .slice(0, SERVER_NAME_MAX_LENGTH)
    .join('')
    .trim();
  return trimmed === '' ? authorityOf(origin) : trimmed;
}

/** The document's web_url when it is http(s) with a well-formed host; otherwise the origin. */
export function webUrlFrom(webUrl: string, origin: string): string {
  const text = webUrl.trim();
  const match = hasOnlySafeCharacters(text) ? WEB_ADDRESS.exec(text) : null;
  const authority = match ? parseAuthority(splitAuthority(match[2]).authority) : null;
  const usable = authority !== null && hostKind(authority.host) !== 'invalid';
  return usable ? withoutTrailingSlash(text) : origin;
}

/** The confirm card for a server whose discovery said it takes paired phones. */
export function confirmDetailsFrom(checked: CheckedServer, discovery: Discovery): ConfirmDetails {
  const { origin, insecure, code } = checked;
  return Object.freeze({
    origin,
    insecure,
    serverName: serverNameFrom(discovery.name, origin),
    edition: discovery.edition,
    webUrl: webUrlFrom(discovery.web_url, origin),
    apiUrlDiffers: !isSameOrigin(discovery.api_url, origin),
    documentApiUrl: discovery.api_url,
    pushExpo: discovery.push.expo,
    code,
  });
}

/** The record the device store keeps (US-006c): the card, POST /pair's answer and when it paired. */
export function pairedRecordFrom(
  details: ConfirmDetails,
  device: PairedDevice,
  pairedAt: string,
): PairedRecord {
  return Object.freeze({
    origin: details.origin,
    webUrl: details.webUrl,
    serverName: details.serverName,
    edition: details.edition,
    insecure: details.insecure,
    pushExpo: details.pushExpo,
    deviceId: device.deviceId,
    workspaceId: device.workspaceId,
    token: device.token,
    rotateAfter: device.rotateAfter,
    pairedAt,
  });
}

/** The record with its token left behind: what the flow may hold (KC9). */
export function withoutToken(record: PairedRecord): ConnectedRecord {
  return Object.freeze({
    origin: record.origin,
    webUrl: record.webUrl,
    serverName: record.serverName,
    edition: record.edition,
    insecure: record.insecure,
    pushExpo: record.pushExpo,
    deviceId: record.deviceId,
    workspaceId: record.workspaceId,
    rotateAfter: record.rotateAfter,
    pairedAt: record.pairedAt,
  });
}
