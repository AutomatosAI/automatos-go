// The AI-provider consent sheet's names and tunables (D23, KC11; D-NO-HARDCODE): the copy version
// every agreement is tied to, the record's key in the app's encrypted store, and which of the role
// policy's actions send a person's words to Auto or an agent.

import type { RoleAction } from '../auth/role';

/**
 * The consent copy's version, part of every fingerprint: raising it when the sheet's wording
 * changes what a person agrees to asks everyone again.
 */
export const CONSENT_COPY_VERSION = 1;

/**
 * The records' key prefix in the app's encrypted MMKV store: one key per server origin, holding
 * that server's records by workspace id (store.ts).
 */
export const CONSENT_KEY_PREFIX = 'automatos.consent.v1';
export const CONSENT_KEY_SEPARATOR = '|';

/** The fingerprint's provider part for a server that does not list its providers (before W3). */
export const UNLISTED_FINGERPRINT = 'unlisted';
/** Between the copy version and the provider part of a fingerprint. */
export const FINGERPRINT_SEPARATOR = '|';

/**
 * What reaches an AI provider: messages to Auto (chat) and the Command Centre's answers, notes and
 * rebriefs (answer). A role that can do neither sends nothing and is never asked (D17).
 */
export const SENDING_ACTIONS: readonly RoleAction[] = Object.freeze(['chat', 'answer']);
