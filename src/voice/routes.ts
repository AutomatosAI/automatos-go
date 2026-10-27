// The voice's route table (K4): every server path Auto's server voice calls, as {method, path},
// beside the foundation's src/api/routes.ts and never inside it. scripts/check-routes.ts reads it
// against src/core/route-manifest.json at the pinned automatos-ai SHA. automatos-ai builds both
// routes on feat/voice-tts (27 Oct 2026), so they are pendingUpstream until a re-pin carries them;
// the server lists the discovery capability `tts` only when it has a voice (canServerVoice).

import type { Route } from '../api/routes';

/** Where the routes come from while the pinned manifest does not have them. */
const SERVER_VOICE_UPSTREAM = 'automatos-ai feat/voice-tts (server voice, 27 Oct 2026)';

export const VOICE_ROUTES = Object.freeze({
  /**
   * {text: 1–500 chars, voice: id | null, speed: 0.8–1.2 | null} → 200 audio/mpeg, one MP3 for that
   * text, with X-Voice-Id. Refusals {code, detail}: 503 tts_off | tts_unavailable, 422
   * tts_bad_request, 413 tts_too_long, 429 tts_busy.
   */
  speech: { method: 'POST', path: '/api/voice/speech', pendingUpstream: SERVER_VOICE_UPSTREAM },
  /** {default: id, voices: [{id, name, accent, gender}]}, English first; 503 without a voice. */
  voices: { method: 'GET', path: '/api/voice/voices', pendingUpstream: SERVER_VOICE_UPSTREAM },
} as const satisfies Record<string, Route>);
