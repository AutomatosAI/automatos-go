// How "What Auto depends on" is wired (US-G07), read from the source (nothing renders in node):
// Settings places the section after Voice and before Privacy & legal; the section draws nothing
// where discovery does not list readiness; and nothing in src/readiness asks for a permission,
// runs the push registrar, leaves the app or opens a URL. Its rows are read through getters only.

import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { sources } from '../../push/__tests__/source-files';
import { readRepoFile } from '../../release/__tests__/support/tree';

const MODULE = path.resolve(__dirname, '..');
const OWN = sources(MODULE).filter(
  (each) => !each.file.includes(`${path.sep}__tests__${path.sep}`),
);

describe('Settings', () => {
  const settings = readRepoFile('app/(app)/settings/index.tsx');

  it('places the section after Voice and before Privacy & legal', () => {
    const voice = settings.indexOf('VOICE_SCREENS.settings');
    const readiness = settings.indexOf('<ReadinessSection />');
    const privacy = settings.indexOf('<PrivacySection />');
    expect(voice).toBeGreaterThan(-1);
    expect(readiness).toBeGreaterThan(voice);
    expect(privacy).toBeGreaterThan(readiness);
  });

  it('the section is gated on discovery: an older server shows Settings unchanged', () => {
    const section = readRepoFile('src/readiness/ReadinessSection.tsx');
    const hook = readRepoFile('src/readiness/use-readiness.ts');
    expect(section).toContain('if (!readiness.shown) return null;');
    expect(hook).toContain('const shown = canReadiness(discovery);');
    expect(hook).toMatch(/enabled: shown/);
  });
});

describe('read only', () => {
  const FORBIDDEN: readonly [string, RegExp][] = [
    ['a permission prompt', /\.press\(|askPermission|requestPermissions|requestMicrophone/],
    ['a registrar run', /registrar\.run|runPhoneAction/],
    ['leaving the app', /\bLinking\b|openSettings|openURL|WebBrowser/],
    ['a URL literal', /https?:\/\//],
  ];

  it.each(FORBIDDEN)('no file in src/readiness makes %s', (_what, pattern) => {
    const hits = OWN.filter((each) => pattern.test(each.text)).map((each) => each.file);
    expect(hits).toEqual([]);
  });
});
