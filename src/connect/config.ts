// Connecting to your own server (D-NO-HARDCODE): every name and tunable the connect flow shares
// with the server, or with the app's own config, is here.

/** The pairing code (automatos-ai core/auth/pairing.py): no 0/O/1/I, read off a screen once. */
export const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PAIR_CODE_LENGTH = 8;
/** The server mints and hashes 'XXXX-XXXX': the app always sends that form (KC7). */
export const PAIR_CODE_SEPARATOR = '-';
export const PAIR_CODE_GROUP_LENGTH = PAIR_CODE_LENGTH / 2;
/** Longer than any code typed with spaces or hyphens: longer input is refused before it is read. */
export const PAIR_CODE_INPUT_MAX_LENGTH = 32;

/** The schemes a server address may use; a typed address with no scheme gets the first (KC6). */
export const SECURE_SCHEME = 'https';
export const INSECURE_SCHEME = 'http';
export const DEFAULT_PORTS: Readonly<Record<string, number>> = Object.freeze({
  [SECURE_SCHEME]: 443,
  [INSECURE_SCHEME]: 80,
});
/** A host name (253) with a scheme and a port fits well inside this; longer is not an address. */
export const ADDRESS_MAX_LENGTH = 512;

export type Ipv4Quad = readonly [number, number, number, number];
export type Ipv4Range = { readonly base: Ipv4Quad; readonly prefix: number };

/**
 * The private (RFC 1918) blocks http:// is allowed on (D-HTTPS, KC6). 172.16.0.0/12 joins the
 * PRD's 10.x and 192.168.x; 100.64.0.0/10 (Tailscale: use its HTTPS name) and 169.254.0.0/16
 * do not.
 */
export const PRIVATE_IPV4_RANGES: readonly Ipv4Range[] = Object.freeze([
  { base: [10, 0, 0, 0], prefix: 8 },
  { base: [172, 16, 0, 0], prefix: 12 },
  { base: [192, 168, 0, 0], prefix: 16 },
]);
/** On a phone these reach the phone itself: 127.0.0.0/8, and 0.0.0.0/8, which connects there. */
export const LOOPBACK_IPV4_RANGES: readonly Ipv4Range[] = Object.freeze([
  { base: [127, 0, 0, 0], prefix: 8 },
  { base: [0, 0, 0, 0], prefix: 8 },
]);
/** 'localhost' and every name under it (RFC 6761) are the phone itself. */
export const LOOPBACK_NAME = 'localhost';
/** Names on the home network (mDNS) may use http:// (D-HTTPS). */
export const PRIVATE_NAME_SUFFIX = '.local';

/** The pairing link: `{web_url}/go/pair?{query}` (automatos-ai services/mobile/pairing.py). */
export const PAIR_LINK_PATH = '/go/pair';
export const PAIR_LINK_API_PARAM = 'api';
export const PAIR_LINK_CODE_PARAM = 'code';
/** app.json `expo.scheme`: the same link as automatos://go/pair?… */
export const APP_SCHEME = 'automatos';
export const APP_PAIR_LINK = `${APP_SCHEME}:/${PAIR_LINK_PATH}`;
/** A pairing link is a host, a path and two short parameters: anything this long is not one. */
export const PAIR_LINK_MAX_LENGTH = 2048;

/** POST /pair's one refusal code: a wrong, expired or used code (automatos-ai api/mobile_devices.py). */
export const INVALID_PAIRING_CODE = 'invalid_pairing_code';
/**
 * The device token: 'amd_' and token_urlsafe(32), 47 characters (services/mobile/pairing.py). The
 * app reads the prefix, base64url and a length window; anything else is not a device token.
 */
export const DEVICE_TOKEN_PREFIX = 'amd_';
export const DEVICE_TOKEN_MIN_LENGTH = 36;
export const DEVICE_TOKEN_MAX_LENGTH = 512;

/** The install id (KC9): random bytes as base64url, inside the server's ^[A-Za-z0-9_-]{8,128}$. */
export const INSTALL_ID_BYTES = 16;
/** Its expo-secure-store item, outside the app's key registry so no wipe removes it (KC9). */
export const INSTALL_ID_ITEM = 'automatos.install-id.v1';

/** The server's column limits for a device (core/models/mobile_devices.py). */
export const DEVICE_NAME_MAX_LENGTH = 120;
export const APP_VERSION_MAX_LENGTH = 32;

/**
 * The paired record's expo-secure-store item (KC9), written through the app's key registry
 * (src/lib/secure-keys.ts) so sign-out and the reinstall wipe find it.
 */
export const PAIRED_RECORD_ITEM = 'automatos.paired-server.v1';

/**
 * The reinstall wipe's marker (install-marker.ts): its own small MMKV file, deleted with the app.
 * Not the encrypted store: that one's key is a keychain item every wipe deletes, so a marker kept
 * there would be lost with it and the next launch would wipe again.
 */
export const INSTALL_MARKER_STORE_ID = 'automatos-go.install';
export const INSTALL_MARKER_KEY = 'install-marker.v1';
export const INSTALL_MARKER_VALUE = 'checked';

/** The device lane's 401 codes (automatos-ai core/auth/device.py, core/auth/bearer_registry.py). */
export const DEVICE_REVOKED = 'device_revoked';
export const DEVICE_PAIRING_REQUIRED = 'device_pairing_required';
