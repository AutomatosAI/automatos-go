// R16, R21 and R22 as a test that keeps running in CI (US-021p): the store documents in
// docs/release say what the app and the store forms need. The listing's fields are within App Store
// Connect's limits and carry the app's name and legal-links.ts's URLs. The review notes name the
// app's real labels (imported from each strings module, so a renamed button fails here until the
// notes follow). The text pasted into a store form (each ```text block of the listing, the review
// notes and Play's App access) uses no SIGNUP, BILLING or DATA_CLAIMS phrase (US-021k's lists) and
// none of the words the app's terms rule out. Across every document: one minimum age, 16, but for
// the ALLOWED quotes; every privacy, terms and support address is legal-links.ts's; and no
// secret-shaped string, password value or person's email address. Explanations around a block
// (for Gerard) may name the rules they keep, which is why only the blocks are held to the phrases.

import { describe, expect, it } from 'vitest';

import { SIGN_IN_SCREEN_COPY } from '../../auth/strings';
import { HOME_COPY, MENU_COPY } from '../../chat/strings';
import { SHELL_COPY as CC_COPY } from '../../cc/strings';
import { expo, infoPlist } from '../../config/__tests__/app-json';
import { CONFIRM_COPY, CONNECT_SCREEN_COPY, WELCOME_COPY } from '../../connect/strings';
import { CONSENT_SHEET_COPY } from '../../consent/strings';
import { aiLabelText } from '../../core/web/lib/ai-label/copy';
import { PUSH_CATEGORY_COPY, PUSH_PHONE_COPY, PUSH_SETTINGS_COPY } from '../../push/strings';
import { SHELL_COPY } from '../../app-state/strings';
import { PICKER_COPY } from '../../styles/strings';
import { REPORT_COPY } from '../../ui/strings';
import { AI_VOICE_GREETING, VOICE_CENTRE_COPY, VOICE_ENTRY_COPY } from '../../voice/strings';
import { LEGAL_LINKS, PRIVACY_POLICY_URL, SUPPORT_URL } from '../legal-links';
import { PRIVACY_COPY } from '../strings';
import { BILLING, DATA_CLAIMS, MINIMUM_AGE, SIGNUP, agesIn } from './support/forbidden-copy';
import {
  AGE_RATING_DOC,
  ALLOWED_AGES,
  EXPORT_DOC,
  LISTING_LIMITS,
  PLAY_ACCESS_DOC,
  RELEASE_DOCS_DIR,
  REVIEW_NOTES_DOC,
  REVIEW_NOTES_LIMIT,
  STORE_LISTING_DOC,
  STORE_TEXT_DOCS,
  accountAddressesIn,
  charCount,
  fieldValue,
  legalAddresses,
  passwordValuesIn,
  pasteBlocks,
  secretsIn,
  statementUnits,
} from './support/release-docs';
import { readRepoFile, walkFiles } from './support/tree';

const releaseFiles = walkFiles(RELEASE_DOCS_DIR);
const markdownDocs = releaseFiles.filter((file) => file.endsWith('.md'));
const listing = readRepoFile(STORE_LISTING_DOC);
const reviewNotes = readRepoFile(REVIEW_NOTES_DOC);
const playAccess = readRepoFile(PLAY_ACCESS_DOC);
const notesBlock = fieldValue(reviewNotes, 'Notes');
const storeBlocks = STORE_TEXT_DOCS.flatMap((file) =>
  pasteBlocks(readRepoFile(file)).map((text) => ({ file, text })),
);
const description = fieldValue(listing, 'Description');

/** The words of the app's terms (CLAUDE.md 'Terms') that its store text never uses. */
const RULED_OUT_TERMS: readonly RegExp[] = [
  /\bartifacts?\b/i,
  /\boutputs?\b/i,
  /\brecipes?\b/i,
  /\bworkflows?\b/i,
  /\bjobs?\b/i,
  /\bthe assistant\b/i,
  /\bCommand Center\b/,
];

