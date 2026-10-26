// User-facing copy for the release wave (one strings module per feature): Settings → Privacy &
// legal and the legal line on Welcome. Nothing commercial (D8), no pointer to making an account
// (D64), nothing that deletes (D63), and no claim about data broader than the code (D70).

export const PRIVACY_COPY = Object.freeze({
  /** The section's name in Settings. */
  title: 'Privacy & legal',
  privacyPolicy: 'Privacy policy',
  terms: 'Terms of use',
  support: 'Contact support',
  /** Every link row's hint: the page leaves the app. */
  opensInBrowser: 'Opens in your browser.',
  /** The browser did not open (no handler, the system refused). */
  linkFailed: 'Your browser did not open. Try again in a moment.',
  crashReports: 'Send crash reports',
  crashDetail:
    'Crash reports help us fix bugs. They never include your chats, questions or notifications.',
  /** Under the switch while it is off. */
  crashOff: 'Nothing is sent.',
  testReport: 'Send a test error report',
  testReportHint: 'Sends one sample report, so you can check that crash reports arrive.',
  testReportSent: 'Test report sent.',
  /** Reports are on, but this build cannot send them (no crash-report address, Sentry not started). */
  testReportNotSent: 'No report was sent. This build is not set up to send crash reports.',
  version: 'Version',
  /** The build's version is missing (a development build without app.json's version). */
  unknownVersion: 'Unknown',
  /** The app runs the code it was built with. */
  builtIn: 'built-in',
  /** The app runs an update it downloaded: 'update 1a2b3c4d'. */
  update: (shortId: string) => `update ${shortId}`,
});

/** The legal line on Welcome: 'Privacy · Terms'. */
export const LEGAL_LINE_COPY = Object.freeze({
  privacy: 'Privacy',
  terms: 'Terms',
  separator: '·',
  privacyLabel: 'Privacy policy',
  termsLabel: 'Terms of use',
});
