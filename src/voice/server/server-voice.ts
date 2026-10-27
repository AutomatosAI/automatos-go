// Auto's server voice, bound (27 Oct 2026): createServerSpeaker (server-speaker.ts, where the
// queue, the prefetch and the failures live) over the one API client (voice-api.ts fetchSpeech,
// with the client the speech carries), the cache (speech-files.ts) and expo-audio
// (audio-player.ts). Only wiring.
//   How an MP3 gets from the server to the speaker: client.binary() reads the 200's body whole as
//   bytes (expo/fetch's arrayBuffer, in src/api/transport.ts); fetchSpeech checks it is audio;
//   speech-files writes it to <cache>/server-voice/<name>.mp3; expo-audio plays that file:// URI.
//   The bearer goes only as the request's header, never into the file's name, a URL or a log.

import { audioPlayer } from './audio-player';
import { createServerSpeaker } from './server-speaker';
import type { ServerSpeaker, ServerSpeakerEvent, ServerSpeakerPorts } from './server-speaker-ports';
import { speechFiles } from './speech-files';
import { fetchSpeech } from './voice-api';

function later(run: () => void, ms: number): () => void {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
}

const PORTS: ServerSpeakerPorts = Object.freeze({
  fetchSpeech: (server, text, signal) =>
    fetchSpeech(server.client, { text, voice: server.voice, speed: server.speed }, signal),
  files: speechFiles,
  audio: audioPlayer,
  later,
});

/** The server voice, telling `emit` what it does (reply-voice.ts makes it with its handler). */
export function createServerVoice(emit: (event: ServerSpeakerEvent) => void): ServerSpeaker {
  return createServerSpeaker(PORTS, emit);
}
