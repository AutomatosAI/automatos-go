// User-facing copy for connecting to your own server (one strings module per feature). No message
// names a status code or an internal (D-ONE-CLIENT); none points at making an account (D-SIGNIN).

import type { AddressRefusal } from './address';
import type { PairRefusal } from './api';
import type { DeviceRefusalReason } from './expiry';
import type { PairCodeRefusal } from './pair-code';

/** Why a typed server address was refused (address.ts). */
export const ADDRESS_COPY: Readonly<Record<AddressRefusal, string>> = Object.freeze({
  empty: "Type your server's address.",
  scheme: 'Use an address that starts with https://',
  not_bare: 'Type just the server address, like https://automatos.example.com',
  not_an_address:
    "That doesn't look like a server address. Type it like https://automatos.example.com",
  http_public:
    'This address needs https://. Only an address on your home network, like 192.168.1.20 or nas.local, can use http://.',
  loopback:
    "On a phone, that address is the phone itself. Use your server's address on your network, like 192.168.1.20 or nas.local.",
});

const CODE_CHARACTERS = 'Codes use letters and the digits 2-9, with no O, 0, I or 1.';

/** Why a typed pairing code was refused (pair-code.ts). */
export const PAIR_CODE_COPY: Readonly<Record<PairCodeRefusal, string>> = Object.freeze({
  empty: 'Type the 8-character code from Studio.',
  length: `The code has 8 characters, like ABCD-EFGH. ${CODE_CHARACTERS}`,
  alphabet: `That isn't a pairing code. ${CODE_CHARACTERS}`,
});

const NEW_CODE = 'Make a new one in Studio → Settings → Phones & devices.';
const PAIR_AGAIN = 'Pair it again from Studio → Settings → Phones & devices.';

/** Why POST /pair did not pair this phone (api.ts), each with the fix. */
export const PAIR_REFUSAL_COPY: Readonly<Record<PairRefusal, string>> = Object.freeze({
  bad_code: `That code didn't work. Codes last 10 minutes and work once. ${NEW_CODE}`,
  pairing_off:
    "This server isn't taking phones yet. Its operator turns pairing on with LOCAL_REMOTE_ACCESS=paired, then restarts it.",
  too_many: 'Too many pairing tries from this network. Wait a few minutes, then try again.',
  busy: "The server couldn't pair this phone just now. Try again in a minute.",
  unreachable:
    "Can't reach this server. Check the address and your phone's connection, then try again.",
  invalid_response:
    "This server answered in a way this version of Automatos Go can't read. Update the app, then try again.",
  refused: `This server didn't pair this phone. ${NEW_CODE}`,
});

/** This phone's name in Studio's Phones & devices (device-info.ts). */
export const DEVICE_NAME_COPY = Object.freeze({
  ios: 'Automatos Go on iPhone',
  android: 'Automatos Go on Android',
} as const);

/** Why a paired phone is back at Connect (expiry.ts), naming the server it was paired to. */
export const DEVICE_REFUSAL_COPY: Readonly<
  Record<DeviceRefusalReason, (server: string) => string>
> = Object.freeze({
  revoked: (server: string) => `This phone was removed from ${server}. ${PAIR_AGAIN}`,
  pairing_required: (server: string) => `${server} only answers paired phones. ${PAIR_AGAIN}`,
  ended: (server: string) => `This phone's connection to ${server} ended. ${PAIR_AGAIN}`,
});
