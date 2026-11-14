// Quick-ask's turn and its reply (KV6, US-019g). Pure: no React, React Native or Expo (the ports are
// quick-ask-store.ts's).
//   send → A2's thread send for the voice screen's conversation (spokenMode when the server lists it,
//   US-019f; the locale it was heard in, the speech's language), once the thread may send: a turn that barge-in cancelled settles first, and until then
//   the words wait. The reply's feed is cut the way the server lists (replyFeedOptionsFor: voice
//   latency E-11, off unless the server lists it). The reducer hears 'sent' with the AI notice when it is the session's first; the
//   last turn's reply leaves the snapshot until this turn's shows up.
//   Each thread state → the turn quick-ask sent, followed by identity (reply-text.ts) → its reply fed
//   (reply-feed.ts) → the reducer's events, and the new sentences to the speaker with the AI notice
//   first once per session (US-019e). Only that turn is spoken: a typed turn never is.
//   The speaker never talks over the open mic (KV13). A reply that finished with nothing left to say
//   while the speaker is idle ends Auto's turn at once (no speak_done would come). Each send is a new
//   turn for the voice out (newTurn): a turn whose server voice failed was spoken on the phone, and
//   this one tries the server again.
//   Timing (voice latency A-5), only with a timing port: each send begins a turn there and keeps
//   its reference until the turn is over (the run's end, STOP, the next send); the reply's first
//   text, its first sentence and the run's first sound are marked by that reference. The reply's
//   own sentences carry it to the server voice (withTurn); the AI notice never does.

import { canSend, type ThreadState } from '../../chat/controller/thread';
import { claim, release } from '../audio/audio-owner';
import { noticeFor, queueWithNotice } from '../notice/ai-notice';
import type { SpeakerEvent } from '../speech/speaker-core';
import { canTurnTiming } from '../../api/capabilities';
import { closeTurn, dispatch, get, set, show, type Engine } from './quick-ask-store';
import { createReplyFeed, type FeedStep } from './reply-feed';
import { awaitingTurn, quickAskReply, trackTurn, type QuickAskReply } from './reply-text';
import { quickAskMessage, replyFeedOptionsFor, withTurn } from './spoken-mode';

export function send(engine: Engine, text: string): void {
  const { thread, discovery, speech } = engine.deps.context();
  if (!canSend(thread.state)) return set(engine, { pending: text });
  closeTurn(engine);
  const turnRef = engine.deps.timing?.begin() ?? null;
  const feed = createReplyFeed(replyFeedOptionsFor(discovery, speech));
  set(engine, { tracking: awaitingTurn(thread.state), feed, pending: null, turnRef });
  // The last turn's reply no longer describes the screen ('See it in the chat', its agent).
  show(engine, { reply: null });
  engine.deps.speaker.newTurn();
  thread.send(quickAskMessage(text, discovery, speech.language, turnRef));
  dispatch(engine, { type: 'sent', notice: noticeFor(get(engine).session) });
}

/** New sentences to the speaker, the AI notice first when they are the session's first (KV7). */
function speak(engine: Engine, sentences: readonly string[], reply: QuickAskReply): void {
  if (sentences.length === 0) return;
  const claimed = claim(get(engine).owner, 'speaker');
  // The user holds the mic again (or Live is up): this reply is no longer spoken.
  if (!claimed.granted) return;
  const agent = reply.agentName === undefined ? null : { name: reply.agentName };
  const queued = queueWithNotice(get(engine).session, sentences, agent);
  set(engine, { owner: claimed.owner, session: queued.session });
  const { speech, discovery } = engine.deps.context();
  const { turnRef } = get(engine);
  engine.deps.timing?.mark(turnRef, 'sentence');
  // The notice, when it leads: it is not the reply's, so it carries no turn.
  const lead = queued.speak.length - sentences.length;
  if (lead > 0) engine.deps.timing?.note(turnRef, { notice: true });
  const own = withTurn(speech, turnRef, canTurnTiming(discovery));
  queued.speak.forEach((sentence, index) =>
    engine.deps.speaker.speak(sentence, index < lead ? speech : own),
  );
}

function applyStep(engine: Engine, step: FeedStep, reply: QuickAskReply): void {
  step.events.forEach((event) => dispatch(engine, event));
  if (step.silence) engine.deps.speaker.stop();
  speak(engine, step.speak, reply);
  if (!step.ended) return;
  set(engine, { tracking: null, feed: null });
  // Finished with nothing left to say and the speaker idle: Auto is done (no speak_done will come).
  if (!step.silence && get(engine).owner !== 'speaker') dispatch(engine, { type: 'speak_done' });
  // Nothing is being spoken: the turn is over. Otherwise the speaker's last event closes it.
  if (get(engine).owner !== 'speaker') closeTurn(engine);
}

export function onThread(engine: Engine, state: ThreadState): void {
  const { pending, tracking, feed } = get(engine);
  if (pending !== null && canSend(state)) return send(engine, pending);
  if (tracking === null || feed === null) return;
  const next = trackTurn(tracking, state);
  if (next !== tracking) set(engine, { tracking: next });
  const reply = quickAskReply(state, next);
  if (reply === null) return;
  show(engine, { reply });
  if (reply.text !== '') engine.deps.timing?.mark(get(engine).turnRef, 'reply_text');
  applyStep(engine, feed.next(reply), reply);
}

export function onSpeaker(engine: Engine, event: SpeakerEvent): void {
  if (event.type === 'speak_start') {
    engine.deps.timing?.mark(get(engine).turnRef, 'audio');
    return dispatch(engine, { type: 'speak_start' });
  }
  set(engine, { owner: release(get(engine).owner, 'speaker') });
  if (event.type === 'speak_done') dispatch(engine, { type: 'speak_done' });
  // The run is over and the reply ended before it: the turn is over.
  if (get(engine).tracking === null) closeTurn(engine);
}
