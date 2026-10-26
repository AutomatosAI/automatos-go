// Whether the phone can be asked at all (US-014f's line "This phone has no passcode or Face ID, so
// nothing is asked"): read from the hardware and the enrolled level, never by prompting; a phone
// that cannot be read claims nothing.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { ENROLLED_LEVEL } from '../policy';
import { phoneSecurity, readPhoneSecurity } from '../step-up';
import { fakeAuth } from './step-up-fixtures';

// The native module and the app's MMKV store, replaced: step-up.ts wires both at import.
vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => true,
  getEnrolledLevelAsync: async () => 3,
  authenticateAsync: async () => ({ success: true }),
}));

vi.mock('../../storage/mmkv', () => ({
  appStorage: () => ({
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  }),
}));

afterEach(() => vi.restoreAllMocks());

describe('readPhoneSecurity: the Settings line "no passcode or Face ID" (US-014f)', () => {
  it.each([
    [false, ENROLLED_LEVEL.NONE, false],
    [true, ENROLLED_LEVEL.NONE, false],
    [false, ENROLLED_LEVEL.SECRET, true],
    [true, ENROLLED_LEVEL.BIOMETRIC_STRONG, true],
  ] as const)('hardware %s, level %s → %s, with no prompt', async (hasHardware, level, secure) => {
    const auth = fakeAuth({ hasHardware, level });
    expect(await readPhoneSecurity(auth.port)).toBe(secure);
    expect(auth.prompts()).toBe(0);
  });

  it('a phone that cannot be read claims nothing (null), logged by kind only', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    expect(await readPhoneSecurity(fakeAuth({ hardwareThrows: true }).port)).toBeNull();
    expect(warn.mock.calls).toEqual([
      ['[step-up] could not read whether the phone has a passcode'],
    ]);
  });

  it("the app's read goes to the native module", async () => {
    expect(await phoneSecurity()).toBe(true);
  });
});
