import { describe, expect, it } from 'vitest';

import { PROVIDER_FACTORIES, isRegisteredMode } from '../providers/registry';
import { AUTH_MODES } from '../providers/types';
import { selectProvider } from '../select';
import { AUTH_COPY } from '../strings';

function discoveryWith(modes: readonly string[]) {
  return { auth: { modes, clerk: null } };
}

const UNSUPPORTED = { unsupported: true, message: 'This server needs a newer Automatos Go' };

describe('selectProvider (D-AUTH-PROVIDER)', () => {
  it("picks clerk for a server that offers 'clerk'", () => {
    expect(selectProvider(discoveryWith(['clerk']))).toEqual({ unsupported: false, mode: 'clerk' });
  });

  it("picks device for a server that offers 'device' (a paired self-hosted install, US-006)", () => {
    expect(AUTH_MODES).toContain('device');
    expect(selectProvider(discoveryWith(['device']))).toEqual({
      unsupported: false,
      mode: 'device',
    });
  });

  it("'oidc' is known but unregistered until PRD-257", () => {
    expect(AUTH_MODES).toContain('oidc');
    expect(selectProvider(discoveryWith(['oidc']))).toEqual(UNSUPPORTED);
  });

  it('an unknown mode is unsupported', () => {
    expect(selectProvider(discoveryWith(['saml-next']))).toEqual(UNSUPPORTED);
  });

  it('no modes at all is unsupported', () => {
    expect(selectProvider(discoveryWith([]))).toEqual(UNSUPPORTED);
  });

  it("takes the first mode it supports, in the server's order", () => {
    expect(selectProvider(discoveryWith(['oidc', 'magic', 'clerk', 'device']))).toEqual({
      unsupported: false,
      mode: 'clerk',
    });
    expect(selectProvider(discoveryWith(['oidc', 'device', 'clerk']))).toEqual({
      unsupported: false,
      mode: 'device',
    });
  });

  it('the copy is the strings module', () => {
    expect(AUTH_COPY.unsupportedServer).toBe(UNSUPPORTED.message);
  });

  it("registers 'clerk' and 'device' (not 'oidc'), and nothing outside the known modes", () => {
    expect(Object.keys(PROVIDER_FACTORIES)).toEqual(['clerk', 'device']);
    expect(isRegisteredMode('clerk')).toBe(true);
    expect(isRegisteredMode('device')).toBe(true);
    expect(isRegisteredMode('oidc')).toBe(false);
    expect(isRegisteredMode('constructor')).toBe(false);
  });
});
