// US-007b: when the consent sheet is needed (D23, KC11, D17). Roles are picked through roleCan, so
// no role is named here (role-source.test.ts): a writer can send, a reader cannot.

import { describe, expect, it } from 'vitest';

import { WORKSPACE_ROLES } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import { CONSENT_COPY_VERSION } from '../config';
import {
  canSend,
  consentNeeded,
  consentRecordFor,
  fingerprintOf,
  type AgreeableProviders,
} from '../policy';
import type { ConsentProviders } from '../providers';

const WRITER = WORKSPACE_ROLES.find((role) => roleCan(role, 'chat'));
const READER = WORKSPACE_ROLES.find((role) => !roleCan(role, 'chat'));
if (!WRITER || !READER) throw new Error('the role matrix lost its writer or its reader');

const DEEPSEEK = { id: 'deepseek', name: 'DeepSeek' };
const RETELL = { id: 'retell', name: 'Retell AI' };
const VOYAGE = { id: 'voyage', name: 'Voyage AI' };

function listed(...providers: { id: string; name: string }[]): AgreeableProviders {
  return { kind: 'listed', providers };
}

const UNLISTED: AgreeableProviders = { kind: 'unlisted' };
const NONE: ConsentProviders = { kind: 'none' };
const AGREED_AT = new Date('2026-10-23T09:00:00.000Z');

describe('canSend: who is ever asked', () => {
  it('every role that can chat or answer sends; the rest send nothing (D17)', () => {
    for (const role of WORKSPACE_ROLES) {
      expect(canSend(role)).toBe(roleCan(role, 'chat') || roleCan(role, 'answer'));
    }
    expect(canSend(WRITER)).toBe(true);
    expect(canSend(READER)).toBe(false);
  });
});

describe('fingerprintOf', () => {
  it('is the copy version and the sorted ids: the same list in any order matches', () => {
    expect(fingerprintOf(listed(VOYAGE, DEEPSEEK))).toBe(fingerprintOf(listed(DEEPSEEK, VOYAGE)));
    expect(fingerprintOf(listed(DEEPSEEK, VOYAGE))).toBe(
      `${CONSENT_COPY_VERSION}|["deepseek","voyage"]`,
    );
  });

  it("is 'unlisted' for a server that lists none, never an empty list", () => {
    expect(fingerprintOf(UNLISTED)).toBe(`${CONSENT_COPY_VERSION}|unlisted`);
    expect(fingerprintOf(UNLISTED)).not.toBe(fingerprintOf(listed()));
    expect(fingerprintOf(listed({ id: 'unlisted', name: 'X' }))).not.toBe(fingerprintOf(UNLISTED));
  });

  it('ignores the names: a renamed provider is the same provider', () => {
    expect(fingerprintOf(listed({ id: 'retell', name: 'Retell' }))).toBe(
      fingerprintOf(listed(RETELL)),
    );
  });

  it('cannot run two ids into one', () => {
    expect(fingerprintOf(listed({ id: 'a,b', name: 'X' }))).not.toBe(
      fingerprintOf(listed({ id: 'a', name: 'A' }, { id: 'b', name: 'B' })),
    );
  });
});

describe('consentNeeded: every branch', () => {
  const agreedTo = (providers: ConsentProviders) =>
    providers.kind === 'none' ? null : consentRecordFor(providers, AGREED_AT);

  it('never for a role that sends nothing, whatever the list or record', () => {
    for (const providers of [listed(DEEPSEEK), UNLISTED, NONE]) {
      expect(consentNeeded({ role: READER, providers, record: null })).toBe(false);
    }
  });

  it('never when the server lists no provider', () => {
    expect(consentNeeded({ role: WRITER, providers: NONE, record: null })).toBe(false);
  });

  it('with no record: asked, listed or unlisted', () => {
    expect(consentNeeded({ role: WRITER, providers: listed(DEEPSEEK), record: null })).toBe(true);
    expect(consentNeeded({ role: WRITER, providers: UNLISTED, record: null })).toBe(true);
  });

  it('not again for the same list, in any order; nor for the same unlisted server', () => {
    const record = agreedTo(listed(DEEPSEEK, RETELL));
    expect(consentNeeded({ role: WRITER, providers: listed(RETELL, DEEPSEEK), record })).toBe(
      false,
    );
    const unlisted = agreedTo(UNLISTED);
    expect(consentNeeded({ role: WRITER, providers: UNLISTED, record: unlisted })).toBe(false);
  });

  it('again when a provider is added (Retell, once Auto Live is switched on)', () => {
    const record = agreedTo(listed(DEEPSEEK));
    expect(consentNeeded({ role: WRITER, providers: listed(DEEPSEEK, RETELL), record })).toBe(true);
  });

  it('again when a provider is removed', () => {
    const record = agreedTo(listed(DEEPSEEK, VOYAGE));
    expect(consentNeeded({ role: WRITER, providers: listed(DEEPSEEK), record })).toBe(true);
  });

  it('again when an unlisted server starts listing names', () => {
    const record = agreedTo(UNLISTED);
    expect(consentNeeded({ role: WRITER, providers: listed(DEEPSEEK), record })).toBe(true);
  });

  it('again after a copy-version bump', () => {
    const providers = listed(DEEPSEEK);
    const record = {
      ...consentRecordFor(providers, AGREED_AT),
      fingerprint: fingerprintOf(providers, CONSENT_COPY_VERSION - 1),
      copyVersion: CONSENT_COPY_VERSION - 1,
    };
    expect(consentNeeded({ role: WRITER, providers, record })).toBe(true);
  });

  it('for a reader promoted to writer, who agreed to nothing yet', () => {
    const providers = listed(DEEPSEEK);
    expect(consentNeeded({ role: READER, providers, record: null })).toBe(false);
    expect(consentNeeded({ role: WRITER, providers, record: null })).toBe(true);
  });
});

describe('consentRecordFor: what Agree and continue writes', () => {
  it('the fingerprint, the names the sheet showed, when, and the copy version', () => {
    expect(consentRecordFor(listed(DEEPSEEK, RETELL), AGREED_AT)).toEqual({
      fingerprint: `${CONSENT_COPY_VERSION}|["deepseek","retell"]`,
      providerNames: ['DeepSeek', 'Retell AI'],
      agreedAt: '2026-10-23T09:00:00.000Z',
      copyVersion: CONSENT_COPY_VERSION,
    });
  });

  it('names nobody for an unlisted server', () => {
    expect(consentRecordFor(UNLISTED, AGREED_AT).providerNames).toEqual([]);
  });
});
