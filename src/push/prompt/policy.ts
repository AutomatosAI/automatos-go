// When the in-context ask is offered (PRD-001 §4.8 "after the first useful moment, never at
// launch", KP11), pure. Only while this phone's status is 'ask' (the server pushes, the build can,
// and the OS has not been asked), and only once something waits for the person (the needs-you
// total above zero) or from the second session on. 'Not now' holds it back PROMPT_COOLDOWN_MS (a
// decline dated ahead of the clock holds it back too); after PROMPT_MAX_DECLINES only Settings →
// Notifications offers it. The sheet never asks the OS by itself: its 'Turn on' is a person's tap.

import { PROMPT_COOLDOWN_MS, PROMPT_MAX_DECLINES, PROMPT_MIN_SESSIONS } from '../config';
import type { PushStatus } from '../registration/state';

export type PromptInput = Readonly<{
  /** This phone's status (the registrar's last answer); null before the first run ends. */
  status: PushStatus | null;
  /** Signed-in sessions on this phone, this one included. */
  sessionCount: number;
  /** The server's needs-you total (useNeedsYou). */
  needsYouTotal: number;
  /** When 'Not now' was last tapped (epoch milliseconds), or null. */
  lastDeclinedAt: number | null;
  declines: number;
  now: number;
}>;

/** A decline this recent (or dated ahead of the clock) holds the ask back. */
function coolingDown(lastDeclinedAt: number | null, now: number): boolean {
  return lastDeclinedAt !== null && now - lastDeclinedAt < PROMPT_COOLDOWN_MS;
}

export function offerPrompt(input: PromptInput): boolean {
  if (input.status?.kind !== 'ask') return false;
  if (input.declines >= PROMPT_MAX_DECLINES) return false;
  if (coolingDown(input.lastDeclinedAt, input.now)) return false;
  return input.needsYouTotal > 0 || input.sessionCount >= PROMPT_MIN_SESSIONS;
}
