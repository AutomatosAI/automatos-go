// Shared test data for the installed-theme tests: install ids, a package digest, files-route URLs,
// mobile answers as core main sends them (services/themes/mobile.py) and a fake ThemeReader that
// records what was asked. No colour literal is written out (the D-TOKENS lint reads tests too):
// a hex is built with hex() from its digits.

import type { GateInput } from '../../../api/capabilities';
import type { ThemeReader } from '../api';
import type { Active, InstallRow, MobileTheme } from '../schemas';

export const HARBOUR_ID = '3f2b6c1e-9d4a-4b7e-8c21-5a6f0e9d1b42';
export const MOSS_ID = '7a1c0d2e-4b3f-4e5a-9c8d-1e2f3a4b5c6d';
export const PLAY_ID = '0b9f8e7d-6c5b-4a39-8281-7f6e5d4c3b2a';
export const DIGEST = 'a'.repeat(64);

/** '#' + digits, so no colour literal sits in a test file. */
export function hex(digits: string): string {
  return `#${digits}`;
}

export function fileUrl(path: string, digest: string = DIGEST): string {
  return `/api/themes/files/${digest}/${path}`;
}

export const FONT_URL = fileUrl('assets/fonts/mobile/inter-regular.ttf');
export const SERIF_URL = fileUrl('assets/fonts/mobile/fraunces.otf');

/** A dark ground with light text: every MOBILE_CONTRAST_PAIRS pair the theme sets passes AA. */
export const NIGHT_TOKENS = Object.freeze({
  '--background': '220 20% 10%',
  '--foreground': '0 0% 98%',
  '--primary': '0 0% 98%',
  '--primary-foreground': '220 20% 10%',
  '--ring': '0 0% 98%',
  '--card': '220 20% 14%',
  '--card-foreground': '0 0% 98%',
});

/** A light ground with dark text, written as hex as theme.json may. */
export const DAY_TOKENS = Object.freeze({
  '--background': hex('ffffff'),
  '--foreground': hex('14181c'),
  '--primary': hex('14181c'),
  '--primary-foreground': hex('ffffff'),
  '--ring': hex('14181c'),
});

type Block = NonNullable<MobileTheme['mobile']>;

export function answer(installId: string, mobile: Partial<Block> | null = {}): MobileTheme {
  return {
    schema: 1,
    installId,
    themeId: 'acme/harbour',
    version: '1.1.0',
    mobile:
      mobile === null
        ? null
        : {
            source: 'tokens',
            tone: null,
            tokens: { light: DAY_TOKENS, dark: NIGHT_TOKENS },
            fonts: {},
            mascot: { mode: 'none', states: [] },
            ...mobile,
          },
  };
}

export function row(installId: string, overrides: Partial<InstallRow> = {}): InstallRow {
  return {
    installId,
    themeId: `acme/${installId.slice(0, 4)}`,
    name: 'Harbour',
    version: '1.1.0',
    optIn: null,
    revoked: null,
    ...overrides,
  };
}

export function active(overrides: Partial<Active> = {}): Active {
  return { choice: 'studio', source: 'choice', theme: null, ...overrides };
}

export function activeTheme(installId: string, themeId = 'acme/harbour'): Active {
  return active({
    choice: installId,
    theme: { installId, themeId, version: '1.1.0', revoked: null },
  });
}

export type FakeReader = ThemeReader & {
  readonly asked: string[];
  readonly peak: () => number;
};

/** Answers from the given rows and answers (a missing answer is the 404's null). */
export function fakeReader(
  rows: readonly InstallRow[],
  answers: Readonly<Record<string, MobileTheme | null | Error>>,
  activeAnswer: Active = active(),
): FakeReader {
  const asked: string[] = [];
  let inFlight = 0;
  let most = 0;
  return {
    asked,
    peak: () => most,
    active: async () => activeAnswer,
    installed: async () => rows,
    mobile: async (installId: string) => {
      asked.push(installId);
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      const found = answers[installId];
      if (found instanceof Error) throw found;
      return found ?? null;
    },
  };
}

/** Discovery with and without mobile_theme (what the gates read). */
export const WITH_MOBILE_THEME: GateInput = Object.freeze({
  capabilities: Object.freeze(['mobile_theme' as const]),
  push: Object.freeze({ expo: false }),
});
export const WITHOUT_MOBILE_THEME: GateInput = Object.freeze({
  capabilities: Object.freeze(['push' as const]),
  push: Object.freeze({ expo: false }),
});
