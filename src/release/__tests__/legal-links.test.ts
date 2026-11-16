// KR8 as a test: the three public pages are plain https pages on the app's own site (no fragment,
// no query, no trailing slash, so the store listings can name the same address), the one module
// holds them, and the app's code names them only through it. The site and the three addresses are
// the app's (settings/identity.ts).

import { describe, expect, it } from 'vitest';

import {
  LEGAL_LINKS,
  PRIVACY_POLICY_URL,
  SUPPORT_URL,
  TERMS_URL,
  type LegalPage,
} from '../legal-links';
import { APP_IDENTITY } from './settings/identity';
import { productFiles, readRepoFile } from './support/tree';

const LEGAL_MODULE = 'src/release/legal-links.ts';
const { site, legalPages } = APP_IDENTITY;
const PAGES: readonly (readonly [LegalPage, string, string])[] = [
  ['privacy', PRIVACY_POLICY_URL, legalPages.privacy],
  ['terms', TERMS_URL, legalPages.terms],
  ['support', SUPPORT_URL, legalPages.support],
];
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
/** A legal page's address on the site, written anywhere: the site, then one of the pages' paths. */
const PAGE_ADDRESS = new RegExp(
  `${escaped(site)}\\/(${Object.values(legalPages)
    .map((url) => escaped(new URL(url).pathname.slice(1)))
    .join('|')})\\b`,
);

describe('the legal links (KR8)', () => {
  it.each(PAGES)('%s is %s', (page, url, expected) => {
    expect(url).toBe(expected);
    expect(LEGAL_LINKS[page]).toBe(url);
  });

  it.each(PAGES)(`%s is a plain https page on ${site}`, (_page, url) => {
    const parsed = new URL(url);
    expect(parsed.protocol).toBe('https:');
    expect(parsed.host).toBe(site);
    expect(url).not.toContain('#');
    expect(url).not.toContain('?');
    expect(url.endsWith('/')).toBe(false);
    expect(parsed.pathname.length).toBeGreaterThan(1);
  });

  it('lists exactly the three pages, frozen', () => {
    expect(Object.keys(LEGAL_LINKS).sort()).toEqual(['privacy', 'support', 'terms']);
    expect(Object.isFrozen(LEGAL_LINKS)).toBe(true);
    expect(() => {
      (LEGAL_LINKS as Record<string, string>).privacy = 'https://example.com/privacy';
    }).toThrow(TypeError);
  });

  it('no other product file writes a legal page address of its own', () => {
    const offenders = productFiles().filter(
      (file) => file !== LEGAL_MODULE && PAGE_ADDRESS.test(readRepoFile(file)),
    );
    expect(offenders).toEqual([]);
  });
});
