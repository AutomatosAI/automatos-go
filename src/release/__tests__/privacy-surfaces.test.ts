// Where the privacy policy and the Terms are reachable (R04; Apple 5.1.1(i)): Settings mounts the
// Privacy & legal section, the first screen a signed-out person sees carries 'Privacy · Terms' with
// the same two addresses, and both open the system browser through the app's opener, never a
// WebView or an in-app browser. The components cannot render under vitest (no React renderer), so
// their wiring is read from the source.

import { describe, expect, it } from 'vitest';

import { readRepoFile } from './support/tree';

const SETTINGS = 'app/(app)/settings/index.tsx';
const WELCOME_ROUTE = 'app/welcome.tsx';
const WELCOME = 'src/connect/screens/WelcomeScreen.tsx';
const SECTION = 'src/release/components/PrivacySection.tsx';
const LINE = 'src/release/components/LegalLine.tsx';
const OPENER = 'src/release/components/use-open-page.ts';
const COMPONENT_LIMIT = 150;

const IN_APP_BROWSER = /react-native-webview|expo-web-browser|WebBrowser|\bWebView\b/;

describe('Settings → Privacy & legal', () => {
  it('is mounted on the Account screen', () => {
    const text = readRepoFile(SETTINGS);
    expect(text).toContain("from '../../../src/release/components/PrivacySection'");
    expect(text).toMatch(/<PrivacySection \/>/);
  });

  it('drives the switch and the test report through src/observability and confirms in a toast', () => {
    const text = readRepoFile(SECTION);
    expect(text).toMatch(
      /import \{[^}]*setCrashReportsEnabled[^}]*\} from '\.\.\/\.\.\/observability'/,
    );
    expect(text).toContain('sendTestReport()');
    expect(text).toContain('toast.show(');
    expect(text).not.toMatch(/@sentry\/react-native/);
  });
});

describe('the legal line on Welcome', () => {
  it('is on the screen /welcome renders', () => {
    expect(readRepoFile(WELCOME_ROUTE)).toContain("from '../src/connect/screens/WelcomeScreen'");
    const text = readRepoFile(WELCOME);
    expect(text).toContain("from '../../release/legal-links'");
    expect(text).toMatch(/<LegalLine privacyUrl=\{PRIVACY_POLICY_URL\} termsUrl=\{TERMS_URL\} \/>/);
  });

  it("reads 'Privacy · Terms'", () => {
    const text = readRepoFile(LINE);
    expect(text).toContain('LEGAL_LINE_COPY.privacy}');
    expect(text).toContain('LEGAL_LINE_COPY.separator}');
    expect(text).toContain('LEGAL_LINE_COPY.terms}');
  });
});

describe('the pages open in the system browser', () => {
  it.each([SECTION, LINE, OPENER])('%s uses no WebView or in-app browser', (file) => {
    expect(readRepoFile(file)).not.toMatch(IN_APP_BROWSER);
  });

  it("the opener is the app's system-browser opener", () => {
    const text = readRepoFile(OPENER);
    expect(text).toContain("import { openInBrowser } from '../../cc/open-studio'");
    expect(readRepoFile('src/cc/open-studio.ts')).toContain('Linking.openURL(url)');
  });

  it.each([SECTION, LINE])('%s opens pages only through the opener', (file) => {
    const text = readRepoFile(file);
    expect(text).toContain("from './use-open-page'");
    expect(text).not.toMatch(/\bLinking\b/);
  });

  it.each([SECTION, LINE])('%s stays under the component limit', (file) => {
    expect(readRepoFile(file).split('\n').length).toBeLessThan(COMPONENT_LIMIT);
  });
});
