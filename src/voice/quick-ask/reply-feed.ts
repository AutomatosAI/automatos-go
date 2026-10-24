// One quick-ask reply, fed as it streams (KV6, US-019g): each new view of the reply (reply-text.ts)
// becomes the voice machine's events and the sentences new since the last one. Pure: no React,
// React Native or Expo; one feed per turn (the chunker remembers what it handed over).
//   The words: toSpeakable over the whole text so far (markdown stripped even when spokenMode is
//   on), which the transcript shows as turn_text and the chunker cuts into sentences as they
//   complete, so Auto starts speaking before the turn ends; finished flushes the rest.
//   The tool caption follows the running call while the turn streams; none once it has stopped.
//   A failed turn says turn_failed, and a turn A2's Stop ended (from anywhere) says stop: nothing
//   more is spoken and whatever is queued is silenced. After the first ending the feed says nothing.

import type { VoiceEvent } from '../machine/voice-reducer';
import { sentenceChunker, type SentenceChunker } from '../speech/sentences';
import { toSpeakable } from '../speech/speakable';
import type { QuickAskReply } from './reply-text';

export type FeedStep = {
  readonly events: readonly VoiceEvent[];
  /** Sentences new since the last step, in order (the AI notice is the engine's to add). */
  readonly speak: readonly string[];
  /** The turn ended: the reply is over (finished, failed or stopped). */
  readonly ended: boolean;
  /** Whatever is queued stops too (failed or stopped). */
  readonly silence: boolean;
};

export type ReplyFeed = { readonly next: (reply: QuickAskReply) => FeedStep };

type Said = {
  readonly text: string;
  readonly caption: string | null;
  readonly ended: boolean;
};

const NOTHING: readonly never[] = Object.freeze([]);
const QUIET: FeedStep = Object.freeze({
  events: NOTHING,
  speak: NOTHING,
  ended: false,
  silence: false,
});

function step(
  events: readonly VoiceEvent[],
  speak: readonly string[],
  ended: boolean,
  silence = false,
): FeedStep {
  return Object.freeze({
    events: Object.freeze([...events]),
    speak: Object.freeze([...speak]),
    ended,
    silence,
  });
}

/** A turn that ended without its words: nothing more is spoken. */
function cutOff(reply: QuickAskReply): FeedStep | null {
  if (reply.failedKind !== undefined)
    return step([{ type: 'turn_failed', kind: reply.failedKind }], NOTHING, true, true);
  if (reply.stopped) return step([{ type: 'stop' }], NOTHING, true, true);
  return null;
}

/** What changed since the last view: the words, then the running tool. */
function changes(said: Said, text: string, caption: string | null): VoiceEvent[] {
  return [
    ...(text === said.text ? [] : [{ type: 'turn_text', text } as const]),
    ...(caption === said.caption ? [] : [{ type: 'turn_tool', caption } as const]),
  ];
}

/** The reply goes on (or finished as it should): its new words, the tool, the rest at the end. */
function follow(
  said: Said,
  chunker: SentenceChunker,
  reply: QuickAskReply,
): { readonly said: Said; readonly step: FeedStep } {
  const text = toSpeakable(reply.text);
  const caption = reply.streaming ? (reply.toolCaption ?? null) : null;
  const events = changes(said, text, caption);
  const fresh = text === said.text ? [] : chunker.push(text);
  const next: Said = { text, caption, ended: reply.finished };
  if (!reply.finished)
    return {
      said: next,
      step: events.length + fresh.length === 0 ? QUIET : step(events, fresh, false),
    };
  const finished = [...events, { type: 'turn_finished' } as const];
  return { said: next, step: step(finished, [...fresh, ...chunker.flush()], true) };
}

export function createReplyFeed(): ReplyFeed {
  const chunker = sentenceChunker();
  let said: Said = { text: '', caption: null, ended: false };

  function next(reply: QuickAskReply): FeedStep {
    if (said.ended) return QUIET;
    const over = cutOff(reply);
    if (over !== null) {
      said = { ...said, ended: true };
      return over;
    }
    const followed = follow(said, chunker, reply);
    said = followed.said;
    return followed.step;
  }

  return Object.freeze({ next });
}