/** Labels the review notes send a reviewer to: each exactly as the app shows it. */
const REVIEW_LABELS: readonly string[] = [
  WELCOME_COPY.signIn,
  WELCOME_COPY.connect,
  SIGN_IN_SCREEN_COPY.usePassword,
  SIGN_IN_SCREEN_COPY.signIn,
  CONSENT_SHEET_COPY.heading,
  CONSENT_SHEET_COPY.agree,
  CONNECT_SCREEN_COPY.continue,
  CONNECT_SCREEN_COPY.scan,
  CONFIRM_COPY.title,
  CONFIRM_COPY.pair,
  SHELL_COPY.signOut,
  HOME_COPY.menu,
  MENU_COPY.newChat,
  MENU_COPY.chats,
  MENU_COPY.commandCentre,
  MENU_COPY.settings,
  ...Object.values(CC_COPY.tabs),
  aiLabelText(),
  REPORT_COPY.action,
  PRIVACY_COPY.title,
  PRIVACY_COPY.crashReports,
  PICKER_COPY.title,
  PUSH_SETTINGS_COPY.title,
  PUSH_PHONE_COPY.turnOn,
  PUSH_CATEGORY_COPY.reply,
  VOICE_ENTRY_COPY.label,
  VOICE_CENTRE_COPY.hold.talk.label,
  AI_VOICE_GREETING,
];

// Secret-shaped samples are joined at run time, so no file holds a whole one, not even a made-up one.
const join = (...parts: string[]) => parts.join('');
const SECRET_SAMPLES: readonly string[] = [
  join('pk', '_live_', 'A1b2C3d4E5f6G7h8'),
  join('sk', '_test_', 'A1b2C3d4E5f6G7h8'),
  join('sk', '-ant-api03-', 'x'.repeat(24)),
  join('amd', '_', 'Q'.repeat(24)),
  join('Exponent', 'PushToken[', 'abcDEF123456xyz', ']'),
  join('-----BEGIN ', 'RSA ', 'PRIVATE KEY-----'),
  join('eyJ', 'hbGciOiJIUzI1NiJ9', '.eyJ', 'zdWIiOiIxMjMifQ', '.c2lnbmF0dXJl', 'c2ln'),
  join('https://', '0123456789abcdef'.repeat(2), '@o1.ingest.de.sentry.io/1'),
];

describe('the helpers catch what they must', () => {
  it.each(SECRET_SAMPLES)('catches a secret shape (%#)', (sample) => {
    expect(secretsIn(`the value is ${sample} here`).length).toBeGreaterThan(0);
  });

  it.each([
    'the `pk_live_` Clerk key',
    'set `pk_live_…` in preview',
    'ExponentPushToken[…]',
    'ExponentPushToken[<token>]',
    'a paired phone sends amd_ tokens',
  ])('lets a name without a value through: “%s”', (text) => {
    expect(secretsIn(text)).toEqual([]);
  });

  it('finds a password given a value, and passes placeholders and None', () => {
    expect(passwordValuesIn(join('Password', ': hunter2hunter'))).toEqual(['hunter2hunter']);
    expect(passwordValuesIn(join('| Password | ', 'hunter2hunter |'))).toEqual(['hunter2hunter']);
    expect(
      passwordValuesIn('**Password:** `<demo account password — in App Store Connect only>`'),
    ).toEqual([]);
    expect(
      passwordValuesIn('| Password | None |\n| Password | `<in Play Console only>` |'),
    ).toEqual([]);
    expect(passwordValuesIn('enter the password and tap "Sign in"')).toEqual([]);
  });

  it('finds a person’s address, and passes published and placeholder ones', () => {
    expect(accountAddressesIn('write to someone@gmail.com')).toEqual(['someone@gmail.com']);
    expect(accountAddressesIn('privacy@automatos.app or reviewer@example.com')).toEqual([]);
  });

  it('finds every legal-page address, with or without its scheme', () => {
    expect(
      legalAddresses(
        'See https://automatos.app/privacy, ui.automatos.app/terms. Also automatos.app/contact and https://ui.automatos.app/chat or privacy@automatos.app.',
      ),
    ).toEqual(['https://automatos.app/privacy', 'ui.automatos.app/terms', 'automatos.app/contact']);
  });

  it('reads a statement wrapped over lines as one, and list items and rows apart', () => {
    expect(statementUnits('You must be at\nleast 18.\n\n- one\n- two\n| a | b |')).toEqual([
      'You must be at least 18.',
      '- one',
      '- two',
      '| a | b |',
    ]);
    expect(agesIn(statementUnits('You must be at\nleast 18.')[0])).toEqual([18]);
  });
});

