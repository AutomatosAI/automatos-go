// The server speaker's ports and events (server-speaker.ts): what it asks of the API client, the
// cache and the player, and what it tells the reply voice. Types only; server-voice.ts binds the
// ports, the tests fake them.

import type { ApiClient } from '../../api/client';
import type { SpeechFailureKind } from './voice-api';

/** How quick-ask asks the server to speak: which voice, how fast, through which client. */
export type ServerSpeech = {
  /** The server's voice id; null for the server's default. */
  readonly voice: string | null;
  /** Settings → Voice's Speed (0.8–1.2), sent as speed. */
  readonly speed: number;
  /** The session's one API client (the bearer stays in its headers). */
  readonly client: Pick<ApiClient, 'binary'>;
};

export type PlayHandlers = {
  /** The file started playing; its length in seconds when the player knows it (else 0). */
  readonly onPlaying: (durationSeconds: number) => void;
  readonly onEnded: () => void;
  readonly onError: () => void;
};

export type AudioPort = {
  /** The audio session for playback (iOS: plays with the ringer switch on silent). */
  readonly prepare: () => Promise<void>;
  /** Plays the file; the handle's stop() stops it and releases the player. */
  readonly play: (uri: string, handlers: PlayHandlers) => { readonly stop: () => void };
};

export type SpeechFiles = {
  /** The MP3 in the cache; its file URI. Throws when it cannot be written. */
  readonly write: (bytes: Uint8Array) => string;
  /** Deletes a file write() made; never throws. */
  readonly remove: (uri: string) => void;
};

export type ServerSpeakerPorts = {
  readonly fetchSpeech: (
    server: ServerSpeech,
    text: string,
    signal: AbortSignal,
  ) => Promise<Uint8Array>;
  readonly files: SpeechFiles;
  readonly audio: AudioPort;
  /** Runs `run` after `ms`; returns the cancel. */
  readonly later: (run: () => void, ms: number) => () => void;
};

export type ServerFailureKind =
  SpeechFailureKind | 'timeout' | 'file' | 'play_error' | 'play_stalled';

export type ServerSpeakerEvent =
  | { readonly type: 'speak_start' }
  | { readonly type: 'speak_done' }
  | {
      readonly type: 'failed';
      readonly kind: ServerFailureKind;
      /** The sentence that failed and every one queued after it, in order. */
      readonly rest: readonly string[];
    };

export type ServerSpeaker = {
  readonly speak: (text: string, server: ServerSpeech) => void;
  readonly stop: () => void;
  /** A run is under way: queued, fetching or playing. */
  readonly busy: () => boolean;
};
