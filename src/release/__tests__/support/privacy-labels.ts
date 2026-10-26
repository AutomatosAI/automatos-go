// docs/release/privacy-labels.json as the release audits read it (test-only): its zod schema, the
// data types each store form asks about (App Store Connect's with KR15's manifest keys; Play's Data
// safety types), both in the form's order, and the words each form document uses for an answer.

import { z } from 'zod';

import { readRepoFile } from './tree';

export const LABELS_PATH = 'docs/release/privacy-labels.json';
export const APP_STORE_DOC = 'docs/release/app-store-privacy.md';
export const PLAY_DOC = 'docs/release/play-data-safety.md';

export const MANIFEST_KEY_PREFIX = 'NSPrivacyCollectedDataType';
export const APP_FUNCTIONALITY = 'AppFunctionality';

/** [category, App Store Connect's wording, manifest key suffix]: Apple's 35 types (KR15). */
const APPLE_FORM: readonly (readonly [string, string, string])[] = [
  ['Contact Info', 'Name', 'Name'],
  ['Contact Info', 'Email Address', 'EmailAddress'],
  ['Contact Info', 'Phone Number', 'PhoneNumber'],
  ['Contact Info', 'Physical Address', 'PhysicalAddress'],
  ['Contact Info', 'Other User Contact Info', 'OtherUserContactInfo'],
  ['Health & Fitness', 'Health', 'Health'],
  ['Health & Fitness', 'Fitness', 'Fitness'],
  ['Financial Info', 'Payment Info', 'PaymentInfo'],
  ['Financial Info', 'Credit Info', 'CreditInfo'],
  ['Financial Info', 'Other Financial Info', 'OtherFinancialInfo'],
  ['Location', 'Precise Location', 'PreciseLocation'],
  ['Location', 'Coarse Location', 'CoarseLocation'],
  ['Sensitive Info', 'Sensitive Info', 'SensitiveInfo'],
  ['Contacts', 'Contacts', 'Contacts'],
  ['User Content', 'Emails or Text Messages', 'EmailsOrTextMessages'],
  ['User Content', 'Photos or Videos', 'PhotosorVideos'],
  ['User Content', 'Audio Data', 'AudioData'],
  ['User Content', 'Gameplay Content', 'GameplayContent'],
  ['User Content', 'Customer Support', 'CustomerSupport'],
  ['User Content', 'Other User Content', 'OtherUserContent'],
  ['Browsing History', 'Browsing History', 'BrowsingHistory'],
  ['Search History', 'Search History', 'SearchHistory'],
  ['Identifiers', 'User ID', 'UserID'],
  ['Identifiers', 'Device ID', 'DeviceID'],
  ['Purchases', 'Purchase History', 'PurchaseHistory'],
  ['Usage Data', 'Product Interaction', 'ProductInteraction'],
  ['Usage Data', 'Advertising Data', 'AdvertisingData'],
  ['Usage Data', 'Other Usage Data', 'OtherUsageData'],
  ['Diagnostics', 'Crash Data', 'CrashData'],
  ['Diagnostics', 'Performance Data', 'PerformanceData'],
  ['Diagnostics', 'Other Diagnostic Data', 'OtherDiagnosticData'],
  ['Surroundings', 'Environment Scanning', 'EnvironmentScanning'],
  ['Body', 'Hands', 'Hands'],
  ['Body', 'Head', 'Head'],
  ['Other Data', 'Other Data Types', 'OtherDataTypes'],
];

export type AppleFormType = Readonly<{ category: string; appleType: string; manifestKey: string }>;

export const APPLE_DATA_TYPES: readonly AppleFormType[] = Object.freeze(
  APPLE_FORM.map(([category, appleType, suffix]) =>
    Object.freeze({ category, appleType, manifestKey: `${MANIFEST_KEY_PREFIX}${suffix}` }),
  ),
);

/** KR15's allowed NSPrivacyCollectedDataType values. */
export const KR15_MANIFEST_KEYS: ReadonlySet<string> = new Set(
  APPLE_DATA_TYPES.map((type) => type.manifestKey),
);

/** [category, type]: the Play Data safety form's 38 types, in its order. */
const PLAY_FORM: readonly (readonly [string, readonly string[]])[] = [
  ['Location', ['Approximate location', 'Precise location']],
  [
    'Personal info',
    [
      'Name',
      'Email address',
      'User IDs',
      'Address',
      'Phone number',
      'Race and ethnicity',
      'Political or religious beliefs',
      'Sexual orientation',
      'Other info',
    ],
  ],
  [
    'Financial info',
    ['User payment info', 'Purchase history', 'Credit score', 'Other financial info'],
  ],
  ['Health and fitness', ['Health info', 'Fitness info']],
  ['Messages', ['Emails', 'SMS or MMS', 'Other in-app messages']],
  ['Photos and videos', ['Photos', 'Videos']],
  ['Audio', ['Voice or sound recordings', 'Music files', 'Other audio files']],
  ['Files and docs', ['Files and docs']],
  ['Calendar', ['Calendar events']],
  ['Contacts', ['Contacts']],
  [
    'App activity',
    [
      'App interactions',
      'In-app search history',
      'Installed apps',
      'Other user-generated content',
      'Other actions',
    ],
  ],
  ['Web browsing', ['Web browsing history']],
  ['App info and performance', ['Crash logs', 'Diagnostics', 'Other app performance data']],
  ['Device or other IDs', ['Device or other IDs']],
];

