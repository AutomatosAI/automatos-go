import { beforeEach, describe, expect, it, vi } from 'vitest';

// The native modules, replaced: speaker.ts binds expo-speech and Platform.
const native = vi.hoisted(() => ({
  platform: { OS: 'android' as string },
  speech: {
    speak: vi.fn(),
    stop: vi.fn(async () => undefined),
    getAvailableVoicesAsync: vi.fn(async () => [
      {
        identifier: 'en-us-x-iol-network',
        name: 'en-us-x-iol-network',
        quality: 'Enhanced',
        language: 'en-US',
      },
      {
        identifier: 'en-us-x-iol-local',
        name: 'en-us-x-iol-local',
        quality: 'Default',
        language: 'en-US',
      },
    ]),
    maxSpeechInputLength: 12,
  },
}));
vi.mock('expo-speech', () => native.speech);
vi.mock('react-native', () => ({ Platform: native.platform }));

const { speaker } = await import('../speech/speaker');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('speaker (the binding)', () => {
  it("speaks through expo-speech in pieces the engine takes, with the system's audio session", () => {
    speaker.speak('Hello there friend.', { language: 'en-US', voice: 'en-us-x-iol-local' });
    expect(native.speech.speak).toHaveBeenCalledTimes(2);
    expect(native.speech.speak.mock.calls.map((call) => call[0])).toEqual([
      'Hello there',
      'friend.',
    ]);
    expect(native.speech.speak.mock.calls[0]?.[1]).toMatchObject({
      language: 'en-US',
      voice: 'en-us-x-iol-local',
      useApplicationAudioSession: false,
    });
  });

  it('hands expo-speech the saved voice, rate and pitch', () => {
    speaker.speak('Hello.', {
      language: 'en-US',
      voice: 'en-us-x-iol-local',
      rate: 0.85,
      pitch: 1.2,
    });
    expect(native.speech.speak).toHaveBeenCalledWith(
      'Hello.',
      expect.objectContaining({ voice: 'en-us-x-iol-local', rate: 0.85, pitch: 1.2 }),
    );
  });

  it('stops through expo-speech', () => {
    speaker.stop();
    expect(native.speech.stop).toHaveBeenCalledTimes(1);
  });

  it("reads the phone's voices once and picks by this phone's platform", async () => {
    expect(await speaker.voiceFor('en-US')).toBe('en-us-x-iol-local');
    expect(await speaker.voiceFor('en-US')).toBe('en-us-x-iol-local');
    expect(native.speech.getAvailableVoicesAsync).toHaveBeenCalledTimes(1);
  });
});
