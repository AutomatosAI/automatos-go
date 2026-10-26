// The AI notice (KV7, US-019e; PRD-264 EUAI-04): quick-ask shows and speaks the server's greeting
// once, before the first spoken reply of a voice session, and never again in that session: no
// reminder, whatever the time (D73). Pure: no React, React Native or Expo, and no clock.
//   A session starts at the first quick-ask after the voice screen mounts and ends when it unmounts
//   or the app goes to the background (the hooks call newSession(), US-019g and US-019h).
//   At a send, noticeFor(session) is the reducer's 'sent' notice: the AUTO line the transcript shows
//   above the reply (the foundation's AiLabel caption stays on the screen as well).
//   queueWithNotice() puts the greeting on the speaker's queue ahead of the reply's first sentence and
//   notes the session then: a turn that fails, or ends with nothing to speak, leaves the greeting for
//   the next spoken reply.
//   The name is the AI label's (ai-label-state.ts aiLabelWords): Auto when no agent is picked, the
//   picked agent's name, or the vendored UNNAMED_AGENT while that name is not loaded.

import { DEFAULT_AGENT_NAME, UNNAMED_AGENT } from '../../core/web/lib/ai-label/copy';
import type { AiLabelAgent } from '../../styles/ai-label-state';
import type { VoiceNotice } from '../machine/voice-state';
import { AI_VOICE_GREETING } from '../strings';

/** Whether this voice session has had its greeting queued. */
export type NoticeSession = { readonly sessionNoticed: boolean };

/** The sentences to hand the speaker, in order, and the session after them. */
export type NoticeQueue = {
  readonly session: NoticeSession;
  readonly speak: readonly string[];
};

/** A voice session that has not heard the notice yet (a new value each call). */
export function newSession(): NoticeSession {
  return Object.freeze({ sessionNoticed: false });
}

/** The session once the greeting has been queued (a new value; the given one is left as it was). */
export function noted(session: NoticeSession): NoticeSession {
  return Object.freeze({ ...session, sessionNoticed: true });
}

/** The greeting before the session's first spoken reply; nothing after it in the same session. */
export function noticeFor(session: NoticeSession): VoiceNotice {
  return session.sessionNoticed ? null : 'greeting';
}

/** UNNAMED_AGENT sits mid-sentence in the greeting: 'This agent' → 'this agent'. */
const UNNAMED_IN_SENTENCE = UNNAMED_AGENT.charAt(0).toLowerCase() + UNNAMED_AGENT.slice(1);

/** The name the greeting says, on one line. */
function greetingName(agent: AiLabelAgent): string {
  if (!agent) return DEFAULT_AGENT_NAME;
  const name = agent.name?.replace(/\s+/g, ' ').trim();
  return name || UNNAMED_IN_SENTENCE;
}

/**
 * 'Hi, this is Auto, your AI assistant.', with the answering agent's name in place of Auto when the
 * turn's agent is not Auto. Only the name changes: the AI words are the server's.
 */
export function noticeText(agent?: AiLabelAgent): string {
  const name = greetingName(agent);
  // A function replacement: a name holding '$&' or '$1' is said as written, not expanded.
  return AI_VOICE_GREETING.replace(DEFAULT_AGENT_NAME, () => name);
}

/**
 * The reply's new sentences for the speaker, with the greeting first when they are the session's
 * first spoken words. No sentences yet: nothing to queue, and the greeting waits for the first one.
 */
export function queueWithNotice(
  session: NoticeSession,
  sentences: readonly string[],
  agent?: AiLabelAgent,
): NoticeQueue {
  if (sentences.length === 0 || session.sessionNoticed) {
    return Object.freeze({ session, speak: Object.freeze([...sentences]) });
  }
  return Object.freeze({
    session: noted(session),
    speak: Object.freeze([noticeText(agent), ...sentences]),
  });
}
