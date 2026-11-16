// The licence audit's lists (scripts/__tests__/release-licences.test.ts, rule 8.3): the kinds of
// licence the app ships, each read by a person, and the packages allowed to ship without one.

import { frozen, reasoned } from './types';

/** Every kind of licence the app ships today, as the packages declare them. */
export const LICENCE_IDS = reasoned(
  'Every kind of licence the app ships today, as the packages declare them. A new one arriving fails here. Then: read that licence and decide, before the dependency is merged, whether the app may ship it and what it would owe beyond showing its text (a copyleft licence can ask for the source of what it covers); only then add it here, naming the package that brought it in the commit. An id leaving the list fails too: take it out.',
  [
    '(Apache-2.0 AND BSD-3-Clause)',
    '(BSD-2-Clause OR MIT OR Apache-2.0)',
    '(BSD-3-Clause OR GPL-2.0)',
    '(MIT OR CC0-1.0)',
    '0BSD',
    // qrcode-terminal's older `licenses` field, as it is written: Apache-2.0
    'Apache 2.0',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'BlueOak-1.0.0',
    'CC-BY-4.0',
    'CC0-1.0',
    'ISC',
    'MIT',
    'MPL-2.0',
    'Python-2.0',
    'Unlicense',
  ],
);

export type NoLicence = Readonly<{ name: string; reason: string }>;

/**
 * A package that declares no licence, or declares itself UNLICENSED (no one else may use it), ships
 * only when it is named here with the reason it may. None does today.
 */
export const NO_LICENCE_ALLOWED: readonly NoLicence[] = frozen([]);
