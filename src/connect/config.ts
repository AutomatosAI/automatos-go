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

// The private (RFC 1918) blocks http:// is allowed on, and the blocks that reach the phone itself
// (D-HTTPS, KC6), are defined with the IP parsing in src/lib/ip.ts, which the storage hop shares;
// the names (localhost, .local) and the rule itself with the host's text, in src/lib/host-text.ts,
// which the build's addresses and the API client ask too.

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
export { INSTALL_ID_ITEM } from '../storage/secure-registry';

/** The server's column limits for a device (core/models/mobile_devices.py). */
export const DEVICE_NAME_MAX_LENGTH = 120;
export const APP_VERSION_MAX_LENGTH = 32;

/**
 * The paired record's expo-secure-store item (KC9), written through the app's key registry
 * (src/lib/secure-keys.ts) so sign-out and the reinstall wipe find it.
 */
export { PAIRED_RECORD_ITEM } from '../storage/secure-registry';

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

/**
 * An own server's answers that mean it is not running (US-006d 'not_running'), beside no answer at
 * all: a reverse proxy in front of it that cannot reach it (502 Bad Gateway, 504 Gateway Timeout).
 * Not 503: the server itself answers that while running.
 */
export const NOT_RUNNING_GATEWAY_STATUSES: readonly number[] = Object.freeze([502, 504]);

/**
 * The server's name as Connect, Settings and the refusal copy show it (the discovery document's
 * `name`): text from the network, so trimmed and cut to this; blank → the server's address.
 */
export const SERVER_NAME_MAX_LENGTH = 120;

/**
 * How a self-hosted install is started, as Not running shows it (PRD-001 §4.7): the install's own
 * docker compose, run on the server in the folder it was installed in, detached.
 */
export const SELF_HOSTED_START_COMMAND = 'docker compose up -d';

/**
 * POST /devices/{id}/rotate's refusal for a token already rotated out (automatos-ai
 * services/mobile/devices.py): asking again with it can never succeed (US-006i).
 */
export const TOKEN_SUPERSEDED = 'token_superseded';

/**
 * Remove this phone (remove-device.ts) waits this long for the server before forgetting it anyway:
 * a server that is not running must not hold Forget this server for the client's full timeout.
 */
export const REMOVE_DEVICE_TIMEOUT_MS = 10_000;
