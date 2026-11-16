// Who this app is, as the release audits pin it (test-only). Each value here is the one the audits
// hold app.json, eas.json, the legal pages, the store documents and the workflows to: a change to
// one of those files fails its audit until the value here changes with it. Where an audit reads a
// value from app.json itself (the association audit reads the bundle id there), it is not
// repeated here.

import { frozen } from './types';

export const APP_IDENTITY = frozen({
  /** package.json's name: the release audits refuse to run from any other package. */
  packageName: 'automatos-go',
  /** app.json's name, which every used usage string and the store listing carry. */
  name: 'Automatos Go',
  /** app.json's slug, scheme and version. */
  slug: 'automatos-go',
  scheme: 'automatos',
  version: '1.0.0',
  /** The iOS bundle id and the Android package: one id on both stores. */
  bundleId: 'com.automatos.app',
  /** The product's own site: the legal pages and the marketing page live on it. */
  site: 'automatos.app',
  /** The three public pages src/release/legal-links.ts holds, by their LegalPage name. */
  legalPages: {
    privacy: 'https://automatos.app/privacy',
    terms: 'https://automatos.app/terms',
    support: 'https://automatos.app/contact',
  },
  /** The universal links and App Links app.json claims: two domains and the verified paths. */
  links: {
    applinks: 'ui.automatos.app',
    webcredentials: 'clerk.automatos.app',
    pathPrefixes: ['/go', '/command-center', '/chat'],
  },
  /** The committed EAS link and the App Store Connect ids (public identifiers, not secrets). */
  eas: {
    owner: 'gerard161',
    projectId: '7b4ae66f-9733-4d53-a221-182c1692d574',
    appleTeamId: 'KGVA9933BG',
    ascAppId: '6825362378',
  },
  /** The addresses the privacy policy publishes (its section 13 and 15): no person's own account. */
  publicAddresses: ['privacy@automatos.app', 'support@automatos.app', 'hello@automatos.app'],
  /** The public address of this repository, the update job's second way to read main's head. */
  publicRepository: 'https://github.com/AutomatosAI/automatos-go.git',
  /** The icons' and the splash's grounds as bytes, and the splash mark's width in points. */
  brand: {
    lightGround: [0xf4, 0xee, 0xe2],
    darkGround: [0x1a, 0x18, 0x14],
    splashImageWidth: 220,
  },
} as const);
