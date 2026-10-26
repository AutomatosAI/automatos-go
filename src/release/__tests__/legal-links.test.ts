// KR8 as a test: the three public pages are plain https pages on automatos.app (no fragment, no
// query, no trailing slash, so the store listings can name the same address), the one module holds
// them, and the app's code names them only through it.

import { describe, expect, it } from 'vitest';

import {
  LEGAL_LINKS,
  PRIVACY_POLICY_URL,
  SUPPORT_URL,
  TERMS_URL,
  type LegalPage,
} from '../legal-links';
import { productFiles, readRepoFile } from './support/tree';

const LEGAL_MODULE = 'src/release/legal-links.ts';
const PAGES: readonly (readonly [LegalPage, string, string])[] = [
  ['privacy', PRIVACY_POLICY_URL, 'https://automatos.app/privacy'],
  ['terms', TERMS_URL, 'https://automatos.app/terms'],
  ['support', SUPPORT_URL, 'https://automatos.app/contact'],
];

describe('the legal links (KR8)', () => {
  it.each(PAGES)('%s is %s', (page, url, expected) => {
    expect(url).toBe(expected);
    expect(LEGAL_LINKS[page]).toBe(url);
  });

  it.each(PAGES)('%s is a plain https page on automatos.app', (_page, url) => {
    const parsed = new URL(url);
    expect(parsed.protocol).toBe('https:');
    expect(parsed.host).toBe('automatos.app');
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
    const pageAddress = /automatos\.app\/(privacy|terms|contact)\b/;
    const offenders = productFiles().filter(
      (file) => file !== LEGAL_MODULE && pageAddress.test(readRepoFile(file)),
    );
    expect(offenders).toEqual([]);
  });
});
