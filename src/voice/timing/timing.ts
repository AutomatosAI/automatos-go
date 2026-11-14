// The app's one voice timing (voice latency A-5): voice-timing.ts over the phone's clocks. Quick-ask
// marks its turns on it (use-quick-ask.ts), the server voice its speech requests
// (server/server-voice.ts), and Settings → Voice reads it (use-timing.ts). In memory only.
//   The interval clock is performance.now when the runtime has one (monotonic; Hermes gives
//   fractions, which voice-timing.ts rounds), else Date.now: chosen once, here. The line of a
//   finished turn goes to the logger, which says nothing outside a development build.

import { logger } from '../../lib/logger';
import { TIMING_KEEP } from '../config';
import { createVoiceTiming } from './voice-timing';

const now: () => number =
  typeof globalThis.performance?.now === 'function' ? () => globalThis.performance.now() : Date.now;

export const voiceTiming = createVoiceTiming({
  now,
  wall: Date.now,
  log: (line) => logger.debug(line),
  keep: TIMING_KEEP,
});
