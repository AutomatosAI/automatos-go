// User-facing copy for connecting to your own server (one strings module per feature). No message
// names a status code or an internal (D-ONE-CLIENT); none points at making an account (D-SIGNIN).

import type { AddressRefusal } from './address';
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