describe('the store documents (US-021p)', () => {
  it.each([STORE_LISTING_DOC, REVIEW_NOTES_DOC, PLAY_ACCESS_DOC, AGE_RATING_DOC, EXPORT_DOC])(
    '%s is in docs/release',
    (file) => {
      expect(releaseFiles).toContain(file);
      expect(readRepoFile(file).length).toBeGreaterThan(1000);
    },
  );

  it('reads every block a person pastes into a store form', () => {
    expect(pasteBlocks(listing).length).toBeGreaterThanOrEqual(9);
    expect(pasteBlocks(reviewNotes).length).toBeGreaterThanOrEqual(2);
    expect(pasteBlocks(playAccess).length).toBe(3);
  });
});

describe('the App Store listing (R22)', () => {
  it.each(Object.entries(LISTING_LIMITS))('%s is within its limit of %i', (field, limit) => {
    const value = fieldValue(listing, field);
    expect(value.trim().length, field).toBeGreaterThan(0);
    expect(charCount(value), field).toBeLessThanOrEqual(limit);
    expect(listing).toContain(`## ${field}\n\nLimit ${limit.toLocaleString('en-GB')}`);
  });

  it('is named as app.json names the app, with a subtitle of its own', () => {
    expect(fieldValue(listing, 'Name')).toBe('Automatos Go');
    expect(fieldValue(listing, 'Name')).toBe(expo.name);
    expect(fieldValue(listing, 'Subtitle')).not.toContain('Automatos');
  });

  it('describes an AI assistant and states one age, 16', () => {
    expect(description).toContain('AI assistant');
    expect(agesIn(description)).toEqual([MINIMUM_AGE]);
  });

  it('lists keywords as App Store Connect reads them', () => {
    const keywords = fieldValue(listing, 'Keywords');
    const words = keywords.split(',');
    expect(keywords).toMatch(/^[\x20-\x7e]+$/);
    expect(keywords).not.toMatch(/\s/);
    expect(words.every((word) => word.length > 0)).toBe(true);
    expect(new Set(words.map((word) => word.toLowerCase())).size).toBe(words.length);
    expect(words.filter((word) => /^(?:automatos|go)$/i.test(word))).toEqual([]);
  });

  it("names legal-links.ts's support and privacy pages, and an https marketing page", () => {
    expect(fieldValue(listing, 'Support URL')).toBe(SUPPORT_URL);
    expect(fieldValue(listing, 'Privacy policy URL')).toBe(PRIVACY_POLICY_URL);
    const marketing = new URL(fieldValue(listing, 'Marketing URL'));
    expect(marketing.protocol).toBe('https:');
    expect(marketing.host).toBe('automatos.app');
  });

  it('gives the copyright a year and an owner, and no URL', () => {
    expect(fieldValue(listing, 'Copyright')).toMatch(/^20\d{2} \S.+$/);
    expect(fieldValue(listing, 'Copyright')).not.toMatch(/https?:|www\./);
  });
});

describe('App Review Information (R21)', () => {
  it("keeps the Notes within App Store Connect's limit", () => {
    expect(charCount(notesBlock)).toBeLessThanOrEqual(REVIEW_NOTES_LIMIT);
  });

  it.each(REVIEW_LABELS)('names “%s” as the app shows it', (label) => {
    expect(notesBlock).toContain(label);
  });

  it('describes both ways in, the own server as visibly as sign-in (Apple 2.3.1)', () => {
    expect(notesBlock).toContain('HOSTED SIGN-IN');
    expect(notesBlock).toContain('YOUR OWN SERVER (2.3.1)');
    expect(playAccess).toContain(`## Lane 2: your own server`);
  });

  it('keeps every account value in the store forms, never here', () => {
    expect(reviewNotes).toContain('<demo account email — in App Store Connect only>');
    expect(reviewNotes).toContain('<demo account password — in App Store Connect only>');
    expect(notesBlock).toContain('<code — in App Store Connect only>');
    expect(notesBlock).toContain('<review server address — in App Store Connect only>');
    expect(playAccess).toContain('<demo account email — in Play Console only>');
    expect(playAccess).toContain('<code — in Play Console only>');
  });
});

