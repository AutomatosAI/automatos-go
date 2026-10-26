import { beforeEach, describe, expect, it, vi } from 'vitest';

// The native modules, replaced: permissions.ts binds ExpoSpeechRecognitionModule's permission
// functions, Platform and Linking.openSettings.
const native = vi.hoisted(() => {
  const answer = (status: string, extra: object = {}) => ({
    status,
    granted: status === 'granted',
    canAskAgain: status !== 'denied',
    expires: 'never',
    ...extra,
  });
  return {
    answer,
    platform: { OS: 'ios' as string },
    linking: { openSettings: vi.fn(async () => undefined) },
    module: {
      getPermissionsAsync: vi.fn(async () => answer('granted')),
      getMicrophonePermissionsAsync: vi.fn(async () => answer('granted')),
      getSpeechRecognizerPermissionsAsync: vi.fn(async () =>
        answer('granted', { restricted: false }),
      ),
      requestPermissionsAsync: vi.fn(async () => answer('granted')),
      requestMicrophonePermissionsAsync: vi.fn(async () => answer('granted')),
      requestSpeechRecognizerPermissionsAsync: vi.fn(async () => answer('granted')),
    },
  };
});
vi.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: native.module }));
vi.mock('react-native', () => ({ Platform: native.platform, Linking: native.linking }));

const { permissions } = await import('../permissions/permissions');
const { logger } = await import('../../lib/logger');

const REQUESTS = [
  native.module.requestPermissionsAsync,
  native.module.requestMicrophonePermissionsAsync,
  native.module.requestSpeechRecognizerPermissionsAsync,
];

beforeEach(() => {
  vi.clearAllMocks();
  native.platform.OS = 'ios';
});

describe('permissions (the binding) — reading never prompts', () => {
  it('quick-ask on iOS reads the microphone and speech recognition apart', async () => {
    native.module.getSpeechRecognizerPermissionsAsync.mockResolvedValueOnce(
      native.answer('denied', { restricted: true }),
    );
    await expect(permissions.check('quick-ask')).resolves.toEqual({
      step: 'restricted',
      blocked: null,
      asked: false,
    });
    expect(native.module.getMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
    expect(native.module.getSpeechRecognizerPermissionsAsync).toHaveBeenCalledTimes(1);
    for (const request of REQUESTS) expect(request).not.toHaveBeenCalled();
  });

  it('Live, and quick-ask on Android, read the microphone only', async () => {
    await permissions.check('live');
    native.platform.OS = 'android';
    await permissions.check('quick-ask');
    expect(native.module.getMicrophonePermissionsAsync).toHaveBeenCalledTimes(2);
    expect(native.module.getSpeechRecognizerPermissionsAsync).not.toHaveBeenCalled();
  });

  it('names speech recognition when it is the one that is off', async () => {
    native.module.getSpeechRecognizerPermissionsAsync.mockResolvedValueOnce(
      native.answer('denied'),
    );
    await expect(permissions.check('quick-ask')).resolves.toMatchObject({
      step: 'settings',
      blocked: 'speech',
    });
  });
});

describe('permissions (the binding) — a press asks', () => {
  it('quick-ask asks with requestPermissionsAsync (iOS: speech, then the microphone)', async () => {
    native.module.getMicrophonePermissionsAsync.mockResolvedValueOnce(
      native.answer('undetermined'),
    );
    native.module.getSpeechRecognizerPermissionsAsync.mockResolvedValueOnce(
      native.answer('undetermined'),
    );
    await expect(permissions.press('quick-ask')).resolves.toEqual({
      step: 'granted',
      blocked: null,
      asked: true,
    });
    expect(native.module.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(native.module.requestMicrophonePermissionsAsync).not.toHaveBeenCalled();
  });

  it('Live asks with requestMicrophonePermissionsAsync only', async () => {
    native.platform.OS = 'android';
    native.module.getMicrophonePermissionsAsync.mockResolvedValueOnce(
      native.answer('undetermined'),
    );
    await permissions.press('live');
    expect(native.module.requestMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
    expect(native.module.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('a press with everything granted asks nothing', async () => {
    await expect(permissions.press('quick-ask')).resolves.toMatchObject({
      step: 'granted',
      asked: false,
    });
    for (const request of REQUESTS) expect(request).not.toHaveBeenCalled();
  });
});

describe('permissions.openSettings', () => {
  it("opens the app's page in Settings", () => {
    permissions.openSettings();
    expect(native.linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it('a Settings link that fails is logged, never thrown', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    native.linking.openSettings.mockRejectedValueOnce(new Error('no settings'));
    expect(() => permissions.openSettings()).not.toThrow();
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith('[voice] Settings did not open', expect.any(Error)),
    );
    warn.mockRestore();
  });
});
