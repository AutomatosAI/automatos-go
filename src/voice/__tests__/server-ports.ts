// Fake ports for the server speaker's tests: every speech request held until the test answers it
// (bytes, or an error), every file written and removed by name, every player with its handlers, and
// every timer by its delay, so a test plays the server, the cache, the player and the clock itself.

import { vi } from 'vitest';

import type {
  PlayHandlers,
  ServerSpeakerPorts,
  ServerSpeech,
} from '../server/server-speaker-ports';

export type HeldRequest = {
  readonly text: string;
  readonly server: ServerSpeech;
  readonly signal: AbortSignal;
  readonly answer: (bytes?: Uint8Array) => void;
  readonly refuse: (error: unknown) => void;
  /** Answered or refused. */
  done: boolean;
};

export type FakePlayer = {
  readonly uri: string;
  readonly handlers: PlayHandlers;
  stopped: boolean;
};

type Timer = { readonly run: () => void; readonly ms: number; cancelled: boolean; fired: boolean };

export const SERVER_SPEECH: ServerSpeech = Object.freeze({
  voice: 'af_heart',
  speed: 1,
  client: { binary: vi.fn() },
});

const MP3 = new Uint8Array([0x49, 0x44, 0x33]);

export function fakeServerPorts() {
  const requests: HeldRequest[] = [];
  const players: FakePlayer[] = [];
  const written: string[] = [];
  const removed: string[] = [];
  const timers: Timer[] = [];
  /** The audio session's changes, in the order they ran. */
  const session: ('prepare' | 'release')[] = [];
  const prepare = vi.fn(async () => {
    session.push('prepare');
  });
  const release = vi.fn(async () => {
    session.push('release');
  });
  const writeFails = { next: false };
  const ports: ServerSpeakerPorts = {
    fetchSpeech: (server, text, signal) =>
      new Promise<Uint8Array>((resolve, reject) => {
        const request: HeldRequest = {
          text,
          server,
          signal,
          done: false,
          answer: (bytes = MP3) => {
            request.done = true;
            resolve(bytes);
          },
          refuse: (error) => {
            request.done = true;
            reject(error);
          },
        };
        requests.push(request);
      }),
    files: {
      write: () => {
        if (writeFails.next) throw new Error('disk full');
        const uri = `file:///cache/server-voice/${written.length + 1}.mp3`;
        written.push(uri);
        return uri;
      },
      remove: (uri) => {
        removed.push(uri);
      },
    },
    audio: {
      prepare,
      release,
      play: (uri, handlers) => {
        const player: FakePlayer = { uri, handlers, stopped: false };
        players.push(player);
        return {
          stop: () => {
            player.stopped = true;
          },
        };
      },
    },
    later: (run, ms) => {
      const timer: Timer = { run, ms, cancelled: false, fired: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  };
  /** Runs every live timer of that delay (the clock reaching it). */
  const fire = (ms: number): void => {
    timers
      .filter((timer) => timer.ms === ms && !timer.cancelled && !timer.fired)
      .forEach((timer) => {
        timer.fired = true;
        timer.run();
      });
  };
  /** Requests still waiting for an answer and not aborted. */
  const inFlight = (): HeldRequest[] =>
    requests.filter((request) => !request.done && !request.signal.aborted);
  const playerOf = (index: number): FakePlayer => {
    const player = players[index];
    if (!player) throw new Error(`no player ${index}`);
    return player;
  };
  return {
    ports,
    requests,
    players,
    written,
    removed,
    timers,
    prepare,
    release,
    session,
    writeFails,
    fire,
    inFlight,
    playerOf,
  };
}

/** Lets promise callbacks (an answered request, the audio session) run. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}
