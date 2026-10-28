// One quick-ask reply, fed as it streams (KV6, US-019g): each new view of the reply (reply-text.ts)
// becomes the voice machine's events and the sentences new since the last one. Pure: no React,
// React Native or Expo; one feed per turn (the chunker remembers what it handed over).
//   The words: toSpeakable over the whole text so far (markdown stripped even when spokenMode is
//   on), which the transcript shows as turn_text and the chunker cuts into sentences as they
//   complete, so Auto starts speaking before the turn ends; finished flushes the rest.
//   The tool caption follows the running call while the turn streams; none once it has stopped.
//   A failed turn says turn_failed, and a turn A2's Stop ended (from anywhere) says stop: nothing
//   more is spoken and whatever is queued is silenced. After the first ending the feed says nothing.
//   A read that broke (the network, the stream: thread.ts readBroke) is not an ending (28 Oct 2026):
//   the turn is a detached producer and may run on. It says turn_failed once and silences the
//   speech, then keeps following the turn; when the thread has it again (A2's detached check says it
//   runs on, or its saved reply lands) it says turn_resumed and goes on from the words not yet
//   spoken, so a long turn whose read broke is heard to its end instead of staying an error.

import { readBroke } from '../../chat/controller/thread';
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
  /** The read broke and turn_failed was said: the turn may still run on. */
  readonly broken: boolean;
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

type Fed = { readonly said: Said; readonly step: FeedStep };

const RESUMED: VoiceEvent = Object.freeze({ type: 'turn_resumed' });

/** A turn that ended without its words, or a read that broke (said once); null: it goes on. */
function cutOff(said: Said, reply: QuickAskReply): Fed | null {
  const kind = reply.failedKind;
  if (kind !== undefined && readBroke(kind)) {
    if (said.broken) return { said, step: QUIET };
    const failed = step([{ type: 'turn_failed', kind }], NOTHING, false, true);
    return { said: { ...said, broken: true }, step: failed };
  }
  const ended = { ...said, ended: true };
  if (kind !== undefined)
    return { said: ended, step: step([{ type: 'turn_failed', kind }], NOTHING, true, true) };
  if (reply.stopped) return { said: ended, step: step([{ type: 'stop' }], NOTHING, true, true) };
  return null;
}

/** The turn whose read broke runs on: turn_resumed first, then what it says. */
function resumed(fed: Fed): Fed {
  const { events, speak, ended, silence } = fed.step;
  return { said: fed.said, step: step([RESUMED, ...events], speak, ended, silence) };
}

/** What changed since the last view: the words, then the running tool. */
function changes(said: Said, text: string, caption: string | null): VoiceEvent[] {
  return [
    ...(text === said.text ? [] : [{ type: 'turn_text', text } as const]),
    ...(caption === said.caption ? [] : [{ type: 'turn_tool', caption } as const]),
  ];
}

/** The reply goes on (or finished as it should): its new words, the tool, the rest at the end. */
function follow(said: Said, chunker: SentenceChunker, reply: QuickAskReply): Fed {
  const text = toSpeakable(reply.text);
  const caption = reply.streaming ? (reply.toolCaption ?? null) : null;
  const events = changes(said, text, caption);
  const fresh = text === said.text ? [] : chunker.push(text);
  const next: Said = { text, caption, ended: reply.finished, broken: false };
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
  let said: Said = { text: '', caption: null, ended: false, broken: false };

  function next(reply: QuickAskReply): FeedStep {
    if (said.ended) return QUIET;
    const over = cutOff(said, reply);
    if (over !== null) {
      said = over.said;
      return over.step;
    }
    const followed = follow(said, chunker, reply);
    const fed = said.broken ? resumed(followed) : followed;
    said = fed.said;
    return fed.step;
  }

  return Object.freeze({ next });
}
