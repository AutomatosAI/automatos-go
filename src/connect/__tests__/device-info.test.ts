import { describe, expect, it, vi } from 'vitest';

// The native modules, replaced: device-info.ts reads Platform.OS and app.json's version by default.
const constants = vi.hoisted(() => ({
  expoConfig: { version: '1.0.0' } as { version?: string } | null,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-constants', () => ({ default: constants }));

const { appVersion, deviceName, devicePlatform } = await import('../device-info');

describe('device-info', () => {
  it("names the phone by its platform, as Studio's Phones & devices lists it", () => {
    expect(deviceName('ios')).toBe('Automatos Go on iPhone');
    expect(deviceName('android')).toBe('Automatos Go on Android');
    expect(devicePlatform('ios')).toBe('ios');
    expect(devicePlatform('android')).toBe('android');
  });

  it('reads Platform.OS when not told', () => {
    expect(deviceName()).toBe('Automatos Go on Android');
    expect(devicePlatform()).toBe('android');
  });

  it("reads app.json's version, trimmed, within the server's 32 characters", () => {
    expect(appVersion()).toBe('1.0.0');
    expect(appVersion(' 1.2.3 ')).toBe('1.2.3');
    expect(appVersion('9'.repeat(40))).toHaveLength(32);
  });

  it('leaves the version out when the build has none', () => {
    expect(appVersion('  ')).toBeUndefined();
    for (const expoConfig of [null, {}]) {
      constants.expoConfig = expoConfig;
      expect(appVersion()).toBeUndefined();
    }
    constants.expoConfig = { version: '1.0.0' };
  });

  it("keeps the name inside the server's 120 characters", () => {
    for (const os of ['ios', 'android', 'web', 'windows']) {
      expect(deviceName(os).length).toBeLessThanOrEqual(120);
    }
  });
});
