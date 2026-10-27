// expo-audio's status updates folded into the server speaker's play events: playing once with the
// duration, ended at didJustFinish, error when the player failed, nothing after the end.

import { describe, expect, it, vi } from 'vitest';

import { playbackListener, type PlaybackStatus } from '../server/playback-status';

const IDLE: PlaybackStatus = {
  playing: false,
  didJustFinish: false,
  duration: 0,
  playbackState: 'unknown',
};

function listener() {
  const handlers = { onPlaying: vi.fn(), onEnded: vi.fn(), onError: vi.fn() };
  return { handlers, hear: playbackListener(handlers) };
}

describe('playbackListener', () => {
  it('says playing once, with the duration, then ended once', () => {
    const { handlers, hear } = listener();
    hear({ ...IDLE, playbackState: 'readyToPlay', duration: 2.4 });
    hear({ ...IDLE, playing: true, duration: 2.4 });
    hear({ ...IDLE, playing: true, duration: 2.4 });
    hear({ ...IDLE, didJustFinish: true, duration: 2.4 });
    hear({ ...IDLE, didJustFinish: true, duration: 2.4 });
    expect(handlers.onPlaying).toHaveBeenCalledTimes(1);
    expect(handlers.onPlaying).toHaveBeenCalledWith(2.4);
    expect(handlers.onEnded).toHaveBeenCalledTimes(1);
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('reads a duration that is not a number as unknown (0)', () => {
    const { handlers, hear } = listener();
    hear({ ...IDLE, playing: true, duration: Number.NaN });
    expect(handlers.onPlaying).toHaveBeenCalledWith(0);
  });

  it('says error when the player failed, and nothing after it', () => {
    const { handlers, hear } = listener();
    hear({ ...IDLE, playbackState: 'failed' });
    hear({ ...IDLE, playing: true, didJustFinish: true });
    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onPlaying).not.toHaveBeenCalled();
    expect(handlers.onEnded).not.toHaveBeenCalled();
  });

  it('a file so short it finished in one update says playing, then ended', () => {
    const { handlers, hear } = listener();
    hear({ ...IDLE, playing: true, didJustFinish: true, duration: 0.2 });
    expect(handlers.onPlaying).toHaveBeenCalledWith(0.2);
    expect(handlers.onEnded).toHaveBeenCalledTimes(1);
  });
});
