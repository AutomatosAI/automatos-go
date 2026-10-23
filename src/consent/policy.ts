// When the consent sheet is needed (D23, KC11, D17): before a person who can send anything to Auto
// or an agent does so, and again whenever what they agreed to no longer matches. The fingerprint
// is the copy version plus the sorted provider ids ('unlisted' for a server that lists none), so a
// provider added or removed, a server that starts listing names, or a new copy version asks again.
// A viewer sends nothing and is never asked (a viewer promoted to editor is, at the next
// bootstrap); a workspace that lists no provider needs no sheet. Pure.

import type { WorkspaceRole } from '../api/workspace';
import { roleCan } from '../auth/role';
import {
  CONSENT_COPY_VERSION,
  FINGERPRINT_SEPARATOR,
  SENDING_ACTIONS,
  UNLISTED_FINGERPRINT,
} from './config';
import { providerNames, type ConsentProviders } from './providers';
import type { ConsentRecord } from './store';

/** Providers there is something to agree to. */
export type AgreeableProviders = Exclude<ConsentProviders, { readonly kind: 'none' }>;

export type ConsentInput = {
  /** The bootstrap's role (KC12), never one derived here. */
  readonly role: WorkspaceRole;
  readonly providers: ConsentProviders;
  /** This server and workspace's record (store.ts), or none. */
  readonly record: ConsentRecord | null;
};

/** Can this role send words that reach an AI provider? */
export function canSend(role: WorkspaceRole): boolean {
  return SENDING_ACTIONS.some((action) => roleCan(role, action));
}

/** 'unlisted', or the ids sorted as a JSON array (no id can run into the next). */
function providersPart(providers: ConsentProviders): string {
  if (providers.kind === 'unlisted') return UNLISTED_FINGERPRINT;
  const ids = providers.kind === 'listed' ? providers.providers.map(({ id }) => id) : [];
  return JSON.stringify([...ids].sort());
}

/** The copy version and the sorted ids; the same list in any order is the same fingerprint. */
export function fingerprintOf(
  providers: ConsentProviders,
  copyVersion: number = CONSENT_COPY_VERSION,
): string {
  return `${copyVersion}${FINGERPRINT_SEPARATOR}${providersPart(providers)}`;
}

export function consentNeeded({ role, providers, record }: ConsentInput): boolean {
  if (!canSend(role)) return false;
  if (providers.kind === 'none') return false;
  return record?.fingerprint !== fingerprintOf(providers);
}

/** The record 'Agree and continue' writes: what the sheet showed, and when. */
export function consentRecordFor(providers: AgreeableProviders, agreedAt: Date): ConsentRecord {
  return Object.freeze({
    fingerprint: fingerprintOf(providers),
    providerNames: Object.freeze([...providerNames(providers)]),
    agreedAt: agreedAt.toISOString(),
    copyVersion: CONSENT_COPY_VERSION,
  });
}
