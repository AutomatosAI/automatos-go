// Auto's events from A2's thread (D37, US-016k), pure: what the homes tell the mascot driver beside
// the frames. The frames of a turn this phone reads reach the driver one by one through useThread's
// onFrame (US-017a's chat-events maps them); everything the frames cannot say comes from how the
// thread's state moved, read by the vendored rules:
//
//   status        the thread's status as the web chat's (streaming and working are 'streaming', a
//                 failure 'error', the rest 'idle') through mascotEventsFromStatus: a send starts
//                 the turn, a failure fails it, its end finishes it. The frames' own finish and
//                 error land on a turn already ended, which the reducer takes as nothing new.
//   stop          Stop: the vendored {type: 'stop'} before the turn's end, so its done receipt no
//                 longer celebrates (the web's stop, hooks.ts)
//   ended well    a turn that finished with no failure and no cap: the vendored {type: 'request-ok'}
//                 after its end, so a snag along the way (a tool that failed, a step refused) does
//                 not outlast the reply. Oops outranks every pose and only the next send cleared it,
//                 so HUD's home read SOMETHING WENT WRONG / AUTO · SNAG under Auto's whole answer
//                 (28 Oct 2026). A turn that failed (an e: line, a broken read) or hit its cap keeps it.
//   newest reply  mascotEventsFromReply over the live turn's progress, only while no frames are
//                 read (a reopened turn the server still runs): one source per turn
//   approvals     a plan, tool or withdraw card waiting on the user: approval-waiting, and
//                 approval-settled once none waits
//   deliverables  a Deliverable the live turn names for the first time: deliverable-added, once
//                 per move (the web's lib/chat-controller/turn.ts announces each new one once), so
//                 Auto celebrates as its card lands (US-017g)
//
// captionFactsOf says what Play's row adds under Auto's word (the vendored chatCaption): the
// running call's input, the newest Deliverable's kind, a card waiting on the user.

import type { ThreadState } from '../../chat/controller/thread';
import type { CaptionFacts } from '../../core/frozen/components/play/chat/caption';
import type { MascotEvent } from '../../core/frozen/lib/mascot/types';
import {
  mascotEventsFromReply,
  mascotEventsFromStatus,
  NO_REPLY,
  type ChatStatus,
  type ReplyProgress,
} from '../mascot/chat-events';

export type FeedFacts = Pick<ThreadState, 'status' | 'live' | 'failure' | 'cards'>;

const STOP: MascotEvent = Object.freeze({ type: 'stop' });
const APPROVAL_WAITING: MascotEvent = Object.freeze({ type: 'approval-waiting' });
const APPROVAL_SETTLED: MascotEvent = Object.freeze({ type: 'approval-settled' });
const APPROVAL_KINDS: ReadonlySet<string> = new Set(['plan', 'tool', 'withdraw']);
const DELIVERABLE_ADDED: MascotEvent = Object.freeze({ type: 'deliverable-added' });
const REQUEST_OK: MascotEvent = Object.freeze({ type: 'request-ok' });

/** The web chat's status for the thread's (lib/chat/chat-status.ts). */
export function chatStatusOf(state: Pick<ThreadState, 'status'>): ChatStatus {
  if (state.status === 'streaming' || state.status === 'working') return 'streaming';
  return state.status === 'failed' ? 'error' : 'idle';
}

/** This phone reads the turn's frames (useThread's onFrame hears them). */
function readsFrames(state: Pick<ThreadState, 'status'>): boolean {
  return state.status === 'streaming';
}

/** The live turn's reply as the vendored rules read it; NO_REPLY with no turn on screen. */
export function replyProgressOf(state: Pick<ThreadState, 'live'>): ReplyProgress {
  const { live } = state;
  if (!live) return NO_REPLY;
  const { turn } = live;
  return {
    id: `live-${live.since}`,
    hasText: turn.text.trim() !== '',
    toolRunning: turn.toolCalls.some((call) => call.state === 'running'),
    reasoningChars: turn.reasoning.length,
    limitReached: turn.limitReached !== null,
  };
}

/** A card waits on the user's answer: a plan, a tool or a withdraw request still open. */
export function approvalWaiting(state: Pick<ThreadState, 'cards'>): boolean {
  return state.cards.some(
    (filed) => APPROVAL_KINDS.has(filed.card.kind) && filed.outcome.state === 'open',
  );
}

/** The turn ran and finished as it should: no failure, no cap (the live turn, or the one retired). */
function endedWell(previous: FeedFacts, next: FeedFacts): boolean {
  if (chatStatusOf(previous) !== 'streaming' || next.status !== 'idle') return false;
  const turn = (next.live ?? previous.live)?.turn;
  return next.failure === null && !turn?.error && !turn?.limitReached;
}

function statusEvents(previous: FeedFacts, next: FeedFacts): MascotEvent[] {
  const before = chatStatusOf(previous);
  const after = chatStatusOf(next);
  const code = after === 'error' ? (next.failure?.code ?? null) : null;
  const stopped = next.status === 'stopped' && previous.status !== 'stopped';
  return [
    ...(stopped ? [STOP] : []),
    ...mascotEventsFromStatus(before, after, code),
    ...(endedWell(previous, next) ? [REQUEST_OK] : []),
  ];
}

function replyEvents(previous: FeedFacts, next: FeedFacts): MascotEvent[] {
  if (readsFrames(previous) || readsFrames(next)) return [];
  return mascotEventsFromReply(
    replyProgressOf(previous),
    replyProgressOf(next),
    chatStatusOf(next),
  );
}

function approvalEvents(previous: FeedFacts, next: FeedFacts): MascotEvent[] {
  const before = approvalWaiting(previous);
  const after = approvalWaiting(next);
  if (before === after) return [];
  return [after ? APPROVAL_WAITING : APPROVAL_SETTLED];
}

/** The ids of the live turn's Deliverables; none with no turn on screen. */
function madeIds(state: Pick<FeedFacts, 'live'>): ReadonlySet<string> {
  return new Set(state.live?.turn.deliverables.map((ref) => ref.id) ?? []);
}

/** A Deliverable the live turn had not named before: a turn that started anew names all of its. */
function deliverableEvents(previous: FeedFacts, next: FeedFacts): MascotEvent[] {
  const sameTurn = previous.live !== null && previous.live.since === next.live?.since;
  const known = sameTurn ? madeIds(previous) : new Set<string>();
  const fresh = [...madeIds(next)].some((id) => !known.has(id));
  return fresh ? [DELIVERABLE_ADDED] : [];
}

/** Auto's events for one move of the thread's state, in order; none when nothing he reads moved. */
export function threadMascotEvents(previous: FeedFacts, next: FeedFacts): MascotEvent[] {
  if (previous === next) return [];
  return [
    ...statusEvents(previous, next),
    ...replyEvents(previous, next),
    ...approvalEvents(previous, next),
    ...deliverableEvents(previous, next),
  ];
}

/** What the live turn tells Play's caption: the running call's input, the newest Deliverable. */
export function captionFactsOf(state: Pick<ThreadState, 'live' | 'cards'>): CaptionFacts {
  const turn = state.live?.turn;
  const running = turn?.toolCalls.filter((call) => call.state === 'running').at(-1);
  const made = turn?.deliverables.at(-1);
  return {
    runningInput: running?.input,
    deliverableKind: made?.kind,
    approvalWaiting: approvalWaiting(state),
  };
}
