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
//   newest reply  mascotEventsFromReply over the live turn's progress, only while no frames are
//                 read (a reopened turn the server still runs): one source per turn
//   approvals     a plan, tool or withdraw card waiting on the user: approval-waiting, and
//                 approval-settled once none waits
//
// captionFactsOf says what Play's row adds under Auto's word (the vendored chatCaption): the
// running call's input, the newest Deliverable's kind, a card waiting on the user.

import type { ThreadState } from '../../chat/controller/thread';
import type { CaptionFacts } from '../../core/web/components/play/chat/caption';
import type { MascotEvent } from '../../core/web/lib/mascot/types';
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

function statusEvents(previous: FeedFacts, next: FeedFacts): MascotEvent[] {
  const before = chatStatusOf(previous);
  const after = chatStatusOf(next);
  const code = after === 'error' ? (next.failure?.code ?? null) : null;
  const stopped = next.status === 'stopped' && previous.status !== 'stopped';
  return [...(stopped ? [STOP] : []), ...mascotEventsFromStatus(before, after, code)];
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

/** Auto's events for one move of the thread's state, in order; none when nothing he reads moved. */
export function threadMascotEvents(previous: FeedFacts, next: FeedFacts): MascotEvent[] {
  if (previous === next) return [];
  return [
    ...statusEvents(previous, next),
    ...replyEvents(previous, next),
    ...approvalEvents(previous, next),
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
