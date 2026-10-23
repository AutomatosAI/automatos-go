// Which sign-in tree the root mounts (US-006d, lead 20 Oct: a self-hosted phone never contacts
// Clerk). An own server gets the device session and NO ClerkProvider, so no Clerk hook runs and no
// request reaches Clerk's Frontend API; the built-in hosted server gets ClerkProvider when this
// build can sign in to it; a build that cannot (no Clerk key or no API URL) still opens Welcome and
// Connect, and its not-configured state covers the hosted sign-in only (KC2). Until the keychain has
// said whether a server is paired nothing is mounted: guessing hosted would start Clerk on a phone
// that may be paired. Pure; src/auth/AuthRoot.tsx renders it.

import type { Env } from '../lib/env';
import type { CurrentServerSnapshot, OwnServer } from '../connect/current-server';

export type AuthBranch =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'own'; readonly own: OwnServer }
  | { readonly kind: 'hosted' }
  | { readonly kind: 'hosted_off' };

const LOADING: AuthBranch = Object.freeze({ kind: 'loading' });
const UNREADABLE: AuthBranch = Object.freeze({ kind: 'unreadable' });
const HOSTED: AuthBranch = Object.freeze({ kind: 'hosted' });
const HOSTED_OFF: AuthBranch = Object.freeze({ kind: 'hosted_off' });

/** Hosted sign-in needs both the build's API URL and its Clerk publishable key. */
export function hostedSignInConfigured(
  values: Pick<Env, 'apiUrl' | 'clerkPublishableKey'>,
): boolean {
  return values.apiUrl !== '' && values.clerkPublishableKey !== '';
}

export function authBranch(snapshot: CurrentServerSnapshot, hostedConfigured: boolean): AuthBranch {
  if (snapshot.status === 'loading') return LOADING;
  if (snapshot.status === 'unreadable') return UNREADABLE;
  if (snapshot.own) return Object.freeze({ kind: 'own', own: snapshot.own });
  return hostedConfigured ? HOSTED : HOSTED_OFF;
}
