// Settings → Privacy & legal as data (R03, R04; PRD-001 §4.7 Account: 'privacy policy, Terms,
// version'): the three public pages, the 'Send crash reports' switch (KR7), the test report while
// it is on, and the version with the code the app runs. Pure, so components/PrivacySection.tsx only
// lays the rows out. Nothing here deletes an account or a workspace (D63); nothing commercial (D8).

import { LEGAL_LINKS, type LegalPage } from './legal-links';
import { PRIVACY_COPY } from './strings';

export type PrivacyRow =
  | {
      readonly kind: 'link';
      readonly id: LegalPage;
      readonly title: string;
      readonly url: string;
    }
  | {
      readonly kind: 'switch';
      readonly id: 'crash-reports';
      readonly title: string;
      readonly detail: string;
      /** 'Nothing is sent.' while off; null while on. */
      readonly note: string | null;
      readonly on: boolean;
    }
  | { readonly kind: 'action'; readonly id: 'test-report'; readonly title: string }
  | {
      readonly kind: 'info';
      readonly id: 'version';
      readonly title: string;
      readonly value: string;
    };

export type PrivacySectionInput = {
  /** The user's 'Send crash reports' switch. */
  readonly crashOn: boolean;
  /** app.json's version, as the binary carries it; blank when the config has none. */
  readonly appVersion: string | null | undefined;
  /** The iOS CFBundleVersion; null where the platform reports none. */
  readonly buildNumber: string | null | undefined;
  /** The downloaded update the app runs; null while it runs the code it was built with. */
  readonly updateId: string | null | undefined;
};

/** The first group of the update's UUID: enough to tell two updates apart in a bug report. */
export const SHORT_UPDATE_ID_LENGTH = 8;

const LINK_TITLES: Readonly<Record<LegalPage, string>> = Object.freeze({
  privacy: PRIVACY_COPY.privacyPolicy,
  terms: PRIVACY_COPY.terms,
  support: PRIVACY_COPY.support,
});

const LINK_ORDER: readonly LegalPage[] = Object.freeze(['privacy', 'terms', 'support']);

/** '1.0.0 (42) · update 1a2b3c4d', '1.0.0 (42) · built-in', or '1.0.0 · built-in' with no build. */
export function versionLabel({
  appVersion,
  buildNumber,
  updateId,
}: Omit<PrivacySectionInput, 'crashOn'>): string {
  const version = appVersion?.trim() || PRIVACY_COPY.unknownVersion;
  const build = buildNumber?.trim();
  const update = updateId?.trim();
  const code = update
    ? PRIVACY_COPY.update(update.slice(0, SHORT_UPDATE_ID_LENGTH))
    : PRIVACY_COPY.builtIn;
  return `${build ? `${version} (${build})` : version} · ${code}`;
}

function linkRow(id: LegalPage): PrivacyRow {
  return { kind: 'link', id, title: LINK_TITLES[id], url: LEGAL_LINKS[id] };
}

function crashRow(on: boolean): PrivacyRow {
  return {
    kind: 'switch',
    id: 'crash-reports',
    title: PRIVACY_COPY.crashReports,
    detail: PRIVACY_COPY.crashDetail,
    note: on ? null : PRIVACY_COPY.crashOff,
    on,
  };
}

/** The section's rows in order; the test report only while crash reports are on. */
export function privacySectionRows(input: PrivacySectionInput): readonly PrivacyRow[] {
  const testReport: readonly PrivacyRow[] = input.crashOn
    ? [{ kind: 'action', id: 'test-report', title: PRIVACY_COPY.testReport }]
    : [];
  return Object.freeze([
    ...LINK_ORDER.map(linkRow),
    crashRow(input.crashOn),
    ...testReport,
    { kind: 'info', id: 'version', title: PRIVACY_COPY.version, value: versionLabel(input) },
  ]);
}
