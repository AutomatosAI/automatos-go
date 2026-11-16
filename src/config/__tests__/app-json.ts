// app.json and the helpers shared by the app config suites (app-config, app-privacy).
import { createRequire } from 'node:module';
import path from 'node:path';

import type { IOSConfig } from 'expo/config-plugins';

import appJson from '../../../app.json';
import { APP_IDENTITY } from '../../release/__tests__/settings/identity';

export const { expo } = appJson;

export const infoPlist: Record<string, unknown> = expo.ios.infoPlist;

// Appendix A.1 (reports/mobile-review-2026-10-20/drafts); docs/native-modules.md 'Privacy
// manifest' records the accessed-API sources.
export type PrivacyManifest = IOSConfig.PrivacyInfo.PrivacyInfo;

export const privacy: PrivacyManifest = expo.ios.privacyManifests;

// The committed EAS link (public identifiers: the project id ships inside every binary), from the
// app's settings; the update URL is EAS's own address for that project.
export const EAS_OWNER: string = APP_IDENTITY.eas.owner;
export const EAS_PROJECT_ID: string = APP_IDENTITY.eas.projectId;
export const EAS_UPDATES_URL = `https://u.expo.dev/${EAS_PROJECT_ID}`;

export const PROJECT_ROOT = path.resolve(__dirname, '../../..');
export const requireFromRoot = createRequire(path.join(PROJECT_ROOT, 'package.json'));

export type PluginEntry = string | [string, Record<string, unknown>];

export function pluginNames(plugins: readonly PluginEntry[]): string[] {
  return plugins.map((entry) => (typeof entry === 'string' ? entry : entry[0]));
}

export function pluginOptions(plugins: readonly PluginEntry[], name: string): unknown {
  const entry = plugins.find((item) => Array.isArray(item) && item[0] === name);
  return Array.isArray(entry) ? entry[1] : undefined;
}
