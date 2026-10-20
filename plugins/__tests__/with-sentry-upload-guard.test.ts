import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ExpoConfig } from 'expo/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import withSentryUploadGuard, {
  GRADLE_GUARD,
  MARKER,
  XCODE_ENV_GUARD,
  appendGuard,
} from '../with-sentry-upload-guard';

type GradleResults = { language: string; contents: string };
type ModInput<T> = { modRequest: Record<string, unknown>; modResults: T };
type Mod<T> = (input: ModInput<T>) => Promise<{ modResults: T }>;
type GuardedConfig = ExpoConfig & {
  mods: { ios: { dangerous: Mod<undefined> }; android: { appBuildGradle: Mod<GradleResults> } };
};

const TEMPLATE_XCODE_ENV = 'export NODE_BINARY=$(command -v node)\n';
const TEMPLATE_GRADLE = 'apply plugin: "com.android.application"\n\nandroid {\n}\n';

function guarded(): GuardedConfig {
  return withSentryUploadGuard({ name: 'Automatos Go', slug: 'automatos-go' }) as GuardedConfig;
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('appendGuard', () => {
  it('appends the block after the existing contents', () => {
    expect(appendGuard(TEMPLATE_XCODE_ENV, 'BLOCK')).toBe(`${TEMPLATE_XCODE_ENV}\nBLOCK\n`);
  });

  it('adds a newline when the file does not end with one', () => {
    expect(appendGuard('a', 'BLOCK')).toBe('a\n\nBLOCK\n');
  });

  it('is idempotent: a second prebuild leaves the file as the first left it', () => {
    const once = appendGuard(TEMPLATE_XCODE_ENV, XCODE_ENV_GUARD);
    expect(appendGuard(once, XCODE_ENV_GUARD)).toBe(once);
  });
});

describe('the guard blocks', () => {
  it('iOS: turns the upload off only when SENTRY_AUTH_TOKEN is empty', () => {
    expect(XCODE_ENV_GUARD).toContain(
      'if [ -z "$SENTRY_AUTH_TOKEN" ]; then export SENTRY_DISABLE_AUTO_UPLOAD=true; fi',
    );
  });

  it("Android: disables sentry.gradle's upload tasks only when SENTRY_AUTH_TOKEN is unset", () => {
    expect(GRADLE_GUARD).toContain("if (!System.getenv('SENTRY_AUTH_TOKEN'))");
    expect(GRADLE_GUARD).toContain("it.name.contains('_SentryUpload_')");
    expect(GRADLE_GUARD).toContain('it.enabled = false');
  });

  it('both carry the marker and hold no token', () => {
    for (const block of [XCODE_ENV_GUARD, GRADLE_GUARD]) {
      expect(block).toContain(MARKER);
      expect(block).not.toMatch(/sntry[su]_|auth\.token/);
    }
  });
});

describe('withSentryUploadGuard (the mods)', () => {
  let iosDir: string;

  beforeEach(() => {
    iosDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-guard-'));
  });

  afterEach(() => {
    fs.rmSync(iosDir, { recursive: true, force: true });
  });

  it('appends the guard to ios/.xcode.env once, across two prebuilds', async () => {
    const envFile = path.join(iosDir, '.xcode.env');
    fs.writeFileSync(envFile, TEMPLATE_XCODE_ENV);
    const config = guarded();
    const input = { modRequest: { platformProjectRoot: iosDir }, modResults: undefined };
    await config.mods.ios.dangerous(input);
    await config.mods.ios.dangerous(input);
    const contents = fs.readFileSync(envFile, 'utf8');
    expect(contents.startsWith(TEMPLATE_XCODE_ENV)).toBe(true);
    expect(count(contents, XCODE_ENV_GUARD)).toBe(1);
  });

  it('creates ios/.xcode.env when the template has none', async () => {
    const config = guarded();
    await config.mods.ios.dangerous({
      modRequest: { platformProjectRoot: iosDir },
      modResults: undefined,
    });
    expect(fs.readFileSync(path.join(iosDir, '.xcode.env'), 'utf8')).toContain(XCODE_ENV_GUARD);
  });

  it('appends the guard to android/app/build.gradle without touching the rest', async () => {
    const modResults = { language: 'groovy', contents: TEMPLATE_GRADLE };
    const { modResults: out } = await guarded().mods.android.appBuildGradle({
      modRequest: {},
      modResults,
    });
    expect(out.contents.startsWith(TEMPLATE_GRADLE)).toBe(true);
    expect(count(out.contents, GRADLE_GUARD)).toBe(1);
    expect(modResults.contents).toBe(TEMPLATE_GRADLE);
  });

  it('refuses a Kotlin build script instead of writing Groovy into it', async () => {
    const modResults = { language: 'kt', contents: '' };
    await expect(
      guarded().mods.android.appBuildGradle({ modRequest: {}, modResults }),
    ).rejects.toThrow(/must be Groovy/);
  });
});
