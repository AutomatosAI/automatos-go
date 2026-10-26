// The public pages the app and the store listings share (KR8, R04; Apple 5.1.1(i)): the privacy
// policy, the Terms and support, on automatos.app. Product constants like the bundle id, not
// per-environment config (the academy's src/settings/policyLinks.ts pattern): a self-hosted
// install's own policy is its operator's (privacy draft §11). Settings → Privacy & legal and the
// Welcome line open them in the system browser, never in the app (D-NO-WEBVIEW).

export const PRIVACY_POLICY_URL = 'https://automatos.app/privacy';
export const TERMS_URL = 'https://automatos.app/terms';
export const SUPPORT_URL = 'https://automatos.app/contact';

export type LegalPage = 'privacy' | 'terms' | 'support';

/** Every page by name, for the code that lists them (the section's rows, the audits). */
export const LEGAL_LINKS: Readonly<Record<LegalPage, string>> = Object.freeze({
  privacy: PRIVACY_POLICY_URL,
  terms: TERMS_URL,
  support: SUPPORT_URL,
});
