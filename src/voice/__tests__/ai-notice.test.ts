// The AI notice (US-019e, KV7): the greeting before the first spoken reply of a voice session and
// never again in it, whatever the time (no reminder, D73); a new session greets again; the answering
// agent's name in place of Auto; queued ahead of the reply's first sentence; frozen inputs.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_AGENT_NAME, UNNAMED_AGENT } from '../../core/web/lib/ai-label/copy';
import {
  newSession,
  noted,
  noticeFor,
  noticeText,
  queueWithNotice,
  type NoticeSession,
} from '../notice/ai-notice';
import { AI_VOICE_GREETING } from '../strings';
import { deepFreeze } from './voice-fixtures';

const THIRTY_MINUTES_MS = 30 * 60_000;

/** One spoken reply of a session: its notice at the send, then its sentences queued. */
function reply(session: NoticeSession, sentences: readonly string[]) {
  const notice = noticeFor(session);
  const queued = queueWithNotice(session, sentences);
  return { notice, speak: queued.speak, session: queued.session };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('noticeFor', () => {
  it('greets before the first reply of a session', () => {
    expect(noticeFor(newSession())).toBe('greeting');
  });

  it('says nothing for the second reply of the same session', () => {
    const first = reply(newSession(), ['Sure.']);
    expect(first.notice).toBe('greeting');
    const second = reply(first.session, ['Done.']);
    expect(second.notice).toBeNull();
    expect(second.speak).toEqual(['Done.']);
  });

  it('says nothing for a reply 30 minutes later in the same session: no reminder (D73)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const first = reply(newSession(), ['Sure.']);
    vi.advanceTimersByTime(THIRTY_MINUTES_MS);
    const later = reply(first.session, ['Still here.']);
    expect(later.notice).toBeNull();
    expect(later.speak).toEqual(['Still here.']);
  });

  it('greets again in a new session (the screen mounted again, or back from the background)', () => {
    const first = reply(newSession(), ['Sure.']);
    expect(noticeFor(first.session)).toBeNull();
    const again = reply(newSession(), ['Hello again.']);
    expect(again.notice).toBe('greeting');
    expect(again.speak).toEqual([AI_VOICE_GREETING, 'Hello again.']);
  });
});

describe('newSession and noted', () => {
  it('return new values and leave the given session as it was', () => {
    const fresh = newSession();
    expect(newSession()).not.toBe(fresh);
    const after = noted(fresh);
    expect(after).not.toBe(fresh);
    expect(fresh.sessionNoticed).toBe(false);
    expect(after.sessionNoticed).toBe(true);
    expect(Object.isFrozen(fresh)).toBe(true);
    expect(Object.isFrozen(after)).toBe(true);
  });

  it('take a deep-frozen session without throwing', () => {
    const frozen = deepFreeze({ sessionNoticed: false });
    expect(noted(frozen)).toEqual({ sessionNoticed: true });
    expect(noticeFor(frozen)).toBe('greeting');
    expect(frozen).toEqual({ sessionNoticed: false });
  });
});

describe('noticeText', () => {
  it("is the server's greeting, word for word, when Auto answers", () => {
    expect(AI_VOICE_GREETING).toBe('Hi, this is Auto, your AI assistant.');
    expect(noticeText()).toBe(AI_VOICE_GREETING);
    expect(noticeText(null)).toBe(AI_VOICE_GREETING);
    expect(DEFAULT_AGENT_NAME).toBe('Auto');
  });

  it('names the answering agent when it is not Auto, and changes nothing else', () => {
    expect(noticeText({ name: 'Research Bot' })).toBe(
      'Hi, this is Research Bot, your AI assistant.',
    );
    expect(noticeText({ name: '  Nova\n  Writer ' })).toBe(
      'Hi, this is Nova Writer, your AI assistant.',
    );
  });

  it('says the vendored UNNAMED_AGENT while a picked agent has no name yet', () => {
    expect(UNNAMED_AGENT).toBe('This agent');
    expect(noticeText({ name: null })).toBe('Hi, this is this agent, your AI assistant.');
    expect(noticeText({ name: '   ' })).toBe('Hi, this is this agent, your AI assistant.');
    expect(noticeText({})).toBe('Hi, this is this agent, your AI assistant.');
  });

  it('says a name holding replacement patterns as written', () => {
    expect(noticeText({ name: "$& $1 $' Bot" })).toBe(
      "Hi, this is $& $1 $' Bot, your AI assistant.",
    );
  });

  it('carries no reminder text (D73)', () => {
    const words = [noticeText(), noticeText({ name: 'Nova' }), noticeText({ name: null })];
    words.forEach((text) => expect(text).not.toMatch(/just so you know/i));
  });
});

describe('queueWithNotice', () => {
  it("queues the greeting before the first reply's first sentence and notes the session", () => {
    const session = newSession();
    const queued = queueWithNotice(session, ['Here is what I found.', 'First, coffee.']);
    expect(queued.speak).toEqual([AI_VOICE_GREETING, 'Here is what I found.', 'First, coffee.']);
    expect(queued.session.sessionNoticed).toBe(true);
    expect(session.sessionNoticed).toBe(false);
  });

  it("speaks the answering agent's name in the greeting", () => {
    const queued = queueWithNotice(newSession(), ['On it.'], { name: 'Nova' });
    expect(queued.speak).toEqual(['Hi, this is Nova, your AI assistant.', 'On it.']);
  });

  it('waits for the first sentence: an empty batch queues nothing and keeps the session', () => {
    const session = newSession();
    const empty = queueWithNotice(session, []);
    expect(empty.speak).toEqual([]);
    expect(empty.session).toBe(session);
    const next = queueWithNotice(empty.session, ['Ready.']);
    expect(next.speak).toEqual([AI_VOICE_GREETING, 'Ready.']);
  });

  it('greets once across the batches of one streaming reply', () => {
    const first = queueWithNotice(newSession(), ['One.']);
    const second = queueWithNotice(first.session, ['Two.', 'Three.']);
    const flushed = queueWithNotice(second.session, ['Four.']);
    expect([...first.speak, ...second.speak, ...flushed.speak]).toEqual([
      AI_VOICE_GREETING,
      'One.',
      'Two.',
      'Three.',
      'Four.',
    ]);
  });

  it('leaves the greeting for the next spoken reply when a turn spoke nothing', () => {
    const session = newSession();
    // The turn failed, or finished with a card only: noticeFor was shown, nothing was queued.
    expect(noticeFor(session)).toBe('greeting');
    expect(queueWithNotice(session, []).session.sessionNoticed).toBe(false);
    expect(reply(session, ['Back again.']).speak).toEqual([AI_VOICE_GREETING, 'Back again.']);
  });

  it('takes deep-frozen inputs and returns frozen values', () => {
    const session = deepFreeze(newSession());
    const sentences = deepFreeze(['Hello.']);
    const agent = deepFreeze({ name: 'Nova' });
    const queued = queueWithNotice(session, sentences, agent);
    expect(queued.speak).toEqual(['Hi, this is Nova, your AI assistant.', 'Hello.']);
    expect(queued.speak).not.toBe(sentences);
    expect(sentences).toEqual(['Hello.']);
    expect(Object.isFrozen(queued)).toBe(true);
    expect(Object.isFrozen(queued.speak)).toBe(true);
    const later = queueWithNotice(queued.session, sentences, agent);
    expect(later.speak).toEqual(['Hello.']);
    expect(later.speak).not.toBe(sentences);
  });
});
