// The packages the audits may import (audit-imports.test.ts, rule 14.2), each with why it is there:
// what every app built from the template has, so an app can take the audits as they are. Node's own
// modules are no package and need no entry. Anything else an audit needs comes from the source it
// walks or from this folder: the icon set's name, for one, is ICON_SET in a11y-audit.ts. A new
// import fails the audit until it goes or is listed here with its reason, and a listed package no
// audit imports fails it too.

import { frozen } from './types';

export type AllowedPackage = Readonly<{ name: string; reason: string }>;

export const ALLOWED_PACKAGES: readonly AllowedPackage[] = frozen([
  {
    name: 'vitest',
    reason: 'the test runner every audit is written for: the tests CI runs (rule 14.1)',
  },
  {
    name: 'typescript',
    reason:
      'the type check CI runs (rule 14.1), and the parser the audits read each source file with',
  },
  {
    name: 'eslint',
    reason:
      "the lint CI runs (rule 14.1): the lint rules' proofs drive it, and the accessibility audit reads its colour rule",
  },
  {
    name: 'zod',
    reason:
      'the parser the standard requires at every boundary (rule 13.2): the audits parse what they read with it',
  },
  {
    name: 'yaml',
    reason:
      "the workflow files' parser; not in package.json, it is installed with metro-config, Expo's bundler, and with vitest's vite",
  },
  {
    name: 'expo',
    reason:
      "Expo itself: the config plugins' privacy manifest reader and types, the SDK's pinned versions, and its command line for the evaluated config",
  },
  {
    name: 'expo-device',
    reason:
      "app-config.test.ts holds this app's own dependency on it, for the phone's model name, and that it ships no config plugin: app.json's plugins are the app's own check (rule 14.2)",
  },
  {
    name: '@tanstack/react-query-persist-client',
    reason:
      "support/phone.ts saves the query cache as the app's persister does (src/api/query-client.ts persists through it), for user-data.test.ts (rule 13.6)",
  },
]);
