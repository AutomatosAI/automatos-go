// docs/release/association.json as the universal-link audit reads it (test-only): its zod schema and
// the shapes automatos-ai accepts. The values are the server's (PRD-266 W3 K14,
// frontend/lib/universal-links.ts); the Android signing fingerprint reads FINGERPRINT_PENDING until
// the owner fills it in from EAS credentials (docs/release/universal-links.md, OT-R9).

import { z } from 'zod';

import { readRepoFile } from './tree';

export const ASSOCIATION_PATH = 'docs/release/association.json';
export const UNIVERSAL_LINKS_DOC = 'docs/release/universal-links.md';
export const FINGERPRINT_PENDING = 'OWNER — OT-R9';
/** The frontend env assetlinks.json reads its fingerprints from, at request time. */
export const FINGERPRINT_ENV = 'ANDROID_APP_SHA256_CERT_FINGERPRINTS';
/** iOS's pattern for every path under a component: '/chat/*'. */
export const SUBPATHS = '/*';

// automatos-ai's own rule (SHA256_CERT_FINGERPRINT): the server drops any other spelling
// silently, and assetlinks.json then lists nothing.
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const PATH_PREFIX = /^(\/[a-z0-9-]+)+$/;
const COMPONENT = /^(\/[a-z0-9-]+)+(\/\*)?$/;
const APP_ID = /^[A-Z0-9]{10}\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;

const text = z.string().trim().min(1);
const domain = z.string().regex(DOMAIN);
const unique = (items: readonly string[]) => new Set(items).size === items.length;

export const associationSchema = z
  .object({
    about: text,
    reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source: text,
    ios: z
      .object({
        appID: z.string().regex(APP_ID),
        domain,
        components: z.array(z.string().regex(COMPONENT)).min(1).refine(unique),
      })
      .strict(),
    android: z
      .object({
        package: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
        domain,
        pathPrefixes: z.array(z.string().regex(PATH_PREFIX)).min(1).refine(unique),
        sha256CertFingerprints: z.union([
          z.literal(FINGERPRINT_PENDING),
          z.array(z.string().regex(FINGERPRINT)).min(1).refine(unique),
        ]),
      })
      .strict(),
    webcredentials: z.object({ domain }).strict(),
  })
  .strict();

export type Association = z.infer<typeof associationSchema>;

export function readAssociation(): Association {
  return associationSchema.parse(JSON.parse(readRepoFile(ASSOCIATION_PATH)));
}

/** The path a component claims, without iOS's '/*': '/chat/*' → '/chat'. */
export function componentBase(component: string): string {
  return component.endsWith(SUBPATHS) ? component.slice(0, -SUBPATHS.length) : component;
}
