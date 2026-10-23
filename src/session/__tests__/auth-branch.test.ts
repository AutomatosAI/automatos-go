// Which sign-in tree the root mounts (US-006d): the device session for a paired own server, Clerk
// only for the built-in hosted server in a build that can sign in to it, nothing before the
// keychain has said (never a guess that would start Clerk on a paired phone).

import { describe, expect, it } from 'vitest';

import { ownServerOf, type CurrentServerSnapshot } from '../../connect/current-server';
import { RECORD } from '../../connect/__tests__/paired-record';
import { authBranch, hostedSignInConfigured } from '../auth-branch';

const OWN = ownServerOf(RECORD);
const PAIRED: CurrentServerSnapshot = { status: 'ready', own: OWN, ended: null };
const HOSTED: CurrentServerSnapshot = { status: 'ready', own: null, ended: null };
const ENDED: CurrentServerSnapshot = {
  status: 'ready',
  own: null,
  ended: { reason: 'revoked', serverName: RECORD.serverName, origin: RECORD.origin },
};

describe('authBranch', () => {
  it('mounts the device session for a paired own server, whatever the build can do', () => {
    expect(authBranch(PAIRED, true)).toEqual({ kind: 'own', own: OWN });
    expect(authBranch(PAIRED, false)).toEqual({ kind: 'own', own: OWN });
  });

  it('mounts Clerk for the hosted server only when the build can sign in to it', () => {
    expect(authBranch(HOSTED, true)).toEqual({ kind: 'hosted' });
    expect(authBranch(HOSTED, false)).toEqual({ kind: 'hosted_off' });
  });

  it('after a refusal the phone is on the hosted tree again (the gate shows Connect)', () => {
    expect(authBranch(ENDED, true)).toEqual({ kind: 'hosted' });
  });

  it('mounts nothing until the keychain has said, and offers a retry when it refuses', () => {
    expect(authBranch({ status: 'loading' }, true)).toEqual({ kind: 'loading' });
    expect(authBranch({ status: 'unreadable' }, true)).toEqual({ kind: 'unreadable' });
  });
});

describe('hostedSignInConfigured', () => {
  it("needs both the build's API URL and its Clerk publishable key", () => {
    const apiUrl = 'https://api.example.test';
    expect(hostedSignInConfigured({ apiUrl, clerkPublishableKey: 'pk_test_abc' })).toBe(true);
    expect(hostedSignInConfigured({ apiUrl, clerkPublishableKey: '' })).toBe(false);
    expect(hostedSignInConfigured({ apiUrl: '', clerkPublishableKey: 'pk_test_abc' })).toBe(false);
  });
});