export const PLAY_DATA_TYPES: readonly Readonly<{ category: string; type: string }>[] =
  Object.freeze(
    PLAY_FORM.flatMap(([category, types]) =>
      types.map((type) => Object.freeze({ category, type })),
    ),
  );

/** The Play purposes these answers may use: nothing for analytics, advertising or personalisation. */
export const PLAY_PURPOSES_USED: ReadonlySet<string> = new Set([
  'App functionality',
  'Account management',
  'Fraud prevention, security, and compliance',
]);

const yesNo = z.enum(['Yes', 'No']);
const text = z.string().min(1);
const evidence = z.array(text);
const draftNote = text.nullable();

const appleRowSchema = z
  .object({
    category: text,
    appleType: text,
    manifestKey: text,
    collected: z.boolean(),
    linked: z.boolean().nullable(),
    tracking: z.boolean(),
    purposes: z.array(text),
    source: text,
    evidence,
    changedFromDraft: draftNote,
  })
  .strict();

const playRowSchema = z
  .object({
    category: text,
    type: text,
    apple: z.array(text),
    collected: z.boolean(),
    shared: z.boolean(),
    ephemeral: z.boolean().nullable(),
    requiredOrOptional: z.enum(['Required', 'Optional']).nullable(),
    purposes: z.array(text),
    source: text,
    evidence,
    changedFromDraft: draftNote,
  })
  .strict();

const playSecuritySchema = z
  .object({
    encryptedInTransit: z
      .object({
        answer: yesNo.nullable(),
        options: z.array(z.object({ answer: yesNo, when: text }).strict()).min(2),
        evidence,
        changedFromDraft: draftNote,
      })
      .strict(),
    deletionRequest: z
      .object({ answer: yesNo, url: z.string().url(), how: text, changedFromDraft: draftNote })
      .strict(),
    accountCreation: z
      .object({ answer: text, why: text, evidence, changedFromDraft: draftNote })
      .strict(),
  })
  .strict();

export const privacyLabelsSchema = z
  .object({
    about: text,
    reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    apple: z.array(appleRowSchema).min(1),
    play: z.array(playRowSchema).min(1),
    playSecurity: playSecuritySchema,
  })
  .strict();

export type PrivacyLabels = z.infer<typeof privacyLabelsSchema>;
export type AppleRow = PrivacyLabels['apple'][number];
export type PlayRow = PrivacyLabels['play'][number];

/** The labels JSON, parsed (throws with zod's issues when it does not fit the schema). */
export function readPrivacyLabels(): PrivacyLabels {
  return privacyLabelsSchema.parse(JSON.parse(readRepoFile(LABELS_PATH)));
}

// ── The words the two documents use (the columns their tables carry) ───────────────────────

const NOT_ASKED = '—';
const APPLE_PURPOSE_WORDS: Readonly<Record<string, string>> = {
  AppFunctionality: 'App Functionality',
};

export function answerWord(value: boolean | null): string {
  if (value === null) return NOT_ASKED;
  return value ? 'Yes' : 'No';
}

/** An Apple row as app-store-privacy.md's table writes it. */
export function appleCells(row: AppleRow): Readonly<Record<string, string>> {
  const purposes = row.purposes.map((purpose) => APPLE_PURPOSE_WORDS[purpose] ?? purpose);
  return {
    Category: row.category,
    'Data type': row.appleType,
    Collected: answerWord(row.collected),
    Purposes: purposes.length > 0 ? purposes.join(', ') : NOT_ASKED,
    'Linked to you': answerWord(row.linked),
    'Used for tracking': row.collected ? answerWord(row.tracking) : NOT_ASKED,
  };
}

/** A Play row as play-data-safety.md's table writes it. */
export function playCells(row: PlayRow): Readonly<Record<string, string>> {
  return {
    Category: row.category,
    'Data type': row.type,
    Collected: answerWord(row.collected),
    Shared: answerWord(row.shared),
    'Processed ephemerally': answerWord(row.ephemeral),
    'Required or optional': row.requiredOrOptional ?? NOT_ASKED,
    Purposes: row.purposes.length > 0 ? row.purposes.join('; ') : NOT_ASKED,
  };
}

/** Each document row that differs from the JSON's words: '<type>: <column> is …, want …'. */
export function cellMismatches(
  expected: readonly Readonly<Record<string, string>>[],
  actual: readonly Readonly<Record<string, string>>[],
): string[] {
  const count =
    expected.length === actual.length
      ? []
      : [`the document has ${actual.length} rows, the JSON ${expected.length}`];
  const cells = expected.flatMap((want, index) =>
    Object.entries(want)
      .filter(([column, value]) => actual[index]?.[column] !== value)
      .map(
        ([column, value]) =>
          `${want['Data type']}: ${column} is '${actual[index]?.[column] ?? 'missing'}', want '${value}'`,
      ),
  );
  return [...count, ...cells];
}
