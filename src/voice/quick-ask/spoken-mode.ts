// spokenMode for quick-ask (US-019f, D-CAPABILITIES; PRD-001 §4.4): a turn quick-ask sends asks
// for spoken-style replies (short sentences, no markdown: chat_models.py ChatRequest.spokenMode)
// only when the server lists 'spoken_mode'. Without it the turn goes out plain, as a typed one
// does, and toSpeakable (speech/speakable.ts) makes the reply speakable on the phone. Either way the
// turn goes through A2's controller (use-thread.ts send → buildChatRequest), never a second request.
// Every turn also carries the locale it was heard in ("I speak": pt-BR, the English chosen, or the
// phone's on Automatic), so Auto answers in that variant of the language (28 Oct 2026).
// Pure: no React, React Native or Expo.

import { canSpokenMode, type GateInput } from '../../api/capabilities';
import type { ChatRequestInput } from '../../chat/request';

/** What quick-ask hands A2's thread send: the heard words, flagged spoken when the server can. */
export type QuickAskMessage = Pick<ChatRequestInput, 'text' | 'spokenMode' | 'locale'>;

/** Whether quick-ask's turn carries spokenMode: the capability, never a server version. */
export function spokenModeFor(discovery: GateInput): boolean {
  return canSpokenMode(discovery);
}

/**
 * The message for A2's send (a new frozen value): spokenMode only when the server lists it, and the
 * locale the words were heard in.
 */
export function quickAskMessage(
  text: string,
  discovery: GateInput,
  locale: string,
): QuickAskMessage {
  return Object.freeze({ text, ...(spokenModeFor(discovery) ? { spokenMode: true } : {}), locale });
}
