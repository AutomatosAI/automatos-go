// The native wiring (KR7): index.ts binds the real SDK, the switch's own plain MMKV file, the build
// env, the expo-updates channel and the binary's version, and is the app's ONLY run-time importer of
// @sentry/react-native; the root layout starts crash reporting once, at module load, before it
// renders. The native modules are replaced; the wiring of the tree is read from the source.

import { describe, expect, it, vi } from 'vitest';

import { productFiles, readRepoFile } from '../../release/__tests__/support/tree';
import { CRASH_SETTING_KEY, CRASH_SETTING_STORE_ID } from '../crash-setting';
import { TEST_REPORT_MESSAGE } from '../crash-reporting';

const native = vi.hoisted(() => ({
  configs: [] as unknown[],
  items: new Map<string, string>(),
  env: { clerkPublishableKey: '', apiUrl: '', webUrl: '', sentryDsn: '' },
}));

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  close: vi.fn(async () => undefined),
  captureMessage: vi.fn(() => 'event-id'),
  setUser: vi.fn(),
  wrap: vi.fn(),
}));

vi.mock('@sentry/react-native', () => sdk);
vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' }, platform: { ios: { buildNumber: '9' } } },
}));
vi.mock('expo-updates', () => ({ channel: 'testflight' }));
vi.mock('react-native-mmkv', () => ({
  createMMKV: (config: unknown) => {
    native.configs.push(config);
    return {
      getString: (key: string) => native.items.get(key),
      set: (key: string, value: string) => native.items.set(key, value),
      remove: (key: string) => native.items.delete(key),
    };
  },
}));
vi.mock('../../lib/env', () => ({ env: native.env }));

native.env.sentryDsn = 'https://public@o1.ingest.de.sentry.io/2';
const observability = await import('../index');

const INDEX = 'src/observability/index.ts';
const ROOT_LAYOUT = 'app/_layout.tsx';

/** The modules a source loads at run time; `import type` and `export type` statements are left out. */
function runtimeModules(text: string): string[] {
  const statements = [...text.matchAll(/^(?:import|export)\b([^;]*?)\bfrom\s*['"]([^'"]+)['"]/gm)]
    .filter((match) => !/^\s*type\s/.test(match[1] ?? ''))
    .map((match) => match[2] ?? '');
  const bare = [...text.matchAll(/^import\s*['"]([^'"]+)['"]/gm)].map((match) => match[1] ?? '');
  const calls = [...text.matchAll(/\b(?:require|import)\(\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1] ?? '',
  );
  return [...statements, ...bare, ...calls];
}

describe('index.ts, over the native modules', () => {
  it('starts Sentry with the env DSN, the update channel and the binary version and build', () => {
    observability.initCrashReporting();
    observability.initCrashReporting();
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init.mock.calls[0]?.[0]).toMatchObject({
      dsn: native.env.sentryDsn,
      environment: 'testflight',
      release: 'com.automatos.app@1.0.0+9',
      dist: '9',
    });
  });

  it('keeps the switch in its own plain MMKV file: no encryption key, so no keychain read', () => {
    expect(native.configs).toEqual([{ id: CRASH_SETTING_STORE_ID }]);
    expect(observability.crashReportsEnabled()).toBe(true);
  });

  it('sends the test report through captureMessage, and off closes the SDK and is saved', async () => {
    expect(observability.sendTestReport()).toBe(true);
    expect(sdk.captureMessage).toHaveBeenCalledWith(TEST_REPORT_MESSAGE, expect.anything());
    await observability.setCrashReportsEnabled(false);
    expect(sdk.close).toHaveBeenCalledTimes(1);
    expect(native.items.get(CRASH_SETTING_KEY)).toBe('off');
    expect(observability.crashReportsEnabled()).toBe(false);
    expect(observability.sendTestReport()).toBe(false);
    expect(sdk.setUser).not.toHaveBeenCalled();
    expect(sdk.wrap).not.toHaveBeenCalled();
  });
});

describe('the wiring (read from the source)', () => {
  it('index.ts is the only product file that loads any @sentry/ module at run time', () => {
    const importers = productFiles().filter((file) =>
      runtimeModules(readRepoFile(file)).some((name) => name.startsWith('@sentry/')),
    );
    expect(importers).toEqual([INDEX]);
  });

  it('the run-time reader sees value imports and skips type-only ones', () => {
    const text = [
      "import type { Event } from '@sentry/react-native';",
      "import * as Sentry from '@sentry/react-native';",
      "export { init } from '@sentry/core';",
      "export type { Breadcrumb } from '@sentry/types';",
      "const lazy = require('@sentry/browser');",
    ].join('\n');
    expect(runtimeModules(text)).toEqual([
      '@sentry/react-native',
      '@sentry/core',
      '@sentry/browser',
    ]);
  });

  it('index.ts uses init, close and captureMessage only: no setUser, wrap or integration', () => {
    const source = readRepoFile(INDEX);
    const calls = [...source.matchAll(/\bSentry\.(\w+)/g)].map((match) => match[1]);
    expect([...new Set(calls)].sort()).toEqual(['captureMessage', 'close', 'init']);
    expect(source).not.toMatch(/integration|TouchEventBoundary|ErrorBoundary/i);
  });

  it('the root layout starts crash reporting once, at module load, before it renders', () => {
    const root = readRepoFile(ROOT_LAYOUT);
    expect(root).toContain("import { initCrashReporting } from '../src/observability';");
    const calls = [...root.matchAll(/^initCrashReporting\(\);$/gm)];
    expect(calls).toHaveLength(1);
    expect(root.split('initCrashReporting(')).toHaveLength(2);
    const call = calls[0]?.index ?? -1;
    expect(call).toBeGreaterThan(root.lastIndexOf('\nimport '));
    expect(call).toBeLessThan(root.indexOf('export default function RootLayout'));
  });
});