describe('the text pasted into a store form', () => {
  it.each([SIGNUP, BILLING, DATA_CLAIMS].map((rule) => [rule.id, rule] as const))(
    'uses no %s phrase',
    (_id, rule) => {
      const found = storeBlocks.flatMap(({ file, text }) =>
        rule.phrases
          .filter((phrase) => phrase.test(text))
          .map((phrase) => `${file}: /${phrase.source}/`),
      );
      expect(found).toEqual([]);
    },
  );

  it("uses none of the words the app's terms rule out", () => {
    const found = storeBlocks.flatMap(({ file, text }) =>
      RULED_OUT_TERMS.filter((term) => term.test(text)).map((term) => `${file}: /${term.source}/`),
    );
    expect(found).toEqual([]);
  });
});

describe('every document in docs/release', () => {
  it('reads every one of them', () => {
    expect(markdownDocs.length).toBeGreaterThanOrEqual(14);
    expect(markdownDocs).toContain('docs/release/privacy-facts.md');
    expect(releaseFiles.filter((file) => file.endsWith('.json')).length).toBeGreaterThanOrEqual(4);
  });

  it('names a privacy, terms or support page only by its legal-links.ts address', () => {
    const known = new Set(Object.values(LEGAL_LINKS));
    const wrong = markdownDocs.flatMap((file) =>
      legalAddresses(readRepoFile(file))
        .filter((address) => !known.has(address))
        .map((address) => `${file}: ${address}`),
    );
    expect(wrong).toEqual([]);
  });

  it('states one minimum age, 16, but for the ALLOWED quotes (R16)', () => {
    const allowed = (file: string, unit: string, age: number) =>
      ALLOWED_AGES.some(
        (entry) => entry.file === file && entry.age === age && unit.includes(entry.text),
      );
    const wrong = markdownDocs.flatMap((file) =>
      statementUnits(readRepoFile(file)).flatMap((unit) =>
        agesIn(unit)
          .filter((age) => age !== MINIMUM_AGE && !allowed(file, unit, age))
          .map((age) => `${file}: ${age} in “${unit}”`),
      ),
    );
    expect(wrong).toEqual([]);
  });

  it('allows only quotes that are there and still state their age (no stale entry)', () => {
    const stale = ALLOWED_AGES.filter(
      (entry) =>
        !statementUnits(readRepoFile(entry.file)).some(
          (unit) => unit.includes(entry.text) && agesIn(unit).includes(entry.age),
        ),
    );
    expect(stale.map((entry) => `${entry.file}: ${entry.text}`)).toEqual([]);
    ALLOWED_AGES.forEach((entry) => expect(entry.reason, entry.text).toMatch(/\(D12/));
  });

  it('states 16 in the age rating and the listing', () => {
    expect(agesIn(readRepoFile(AGE_RATING_DOC))).toContain(MINIMUM_AGE);
    expect(agesIn(listing)).toContain(MINIMUM_AGE);
  });

  it('holds no secret-shaped string, password value or person’s email address', () => {
    const found = releaseFiles.flatMap((file) => {
      const text = readRepoFile(file);
      return [
        ...secretsIn(text).map((hit) => `${file}: ${hit.name} (${hit.match.slice(0, 12)}…)`),
        ...passwordValuesIn(text).map((value) => `${file}: a password '${value.slice(0, 3)}…'`),
        ...accountAddressesIn(text).map((address) => `${file}: ${address}`),
      ];
    });
    expect(found).toEqual([]);
  });

  it('states the export-compliance answer app.json gives', () => {
    expect(infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(fieldValue(readRepoFile(EXPORT_DOC), 'The answer')).toBe(
      'ITSAppUsesNonExemptEncryption: false',
    );
  });
});
