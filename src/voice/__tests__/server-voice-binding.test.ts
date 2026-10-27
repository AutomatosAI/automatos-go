// The server voice, bound: expo-audio set for playback (silent switch, ducking, no recording, no
// background) and one player per file that keeps the session active and is released on stop;
// expo-file-system writing each MP3 under <cache>/server-voice and deleting it; and the one voice
// out speaking a sentence through the client the speech carries, the MP3 played from its file.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => {
  const subscription = { remove: vi.fn() };
  const player = {
    addListener: vi.fn((_event: string, _listener: (status: unknown) => void) => subscription),
    play: vi.fn(),
    pause: vi.fn(),
    remove: vi.fn(),
  };
  const files = new Map<string, Uint8Array>();
  const deleted: string[] = [];
  const join = (parts: unknown[]) =>
    parts
      .map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri))
      .join('/');
  class Directory {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return [...files.keys()].some((uri) => uri.startsWith(this.uri));
    }
    create = vi.fn();
    delete() {
      deleted.push(this.uri);
      [...files.keys()]
        .filter((uri) => uri.startsWith(this.uri))
        .forEach((uri) => files.delete(uri));
    }
  }
  class File {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      files.set(this.uri, new Uint8Array());
    }
    write(bytes: Uint8Array) {
      files.set(this.uri, bytes);
    }
    delete() {
      deleted.push(this.uri);
      files.delete(this.uri);
    }
  }
  return {
    subscription,
    player,
    files,
    deleted,
    audio: {
      createAudioPlayer: vi.fn(() => player),
      setAudioModeAsync: vi.fn(async (_mode: unknown) => undefined),
      setIsAudioActiveAsync: vi.fn(async (_active: boolean) => undefined),
    },
    fs: { Directory, File, Paths: { cache: { uri: 'file:///cache' } } },
    speech: {
      speak: vi.fn(),
      stop: vi.fn(async () => undefined),
      getAvailableVoicesAsync: vi.fn(async () => []),
      maxSpeechInputLength: 4000,
    },
  };
});
vi.mock('expo-audio', () => native.audio);
vi.mock('expo-file-system', () => native.fs);
vi.mock('expo-speech', () => native.speech);
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const { audioPlayer } = await import('../server/audio-player');
const { speechFiles, SERVER_VOICE_FOLDER } = await import('../server/speech-files');
const { voiceOut } = await import('../speech/voice-out');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the player (expo-audio)', () => {
  it('sets the audio mode for playback: silent switch, ducking, no recording, no background', async () => {
    await audioPlayer.prepare();
    expect(native.audio.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
  });

  it('releases the session at a run end: mixing mode, then deactivated (others told)', async () => {
    const order: string[] = [];
    native.audio.setAudioModeAsync.mockImplementationOnce(async () => {
      order.push('mode');
    });
    native.audio.setIsAudioActiveAsync.mockImplementationOnce(async () => {
      order.push('inactive');
    });
    await audioPlayer.release();
    expect(native.audio.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
    expect(native.audio.setIsAudioActiveAsync).toHaveBeenCalledWith(false);
    expect(order).toEqual(['mode', 'inactive']);
  });

  it('plays a file with a player that keeps the session active, released on stop', () => {
    const handlers = { onPlaying: vi.fn(), onEnded: vi.fn(), onError: vi.fn() };
    const handle = audioPlayer.play('file:///cache/server-voice/1.mp3', handlers);
    expect(native.audio.createAudioPlayer).toHaveBeenCalledWith(
      { uri: 'file:///cache/server-voice/1.mp3' },
      expect.objectContaining({ keepAudioSessionActive: true }),
    );
    expect(native.player.addListener).toHaveBeenCalledWith(
      'playbackStatusUpdate',
      expect.any(Function),
    );
    expect(native.player.play).toHaveBeenCalledTimes(1);
    const listener = native.player.addListener.mock.calls[0]?.[1];
    listener?.({
      playing: true,
      didJustFinish: false,
      duration: 1.5,
      playbackState: 'readyToPlay',
    });
    listener?.({
      playing: false,
      didJustFinish: true,
      duration: 1.5,
      playbackState: 'readyToPlay',
    });
    expect(handlers.onPlaying).toHaveBeenCalledWith(1.5);
    expect(handlers.onEnded).toHaveBeenCalledTimes(1);
    handle.stop();
    expect(native.subscription.remove).toHaveBeenCalledTimes(1);
    expect(native.player.pause).toHaveBeenCalledTimes(1);
    expect(native.player.remove).toHaveBeenCalledTimes(1);
  });
});

describe('the files (expo-file-system)', () => {
  it("empties the folder before the launch's first file (a crash's leftovers), once", () => {
    const leftover = `file:///cache/${SERVER_VOICE_FOLDER}/crash.mp3`;
    native.files.set(leftover, new Uint8Array([9]));
    const first = speechFiles.write(new Uint8Array([1]));
    expect(native.files.has(leftover)).toBe(false);
    expect(native.files.has(first)).toBe(true);
    speechFiles.remove(first);
  });

  it('writes each MP3 under the cache folder and deletes it by its URI', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const uri = speechFiles.write(bytes);
    expect(uri.startsWith(`file:///cache/${SERVER_VOICE_FOLDER}/`)).toBe(true);
    expect(uri.endsWith('.mp3')).toBe(true);
    expect(native.files.get(uri)).toBe(bytes);
    speechFiles.remove(uri);
    expect(native.files.has(uri)).toBe(false);
    expect(() => speechFiles.remove(uri)).not.toThrow();
  });

  it('does not empty the folder again later in the launch', () => {
    const leftover = `file:///cache/${SERVER_VOICE_FOLDER}/old.mp3`;
    native.files.set(leftover, new Uint8Array([9]));
    const uri = speechFiles.write(new Uint8Array([1]));
    expect(native.files.has(leftover)).toBe(true);
    expect(native.files.has(uri)).toBe(true);
  });
});

describe('the one voice out', () => {
  it('speaks through the server with the client the speech carries, the MP3 from its file', async () => {
    const mp3 = new Uint8Array([0x49, 0x44, 0x33]);
    const binary = vi.fn(async () => ({
      bytes: mp3,
      header: (name: string) => (name.toLowerCase() === 'content-type' ? 'audio/mpeg' : null),
    }));
    voiceOut.speak('Hello.', {
      language: 'en-US',
      server: { voice: 'af_heart', speed: 1, client: { binary } },
    });
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(binary).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', path: '/api/voice/speech' }),
      expect.objectContaining({ body: { text: 'Hello.', voice: 'af_heart', speed: 1 } }),
    );
    expect(native.audio.setAudioModeAsync).toHaveBeenCalledTimes(1);
    const played = (native.audio.createAudioPlayer.mock.calls.at(-1) as unknown[] | undefined)?.[0];
    expect(played).toEqual({ uri: expect.stringMatching(/server-voice\/.*\.mp3$/) });
    expect(native.speech.speak).not.toHaveBeenCalled();
    voiceOut.stop();
    expect(native.player.remove).toHaveBeenCalled();
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(native.audio.setIsAudioActiveAsync).toHaveBeenCalledWith(false);
  });

  it("speaks through the phone's voice when the speech asks for no server voice", () => {
    voiceOut.speak('Hello.', { language: 'en-US' });
    expect(native.speech.speak).toHaveBeenCalledWith(
      'Hello.',
      expect.objectContaining({ language: 'en-US', useApplicationAudioSession: false }),
    );
    voiceOut.stop();
  });
});
