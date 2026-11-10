// spokenMode for quick-ask (US-019f, D-CAPABILITIES; PRD-001 §4.4): a turn quick-ask sends asks
// for spoken-style replies (short sentences, no markdown: chat_models.py ChatRequest.spokenMode)
// only when the server lists 'spoken_mode'. Without it the turn goes out plain, as a typed one
// does, and toSpeakable (speech/speakable.ts) makes the reply speakable on the phone. Either way the
// turn goes through A2's controller (use-thread.ts send → buildChatRequest), never a second request.
// Every turn also carries the locale it was heard in ("I speak": pt-BR, the English chosen, or the
// phone's on Automatic), so Auto answers in that variant of the language (28 Oct 2026).
// How the reply is then cut for the voice (voice latency E-11, E-5) also comes from what the server
// lists: replyFeedOptionsFor. With neither capability listed the reply is cut as it always was.
// Pure: no React, React Native or Expo.

import {
  canFirstClause,
  canSpokenMode,
  canSpokenUnitEnds,
  type GateInput,
} from '../../api/capabilities';
import type { ChatRequestInput } from '../../chat/request';
import type { SpeakOptions } from '../speech/speaker-core';

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

/** How one turn's reply is cut into what the voice speaks (reply-feed.ts). */
export type ReplyFeedOptions = {
  /** A sentence that ends the text so far is spoken at once (E-11). */
  readonly unitEnds: boolean;
  /** The first clause of a long first sentence may be spoken on its own (E-5). */
  readonly firstClause: boolean;
};

/**
 * How this turn's reply is cut for the voice: from what the server lists and the voice that will
 * speak. unitEnds only on a turn sent with spokenMode, the only one whose text frames are whole
 * units; firstClause only with Auto's server voice, the only one with a request to shorten.
 */
export function replyFeedOptionsFor(
  discovery: GateInput,
  speech: Pick<SpeakOptions, 'server'>,
): ReplyFeedOptions {
  return Object.freeze({
    unitEnds: spokenModeFor(discovery) && canSpokenUnitEnds(discovery),
    firstClause: canFirstClause(discovery) && speech.server !== undefined,
  });
}
