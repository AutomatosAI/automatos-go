// docs/release as the store-document audit reads it (test-only, US-021p): the text a person pastes
// into a store form (each ```text block), the listing's fields and App Store Connect's limits, the
// addresses of a legal page on the app's own site, the statements a document makes (for its ages),
// and the secret-shaped strings no document may hold. The site, its published addresses and the
// ALLOWED ages that are not 18 are the app's (settings/identity.ts, settings/release-docs.ts). Pure
// over strings: release-docs.test.ts reads the files through tree.ts.

import { APP_IDENTITY } from '../settings/identity';
import { sectionStartingWith } from './markdown';

export const RELEASE_DOCS_DIR = 'docs/release';
export const STORE_LISTING_DOC = 'docs/release/store-listing.md';
export const REVIEW_NOTES_DOC = 'docs/release/app-review-notes.md';
export const PLAY_ACCESS_DOC = 'docs/release/play-app-access.md';
export const AGE_RATING_DOC = 'docs/release/age-rating.md';
export const EXPORT_DOC = 'docs/release/export-compliance.md';

/** The documents whose blocks go into a store form as they are. */
export const STORE_TEXT_DOCS = [STORE_LISTING_DOC, REVIEW_NOTES_DOC, PLAY_ACCESS_DOC] as const;

/** App Store Connect's limits, in characters, for the listing fields store-listing.md writes. */
export const LISTING_LIMITS = Object.freeze({
  Name: 30,
  Subtitle: 30,
  'Promotional text': 170,
  Description: 4000,
  Keywords: 100,
});

/** App Store Connect's limit for App Review Information → Notes. */
export const REVIEW_NOTES_LIMIT = 4000;

const PASTE_BLOCK = /^```text\n([\s\S]*?)\n```$/gm;

/** Every ```text block in a document, without its fences: what is pasted into a form. */
export function pasteBlocks(text: string): string[] {
  return [...text.matchAll(PASTE_BLOCK)].map((match) => match[1]);
}

/** The one ```text block under '## <field>'; throws unless there is exactly one. */
export function fieldValue(doc: string, field: string): string {
  const blocks = pasteBlocks(sectionStartingWith(doc, field));
  if (blocks.length !== 1) throw new Error(`'## ${field}' has ${blocks.length} text blocks, not 1`);
  return blocks[0];
}

/** Characters as App Store Connect counts them: code points, not UTF-16 units. */
export function charCount(value: string): number {
  return [...value].length;
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
/** Any address on the app's site or a subdomain of it, with or without its scheme and path. */
const SITE_ADDRESS = new RegExp(
  `(?:https?:\\/\\/)?(?:[a-z0-9-]+\\.)*${escaped(APP_IDENTITY.site)}(?:\\/[^\\s)\\]>\`'"|*,;]*)?`,
  'gi',
);
const LEGAL_PATH = /^\/(?:privacy|terms|tos|contact|support|legal|eula)(?:[-/?#.]|$)/i;
const TRAILING_PUNCTUATION = /[.:]+$/;

/** Every address on the app's site in the text whose path is a legal page's (privacy, terms…). */
export function legalAddresses(text: string): string[] {
  return [...text.matchAll(SITE_ADDRESS)]
    .map((match) => match[0].replace(TRAILING_PUNCTUATION, ''))
    .filter((address) => {
      const bare = address.replace(/^https?:\/\//i, '');
      const slash = bare.indexOf('/');
      return slash !== -1 && LEGAL_PATH.test(bare.slice(slash));
    });
}

const UNIT_START = /^\s*(?:#|[-*+]\s|\d+\.\s|\||```|>)/;

/**
 * A document's statements: each paragraph, list item, table row, heading or fence line, with its
 * wrapped lines joined and whitespace collapsed, so a statement split across lines reads as one.
 */
export function statementUnits(text: string): string[] {
  const groups = text.split('\n').reduce<string[][]>((units, line) => {
    if (line.trim() === '') return [...units, []];
    if (units.length === 0 || UNIT_START.test(line)) return [...units, [line]];
    const last = units[units.length - 1];
    return [...units.slice(0, -1), [...last, line]];
  }, []);
  return groups
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.join(' ').replace(/\s+/g, ' ').trim());
}

export type SecretShape = Readonly<{ name: string; pattern: RegExp }>;

/** Strings no document may hold, real or made up: a value of this shape is a secret (or looks one). */
export const SECRET_SHAPES: readonly SecretShape[] = [
  { name: 'a Clerk or Stripe key', pattern: /\b[ps]k_(?:live|test)_[A-Za-z0-9]{8,}/ },
  { name: 'an AI provider key', pattern: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: "a paired phone's token", pattern: /\bamd_[A-Za-z0-9_-]{16,}/ },
  {
    name: 'an Expo push token',
    pattern: /\bExpo(?:nent)?PushToken\[(?!(?:…|\.\.\.|<[^\]]*>)\])[^\]\s]+\]/,
  },
  { name: 'a private-key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: 'a JSON web token',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  },
  { name: 'a Sentry DSN with its key', pattern: /https?:\/\/[0-9a-f]{32}@[^\s/]*sentry\.io/i },
];

/** The secret shapes a text holds, each with what matched. */
export function secretsIn(text: string): { name: string; match: string }[] {
  return SECRET_SHAPES.flatMap(({ name, pattern }) => {
    const match = text.match(pattern);
    return match ? [{ name, match: match[0] }] : [];
  });
}

// 'Password: x', 'password = x', '"password": "x"' (the gate's reach: up to 20 characters between),
// and a table row whose label cell is the word: '| Password | x |'.
const PASSWORD_ASSIGNED = /\bpass(?:word|code|phrase)[^:=\n|]{0,20}[:=]\s*["']?([^\s"'|,;]*)/gi;
const PASSWORD_CELL = /\|\s*pass(?:word|code|phrase)\s*\|\s*([^|]*?)\s*\|/gi;
// A placeholder starts '<' ('<… — in App Store Connect only>', cut at its first space by the match).
const NO_VALUE = /^(?:$|<|—|–|-|none\b|no\b|n\/a\b)/i;

/** Every password given a value in the text that is not a placeholder ('<…>') or 'None'. */
export function passwordValuesIn(text: string): string[] {
  const plain = text.replace(/[*`]/g, '');
  const values = [...plain.matchAll(PASSWORD_ASSIGNED), ...plain.matchAll(PASSWORD_CELL)].map(
    (match) => match[1].trim(),
  );
  return values.filter((value) => !NO_VALUE.test(value));
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const PLACEHOLDER_DOMAIN = /@(?:[a-z0-9-]+\.)*example\.(?:com|org|net)$/i;
const published: readonly string[] = APP_IDENTITY.publicAddresses;

/** Every email address in the text that is neither published nor on a placeholder domain. */
export function accountAddressesIn(text: string): string[] {
  return [...text.matchAll(EMAIL)]
    .map((match) => match[0])
    .filter((address) => !published.includes(address.toLowerCase()))
    .filter((address) => !PLACEHOLDER_DOMAIN.test(address));
}
