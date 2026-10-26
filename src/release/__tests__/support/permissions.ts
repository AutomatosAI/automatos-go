// The permission records and the evaluated native config, as the permission audit reads them
// (test-only): docs/release/android-permissions.json and ios-usage-keys.json with their zod
// schemas; the Info.plist and Android manifest that `expo config --type introspect` evaluates (every
// config plugin's mods applied, nothing written to ios/ or android/, as app-config.test.ts reads
// it); and the uses-permission lines of every installed library's own AndroidManifest.xml, which
// Gradle merges into the APK and introspection does not show.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { PROJECT_ROOT, requireFromRoot } from '../../../config/__tests__/app-json';
import { readRepoFile, repoRoot } from './tree';

export const ANDROID_PERMISSIONS_PATH = 'docs/release/android-permissions.json';
export const IOS_USAGE_KEYS_PATH = 'docs/release/ios-usage-keys.json';

/** The main manifest of an Android library; debug and test manifests never reach a release APK. */
export const LIBRARY_MANIFEST = 'android/src/main/AndroidManifest.xml';

const text = z.string().trim().min(1);
const permissionName = z.string().regex(/^android\.permission\.[A-Z0-9_]+$/);
const reviewed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const androidPermissionsSchema = z
  .object({
    about: text,
    reviewed,
    allowed: z.array(z.object({ name: permissionName, why: text, module: text }).strict()).min(1),
    denied: z.array(z.object({ name: permissionName, why: text }).strict()).min(1),
  })
  .strict();

const usageKeySchema = z
  .object({
    key: z.string().regex(/^NS\w+UsageDescription$/),
    kind: z.enum(['used', 'notice']),
    string: text,
    // 'Framework: Symbol', optionally followed by a detail: 'AVFoundation: AVCaptureDevice (video)'
    needs: z.array(z.string().regex(/^\w+: [\w.]+( \(.+\))?$/)),
    note: text.optional(),
    proposed: text.nullable(),
  })
  .strict()
  .refine((entry) => entry.needs.length > 0 || entry.note !== undefined, {
    message: 'a key that needs no class says why in a note',
  });

export const iosUsageKeysSchema = z
  .object({
    about: text,
    reviewed,
    keys: z.array(usageKeySchema).min(1),
    differences: z.array(z.object({ key: text, difference: text }).strict()),
  })
  .strict();

export type AndroidPermissions = z.infer<typeof androidPermissionsSchema>;
export type IosUsageKeys = z.infer<typeof iosUsageKeysSchema>;
export type UsageKey = IosUsageKeys['keys'][number];

export function readAndroidPermissions(): AndroidPermissions {
  return androidPermissionsSchema.parse(JSON.parse(readRepoFile(ANDROID_PERMISSIONS_PATH)));
}

export function readIosUsageKeys(): IosUsageKeys {
  return iosUsageKeysSchema.parse(JSON.parse(readRepoFile(IOS_USAGE_KEYS_PATH)));
}

/** The class a needs entry names: 'AVFoundation: AVCaptureDevice (video)' → 'AVCaptureDevice'. */
export function neededSymbol(need: string): string {
  return need.slice(need.indexOf(': ') + 2).split(' ')[0];
}

// ── The evaluated native config ─────────────────────────────────────────────────────────────

const permissionEntrySchema = z.object({
  $: z.object({ 'android:name': text, 'tools:node': z.string().optional() }),
});

// Only the parts the audit reads; unknown fields ignored.
const introspectedSchema = z.object({
  _internal: z.object({
    modResults: z.object({
      ios: z.object({ infoPlist: z.record(z.string(), z.unknown()) }),
      android: z.object({
        manifest: z.object({
          manifest: z.object({
            'uses-permission': z.array(permissionEntrySchema).optional(),
            'uses-permission-sdk-23': z.array(permissionEntrySchema).optional(),
          }),
        }),
      }),
    }),
  }),
});

export type EvaluatedConfig = Readonly<{
  infoPlist: Readonly<Record<string, unknown>>;
  /** Every permission the evaluated manifest keeps. */
  kept: readonly string[];
  /** Every permission it marks tools:node="remove" (also stripped from libraries at merge). */
  removed: readonly string[];
}>;

/** The Info.plist and Android permissions prebuild would write, from `expo config --type introspect`. */
export function evaluatedConfig(): EvaluatedConfig {
  const cli = requireFromRoot.resolve('expo/bin/cli');
  const json = execFileSync(process.execPath, [cli, 'config', '--type', 'introspect', '--json'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const { ios, android } = introspectedSchema.parse(JSON.parse(json))._internal.modResults;
  const { manifest } = android.manifest;
  const entries = [
    ...(manifest['uses-permission'] ?? []),
    ...(manifest['uses-permission-sdk-23'] ?? []),
  ].map((entry) => entry.$);
  const isRemoved = (entry: (typeof entries)[number]) => entry['tools:node'] === 'remove';
  return {
    infoPlist: ios.infoPlist,
    kept: entries.filter((entry) => !isRemoved(entry)).map((entry) => entry['android:name']),
    removed: entries.filter(isRemoved).map((entry) => entry['android:name']),
  };
}

// ── Libraries' own Android manifests ────────────────────────────────────────────────────────

export type LibraryPermission = Readonly<{ name: string; file: string }>;

const XML_COMMENT = /<!--[\s\S]*?-->/g;
const USES_PERMISSION = /<uses-permission(?:-sdk-23)?\b[^>]*?\bandroid:name\s*=\s*"([^"]+)"/g;

/** The permissions one manifest declares (comments skipped). */
export function manifestPermissions(xml: string): string[] {
  return [...xml.replace(XML_COMMENT, '').matchAll(USES_PERMISSION)].map(([, name]) => name);
}

/** The main AndroidManifest.xml of each installed package that has one, repo-relative. */
export function libraryManifests(packageDirs: readonly string[]): string[] {
  const root = repoRoot();
  return packageDirs
    .map((dir) => path.posix.join(dir, LIBRARY_MANIFEST))
    .filter((file) => existsSync(path.join(root, file)))
    .sort();
}

/** Every uses-permission those manifests declare, with the file that declares it. */
export function libraryPermissions(manifests: readonly string[]): LibraryPermission[] {
  return manifests.flatMap((file) =>
    manifestPermissions(readRepoFile(file)).map((name) => ({ name, file })),
  );
}
