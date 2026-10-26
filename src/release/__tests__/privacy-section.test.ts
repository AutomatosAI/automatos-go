// Settings → Privacy & legal (US-021d): the rows in order with crash reports on and off, the
// version in each of its formats, and copy that never offers a deletion (D63), a plan (D8) or a
// way to make an account (D64), or claims as much as 'nothing leaves' (D70).

import { describe, expect, it } from 'vitest';

import { PRIVACY_POLICY_URL, SUPPORT_URL, TERMS_URL } from '../legal-links';
import {
  privacySectionRows,
  SHORT_UPDATE_ID_LENGTH,
  versionLabel,
  type PrivacyRow,
  type PrivacySectionInput,
} from '../privacy-section';
import { LEGAL_LINE_COPY, PRIVACY_COPY } from '../strings';

const UPDATE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const BASE: PrivacySectionInput = {
  crashOn: true,
  appVersion: '1.0.0',
  buildNumber: '42',
  updateId: null,
};

const ids = (rows: readonly PrivacyRow[]) => rows.map((row) => row.id);
const crashRow = (rows: readonly PrivacyRow[]) => rows.find((row) => row.kind === 'switch');

/** Every word a row shows or a person hears. */
function rowWords(row: PrivacyRow): string[] {
  switch (row.kind) {
    case 'switch':
      return [row.title, row.detail, row.note ?? ''];
    case 'info':
      return [row.title, row.value];
    default:
      return [row.title];
  }
}

function copyValues(copy: object): string[] {
  return Object.values(copy).map((value) => (typeof value === 'function' ? value('x') : value));
}

describe('privacySectionRows', () => {
  it('lists the pages, the switch, the test report and the version while reports are on', () => {
    const rows = privacySectionRows(BASE);
    expect(ids(rows)).toEqual([
      'privacy',
      'terms',
      'support',
      'crash-reports',
      'test-report',
      'version',
    ]);
    expect(rows.slice(0, 3)).toEqual([
      { kind: 'link', id: 'privacy', title: 'Privacy policy', url: PRIVACY_POLICY_URL },
      { kind: 'link', id: 'terms', title: 'Terms of use', url: TERMS_URL },
      { kind: 'link', id: 'support', title: 'Contact support', url: SUPPORT_URL },
    ]);
    expect(crashRow(rows)).toEqual({
      kind: 'switch',
      id: 'crash-reports',
      title: 'Send crash reports',
      detail:
        'Crash reports help us fix bugs. They never include your chats, questions or notifications.',
      note: null,
      on: true,
    });
    expect(rows[4]).toEqual({
      kind: 'action',
      id: 'test-report',
      title: 'Send a test error report',
    });
    expect(Object.isFrozen(rows)).toBe(true);
  });

  it('says nothing is sent and offers no test report while reports are off', () => {
    const rows = privacySectionRows({ ...BASE, crashOn: false });
    expect(ids(rows)).toEqual(['privacy', 'terms', 'support', 'crash-reports', 'version']);
    expect(crashRow(rows)).toMatchObject({ on: false, note: 'Nothing is sent.' });
  });

  it('ends with the version row', () => {
    expect(privacySectionRows(BASE).at(-1)).toEqual({
      kind: 'info',
      id: 'version',
      title: 'Version',
      value: '1.0.0 (42) · built-in',
    });
  });

  it('never offers a deletion, a plan, or a way to make an account', () => {
    const words = [true, false]
      .flatMap((crashOn) => privacySectionRows({ ...BASE, crashOn }))
      .flatMap(rowWords)
      .join('\n');
    expect(words).not.toMatch(/delete|remove (my|your) account|close (my|your) account/i);
    expect(words).not.toMatch(/\b(plan|plans|credit|credits|price|prices|pricing|billing)\b/i);
    expect(words).not.toMatch(/sign up|create an account|no account/i);
  });
});

describe('versionLabel', () => {
  it('names a downloaded update by the first group of its id', () => {
    expect(versionLabel({ ...BASE, updateId: UPDATE_ID })).toBe('1.0.0 (42) · update 1a2b3c4d');
    expect(SHORT_UPDATE_ID_LENGTH).toBe(8);
  });

  it('says built-in while the app runs the code it was built with', () => {
    expect(versionLabel(BASE)).toBe('1.0.0 (42) · built-in');
    expect(versionLabel({ ...BASE, updateId: '  ' })).toBe('1.0.0 (42) · built-in');
    expect(versionLabel({ ...BASE, updateId: undefined })).toBe('1.0.0 (42) · built-in');
  });

  it('leaves out a build number the platform does not report', () => {
    expect(versionLabel({ ...BASE, buildNumber: null })).toBe('1.0.0 · built-in');
    expect(versionLabel({ ...BASE, buildNumber: ' ', updateId: UPDATE_ID })).toBe(
      '1.0.0 · update 1a2b3c4d',
    );
  });

  it('says Unknown for a build with no version', () => {
    expect(versionLabel({ ...BASE, appVersion: null })).toBe('Unknown (42) · built-in');
    expect(versionLabel({ ...BASE, appVersion: '  ', buildNumber: null })).toBe(
      'Unknown · built-in',
    );
  });

  it('trims what the native modules report', () => {
    expect(
      versionLabel({ appVersion: ' 1.2.3 ', buildNumber: ' 7 ', updateId: ` ${UPDATE_ID} ` }),
    ).toBe('1.2.3 (7) · update 1a2b3c4d');
  });
});

describe('the release copy', () => {
  const copy = [...copyValues(PRIVACY_COPY), ...copyValues(LEGAL_LINE_COPY)].join('\n');

  it('makes no claim as broad as nothing leaving the server (D70)', () => {
    expect(copy).not.toMatch(/nothing (ever )?leaves|never leaves|stays on your server/i);
  });

  it('offers nothing commercial, no deletion and no sign-up (D8, D63, D64)', () => {
    expect(copy).not.toMatch(/\b(plan|plans|credit|credits|price|prices|pricing|billing)\b/i);
    expect(copy).not.toMatch(/delete|sign up|create an account|no account/i);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PRIVACY_COPY)).toBe(true);
    expect(Object.isFrozen(LEGAL_LINE_COPY)).toBe(true);
  });
});
