import type { ExpoConfig } from 'expo/config';
import { describe, expect, it } from 'vitest';

import withPinnedBackgroundModes, {
  declaredBackgroundModes,
  pinBackgroundModes,
} from '../with-pinned-background-modes';

type InfoPlist = Record<string, unknown>;
type InfoPlistMod = (input: {
  modRequest: Record<string, unknown>;
  modResults: InfoPlist;
}) => Promise<{ modResults: InfoPlist }>;

function configWith(infoPlist?: InfoPlist): ExpoConfig {
  return { name: 'Automatos Go', slug: 'automatos-go', ios: { infoPlist } };
}

// Runs the plugin's Info.plist mod the way prebuild does, on the plist the other plugins left.
async function runInfoPlistMod(config: ExpoConfig, plist: InfoPlist): Promise<InfoPlist> {
  const withMod = withPinnedBackgroundModes(config) as ExpoConfig & {
    mods: { ios: { infoPlist: InfoPlistMod } };
  };
  const result = await withMod.mods.ios.infoPlist({ modRequest: {}, modResults: plist });
  return result.modResults;
}

describe('pinBackgroundModes', () => {
  it('replaces whatever modes plugins added with the declared list', () => {
    const plist = { CFBundleName: 'x', UIBackgroundModes: ['remote-notification', 'fetch'] };
    expect(pinBackgroundModes(plist, ['remote-notification'])).toEqual({
      CFBundleName: 'x',
      UIBackgroundModes: ['remote-notification'],
    });
  });

  it('drops the key when nothing is declared', () => {
    expect(pinBackgroundModes({ UIBackgroundModes: ['fetch'], A: 1 }, [])).toEqual({ A: 1 });
  });

  it('returns a new object and leaves its inputs untouched', () => {
    const plist = { UIBackgroundModes: ['fetch'] };
    const declared = ['remote-notification'];
    const pinned = pinBackgroundModes(plist, declared);
    expect(pinned).not.toBe(plist);
    expect(pinned.UIBackgroundModes).not.toBe(declared);
    expect(plist).toEqual({ UIBackgroundModes: ['fetch'] });
  });
});

describe('declaredBackgroundModes', () => {
  it('reads ios.infoPlist.UIBackgroundModes', () => {
    expect(
      declaredBackgroundModes(configWith({ UIBackgroundModes: ['remote-notification'] })),
    ).toEqual(['remote-notification']);
  });

  it('is empty when app.json declares none', () => {
    expect(declaredBackgroundModes(configWith())).toEqual([]);
  });

  it('rejects a value that is not a list of strings', () => {
    expect(() => declaredBackgroundModes(configWith({ UIBackgroundModes: 'audio' }))).toThrow(
      /must be an array of strings/,
    );
    expect(() => declaredBackgroundModes(configWith({ UIBackgroundModes: [1] }))).toThrow(
      /must be an array of strings/,
    );
  });
});

describe('withPinnedBackgroundModes (the Info.plist mod)', () => {
  it("removes expo-task-manager's 'fetch' and any 'audio' from the final Info.plist (K11, D33)", async () => {
    const config = configWith({ UIBackgroundModes: ['remote-notification'] });
    const plist = await runInfoPlistMod(config, {
      UIBackgroundModes: ['remote-notification', 'fetch', 'audio'],
    });
    expect(plist.UIBackgroundModes).toEqual(['remote-notification']);
  });

  it('keeps every other Info.plist key', async () => {
    const config = configWith({ UIBackgroundModes: ['remote-notification'] });
    const plist = await runInfoPlistMod(config, {
      NSCameraUsageDescription: 'scan',
      UIBackgroundModes: [],
    });
    expect(plist).toEqual({
      NSCameraUsageDescription: 'scan',
      UIBackgroundModes: ['remote-notification'],
    });
  });
});
