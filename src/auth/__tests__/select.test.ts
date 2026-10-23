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

  it("'device' is known but unregistered until US-006", () => {
    expect(AUTH_MODES).toContain('device');
    expect(selectProvider(discoveryWith(['device']))).toEqual(UNSUPPORTED);
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
  });

  it('the copy is the strings module', () => {
    expect(AUTH_COPY.unsupportedServer).toBe(UNSUPPORTED.message);
  });

  it("registers 'clerk' only in this wave, and nothing outside the known modes", () => {
    expect(Object.keys(PROVIDER_FACTORIES)).toEqual(['clerk']);
    expect(isRegisteredMode('clerk')).toBe(true);
    expect(isRegisteredMode('constructor')).toBe(false);
  });
});
