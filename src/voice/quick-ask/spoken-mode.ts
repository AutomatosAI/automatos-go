// spokenMode for quick-ask (US-019f, D-CAPABILITIES; PRD-001 §4.4): a turn quick-ask sends asks
// for spoken-style replies (short sentences, no markdown: chat_models.py ChatRequest.spokenMode)
// only when the server lists 'spoken_mode'. Without it the turn goes out plain, as a typed one
// does, and toSpeakable (speech/speakable.ts) makes the reply speakable on the phone. Either way the
// turn goes through A2's controller (use-thread.ts send → buildChatRequest), never a second request.
// Pure: no React, React Native or Expo.

import { canSpokenMode, type GateInput } from '../../api/capabilities';
import type { ChatRequestInput } from '../../chat/request';

/** What quick-ask hands A2's thread send: the heard words, flagged spoken when the server can. */
export type QuickAskMessage = Pick<ChatRequestInput, 'text' | 'spokenMode'>;

/** Whether quick-ask's turn carries spokenMode: the capability, never a server version. */
export function spokenModeFor(discovery: GateInput): boolean {
  return canSpokenMode(discovery);
}

/** The message for A2's send: spokenMode only when the server lists it (a new frozen value). */
export function quickAskMessage(text: string, discovery: GateInput): QuickAskMessage {
  return Object.freeze(spokenModeFor(discovery) ? { text, spokenMode: true } : { text });
}
