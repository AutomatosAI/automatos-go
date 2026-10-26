// R18 as a test that keeps running in CI: the app's side of its universal links and App Links
// (app.json K9) says exactly what docs/release/association.json records, the values automatos-ai
// serves in apple-app-site-association and assetlinks.json (PRD-266 W3 K14). iOS opens a link only
// for a domain its entitlements name and a path the server's components list; Android opens only
// its verified filter's host and path prefixes. Every link one phone opens, the other opens too.
// The Android signing fingerprint is the owner's step (OT-R9, docs/release/universal-links.md).

import { describe, expect, it } from 'vitest';

import easJson from '../../../eas.json';
import { expo } from '../../config/__tests__/app-json';
import {
  associationSchema,
  componentBase,
  FINGERPRINT_ENV,
  FINGERPRINT_PENDING,
  readAssociation,
  SUBPATHS,
  UNIVERSAL_LINKS_DOC,
} from './support/association';
import { readRepoFile } from './support/tree';

const HTTPS = 'https';
const VERIFIED_CATEGORIES = ['BROWSABLE', 'DEFAULT'];
const WELL_KNOWN = ['/.well-known/apple-app-site-association', '/.well-known/assetlinks.json'];

const association = readAssociation();
const { ios, android, webcredentials } = association;
const verifiedFilters = expo.android.intentFilters.filter((filter) => filter.autoVerify === true);
const sorted = (items: Iterable<string>) => [...items].sort();

describe('docs/release/association.json (R18)', () => {
  it('parses: one appID, a domain per platform, unique paths, a fingerprint or the owner mark', () => {
    expect(() => associationSchema.parse(association)).not.toThrow();
  });

  it('associates one web domain on both phones', () => {
    expect(android.domain).toBe(ios.domain);
  });

  it("accepts only automatos-ai's spelling of a fingerprint (upper-case hex pairs, colons)", () => {
    const lower = Array.from({ length: 32 }, () => 'ab').join(':');
    const upper = lower.toUpperCase();
    const withFingerprint = (value: unknown) => ({
      ...association,
      android: { ...android, sha256CertFingerprints: value },
    });
    expect(associationSchema.safeParse(withFingerprint([upper])).success).toBe(true);
    expect(associationSchema.safeParse(withFingerprint([lower])).success).toBe(false);
    expect(associationSchema.safeParse(withFingerprint(upper)).success).toBe(false);
    expect(associationSchema.safeParse(withFingerprint([upper, upper])).success).toBe(false);
    expect(associationSchema.safeParse(withFingerprint(FINGERPRINT_PENDING)).success).toBe(true);
  });
});

describe('iOS: app.json against the association (R18)', () => {
  it('claims exactly the applinks domain and Clerk webcredentials', () => {
    expect(expo.ios.associatedDomains).toEqual([
      `applinks:${ios.domain}`,
      `webcredentials:${webcredentials.domain}`,
    ]);
  });

  it('names the app by its bundle id, under the Apple team every submit profile uses', () => {
    const bundleId = expo.ios.bundleIdentifier;
    expect(ios.appID.endsWith(`.${bundleId}`)).toBe(true);
    const teamIds = Object.values(easJson.submit).map((profile) => profile.ios.appleTeamId);
    expect(teamIds.length).toBeGreaterThan(0);
    for (const teamId of teamIds) expect(ios.appID).toBe(`${teamId}.${bundleId}`);
  });
});

describe('Android: app.json against the association (R18)', () => {
  it('names the package', () => {
    expect(expo.android.package).toBe(android.package);
  });

  it('has one verified filter: VIEW, browsable, https on the domain, exactly the path prefixes', () => {
    expect(verifiedFilters).toHaveLength(1);
    const [filter] = verifiedFilters;
    expect(filter.action).toBe('VIEW');
    expect(sorted(filter.category)).toEqual(sorted(VERIFIED_CATEGORIES));
    for (const data of filter.data) {
      expect(data).toEqual({ scheme: HTTPS, host: android.domain, pathPrefix: data.pathPrefix });
    }
    expect(sorted(filter.data.map((data) => data.pathPrefix))).toEqual(sorted(android.pathPrefixes));
  });
});

describe('both phones open the same links (R18)', () => {
  it('every Android prefix is an iOS component, itself or with its subpaths', () => {
    for (const prefix of android.pathPrefixes) {
      const covered = ios.components.some(
        (component) => component === prefix || component === `${prefix}${SUBPATHS}`,
      );
      expect(covered, `${prefix} has no iOS component`).toBe(true);
    }
  });

  // An Android pathPrefix also opens every path under it ('/chat' opens '/chat/<id>'): iOS needs
  // the '/*' component as well, or the same link opens the app on one phone and Safari on the other.
  it('every Android prefix has its subpaths as an iOS component', () => {
    for (const prefix of android.pathPrefixes) {
      expect(ios.components, `${prefix}${SUBPATHS} is not an iOS component`).toContain(
        `${prefix}${SUBPATHS}`,
      );
    }
  });

  it('every iOS component sits under an Android prefix', () => {
    for (const component of ios.components) {
      expect(android.pathPrefixes, `${component} has no Android prefix`).toContain(
        componentBase(component),
      );
    }
  });
});

describe('docs/release/universal-links.md (OT-R9)', () => {
  const doc = readRepoFile(UNIVERSAL_LINKS_DOC);

  it('names the values the owner checks, so a change here changes the steps too', () => {
    const values = [
      ios.appID,
      ios.domain,
      android.package,
      webcredentials.domain,
      FINGERPRINT_ENV,
      ...ios.components,
      ...WELL_KNOWN,
    ];
    for (const value of values) expect(doc, `${UNIVERSAL_LINKS_DOC} lacks ${value}`).toContain(value);
  });
});
