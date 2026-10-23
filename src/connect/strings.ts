// User-facing copy for connecting to your own server (one strings module per feature). No message
// names a status code or an internal (D-ONE-CLIENT); none points at making an account (D-SIGNIN).

import { AUTH_COPY } from '../auth/strings';
import type { AddressRefusal } from './address';
import type { PairRefusal } from './api';
import type { DeviceRefusalReason } from './expiry';
import type { ConnectFailure } from './flow';
import type { PairCodeRefusal } from './pair-code';
import type { OwnServerRefusal } from './server-support';

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
    "This server isn't taking phones yet. Its operator turns pairing on with LOCAL_REMOTE_ACCESS=paired ('Reach your install from your phone' in the self-hosting docs), then restarts it.",
  too_many: 'Too many pairing tries from this network. Wait a few minutes, then try again.',
  busy: "The server couldn't pair this phone just now. Try again in a minute.",
  unreachable:
    "Can't reach this server. Check the address and your phone's connection, then try again.",
  invalid_response:
    "This server answered in a way this version of Automatos Go can't read. Update the app, then try again.",
  refused: `This server didn't pair this phone. ${NEW_CODE}`,
});

/**
 * Why Connect stopped short (flow.ts): discovery's answer, the step it leads to, or the pairing.
 * Each says what to do next; 'hosted' sends the person to Sign in to Automatos.
 */
export const CONNECT_FAILURE_COPY: Readonly<Record<ConnectFailure, string>> = Object.freeze({
  ...PAIR_REFUSAL_COPY,
  no_discovery:
    "This address doesn't answer like an Automatos server that pairs phones. Check the address; if it's right, update the server's Automatos.",
  not_automatos:
    "This address didn't answer like an Automatos server. Check the address, or update Automatos Go, then try again.",
  discovery_failed: "The server couldn't say what it is just now. Try again in a minute.",
  hosted: 'This is the Automatos hosted server. Use Sign in to Automatos instead.',
  unsupported: `${AUTH_COPY.unsupportedServer}. Update the app, then try again.`,
  keychain: "Automatos Go couldn't use this phone's keychain. Unlock your phone, then try again.",
  not_saved:
    "This phone paired, but couldn't switch to the server. Make a new code in Studio → Settings → Phones & devices, then pair again.",
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

/** Why a paired phone's own server can't be opened (server-support.ts): the title and what to do. */
export const OWN_SERVER_COPY: Readonly<
  Record<
    Exclude<OwnServerRefusal, 'no_device'>,
    { readonly message: string; readonly detail: string }
  >
> = Object.freeze({
  no_discovery: Object.freeze({
    message: "This server's version of Automatos can't pair phones yet. Update it.",
    detail: 'Once the server is updated, open Automatos Go again.',
  }),
  pairing_off: Object.freeze({
    message: 'This server has stopped taking phones',
    detail:
      "Its operator turns pairing back on with LOCAL_REMOTE_ACCESS=paired ('Reach your install from your phone' in the self-hosting docs), then restarts it.",
  }),
});

/** Welcome (WelcomeScreen.tsx): the first run, or a phone connected nowhere (PRD-001 §4.5). */
export const WELCOME_COPY = Object.freeze({
  title: 'Automatos Go',
  lead: 'Sign in to your Automatos workspace, or connect to an Automatos server you run.',
  signIn: 'Sign in to Automatos',
  connect: 'Connect to your own server',
  /** A build with no hosted sign-in (src/session/auth-branch.ts hostedSignInConfigured). */
  signInOff: AUTH_COPY.notConfiguredTitle,
});

/** Connect (ConnectScreen.tsx): the server's address and the pairing code. */
export const CONNECT_SCREEN_COPY = Object.freeze({
  /** The eyebrow role sets it in capitals. */
  eyebrow: 'Automatos Go',
  title: 'Connect to your own server',
  lead: "Get a pairing code in Studio → Settings → Phones & devices, then scan it, or type it here with your server's address.",
  addressLabel: 'Server address',
  addressPlaceholder: 'https://automatos.example.com',
  addressHelper: 'Its HTTPS address, or its address on your home network.',
  codeLabel: 'Pairing code',
  codePlaceholder: 'ABCD-EFGH',
  codeHelper: 'The 8 characters Studio shows.',
  scan: 'Scan the code in Studio',
  continue: 'Continue',
  /** While discovery is read: stops the check and keeps what was typed. */
  cancel: 'Cancel',
  /** 'hosted': this address is the Automatos hosted server. */
  signIn: WELCOME_COPY.signIn,
  back: 'Back',
  checking: 'Checking the server…',
});

/** The confirm card (ConfirmCard.tsx): where this phone is about to pair (KC8). */
export const CONFIRM_COPY = Object.freeze({
  title: 'Pair with this server?',
  lead: 'Check this is your server before you pair this phone with it.',
  edition: 'Edition',
  address: 'Address',
  /** The discovery document's api_url, shown only when it names another address (KC5). */
  listedAddress: 'Address the server lists',
  listedAddressNote: 'Automatos Go uses the address above, the one that answered.',
  pair: 'Pair',
  pairing: 'Pairing…',
  tryAgain: 'Try again',
  /** A wrong or spent code: back to the fields for a new one. */
  newCode: 'Enter a new code',
  back: 'Back',
});

/** http:// on a private address (D-HTTPS): the card's note, in words as well as colour. */
export const INSECURE_NOTE_COPY = Object.freeze({
  title: 'Unencrypted home network',
  message:
    'This address uses http://, so what this phone and the server send is not encrypted. Anyone on the same network could read it. Pair only on a network you trust.',
});

/** Where {server} goes in DATA_NOTE_OWN_SERVER. */
export const SERVER_PLACEHOLDER = '{server}';

/**
 * KC16's data note, the one statement this wave makes about where data goes, word for word. No copy
 * says more (nothing like 'nothing leaves your server'): the app still reports crashes, checks for
 * updates and may send notifications through Expo.
 */
export const DATA_NOTE_OWN_SERVER =
  "Your chats, files and reports stay on {server}. Automatos Go itself sends crash reports to Automatos, checks Expo for app updates and, if this server's operator agrees, sends notifications through Expo and Apple or Google.";

/** The data note for one own server. */
export function dataNoteFor(server: string): string {
  return DATA_NOTE_OWN_SERVER.replace(SERVER_PLACEHOLDER, server);
}
