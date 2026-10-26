// Quick-ask on HUD's home (US-019k), pure: which turn the transcript shows (the voice's from a press
// until a typed send, the thread's otherwise and after a press that heard nothing, the thread's clock
// and agent once the voice's turn is sent), when the voice's chip and line stand in for the home's
// own, which lines have no place here (a viewer's, 'See it in the chat'), MIC LIVE, HOLD TO TALK and
// STOP. Views come from the real reducer and voiceView (voice-view-fixtures.ts).

import { describe, expect, it, vi } from 'vitest';

import { ROLE_COPY } from '../../auth/strings';
import type { HudTurn } from '../../styles/hud/core/model';
import type { VoiceState } from '../machine/voice-state';
import {
  homeLine,
  homeTurn,
  hudHomeVoice,
  stopsThread,
  voiceWorks,
  type HudHomeVoiceInput,
} from '../home/hud-home-voice';
import { noticeText } from '../notice/ai-notice';
import type { QuickAskReply } from '../quick-ask/reply-text';
import { talkProps, voiceChip, type HoldHandlers } from '../screen/core-props';
import type { VoiceViewInput } from '../screen/voice-view-model';
import { PERMISSION_COPY, VOICE_CHIP, VOICE_MESSAGE_COPY } from '../strings';
import { AT, LISTENING, NOW, PHASES, SPEAKING, deepFreeze, run } from './voice-fixtures';
import { reply as replyOf, view as viewOf } from './voice-view-fixtures';

const T0 = NOW - 5_000;
const T1 = NOW - 2_000;

/** The home's own turn before any voice: the newest saved exchange. */
const SAVED: HudTurn = deepFreeze({
  you: 'Hi',
  auto: 'Morning.',
  streaming: false,
  startedAt: T0,
  endedAt: T1,
});

/** The home's own turn once the voice's words went through the thread. */
const SENT: HudTurn = deepFreeze({
  you: 'what is on today?',
  auto: 'You have two',
  streaming: true,
  agent: { name: 'Researcher' },
  startedAt: NOW,
  endedAt: null,
});

const FINISHED = run([...SPEAKING, { type: 'turn_finished' }, { type: 'speak_done' }]);
const TAPPED = run([{ type: 'hold_start', now: NOW }, { type: 'hold_too_short' }]);
const DENIED = run([
  { type: 'hold_start', now: NOW },
  { type: 'permission', step: 'settings' },
]);
const SETTINGS = { step: 'settings', blocked: 'microphone', asked: false } as const;

function hold(): HoldHandlers {
  return { onPressIn: vi.fn(), onPressOut: vi.fn(), onToggle: vi.fn() };
}

type Case = Partial<Omit<HudHomeVoiceInput, 'view' | 'state'>> & {
  readonly state?: VoiceState;
  readonly viewInput?: Partial<VoiceViewInput>;
};

function input({ state = AT.idle, viewInput = {}, reply = null, ...rest }: Case = {}) {
  return {
    view: viewOf({ state, reply, ...viewInput }),
    state,
    reply,
    threadTurn: SAVED,
    shows: 'voice',
    threadStreams: false,
    hold: hold(),
    replyId: null,
    ...rest,
  } satisfies HudHomeVoiceInput;
}

describe('homeTurn', () => {
  it("is the thread's turn until a press, whatever the voice holds", () => {
    PHASES.forEach((phase) =>
      expect(homeTurn(input({ state: AT[phase], shows: 'thread' }))).toBe(SAVED),
    );
  });

  it('while the mic is held: the words as they are heard, no reply and no clock yet', () => {
    expect(homeTurn(input({ state: AT.listening }))).toEqual({
      you: 'what is',
      auto: null,
      streaming: false,
      autoMessageId: null,
      agent: null,
    });
  });

  it("a press that heard nothing (a tap, a refusal) leaves the thread's turn on screen", () => {
    expect(homeTurn(input({ state: TAPPED }))).toBe(SAVED);
    expect(homeTurn(input({ state: DENIED, viewInput: { permission: SETTINGS } }))).toBe(SAVED);
    expect(homeTurn(input({ state: run(LISTENING.slice(0, 2)) }))).toBe(SAVED);
  });

  it("once sent: the voice's words with the AI notice above Auto's, the thread's clock and agent", () => {
    expect(homeTurn(input({ state: AT.thinking, threadTurn: SENT }))).toEqual({
      you: 'what is on today?',
      auto: `${noticeText(null)}\nYou have two meetings.`,
      streaming: true,
      autoMessageId: null,
      agent: { name: 'Researcher' },
      startedAt: NOW,
      endedAt: null,
    });
  });

  it('the agent quick-ask heard name wins over the thread’s', () => {
    const named: QuickAskReply = replyOf({ agentName: 'Scout', streaming: true, finished: false });
    const turn = homeTurn(input({ state: AT.speaking, threadTurn: SENT, reply: named }));
    expect(turn.agent).toEqual({ name: 'Scout' });
    expect(turn.auto).toBe(`${noticeText({ name: 'Scout' })}\nYou have two meetings.`);
  });

  it('after the speech ends the voice’s turn stays, notice and all, with its clock', () => {
    const saved: HudTurn = {
      ...SENT,
      auto: 'You have two meetings.',
      streaming: false,
      endedAt: T1,
    };
    expect(homeTurn(input({ state: FINISHED, threadTurn: saved }))).toEqual({
      ...saved,
      auto: `${noticeText(null)}\nYou have two meetings.`,
      autoMessageId: null,
      agent: { name: 'Researcher' },
    });
  });

  it("a typed send hands the transcript back to the thread's turn", () => {
    expect(homeTurn(input({ state: FINISHED, shows: 'thread', threadTurn: SENT }))).toBe(SENT);
  });

  it("Report this names the voice's own saved reply, never the thread turn's (P001R-AF-1)", () => {
    const thread: HudTurn = { ...SENT, streaming: false, endedAt: T1, autoMessageId: 'm-9' };
    const shown = (changes: Case) =>
      homeTurn(input({ state: FINISHED, threadTurn: thread, ...changes }));
    expect(shown({ replyId: 'm-3' }).autoMessageId).toBe('m-3');
    expect(shown({ replyId: null }).autoMessageId).toBeNull();
    expect(shown({ state: AT.speaking, replyId: 'm-3' }).autoMessageId).toBeNull();
    expect(shown({ shows: 'thread', replyId: 'm-3' }).autoMessageId).toBe('m-9');
    const home = hudHomeVoice(input({ state: FINISHED, threadTurn: thread, replyId: 'm-3' }));
    expect(home.turn.autoMessageId).toBe('m-3');
  });
});

describe('the chip and the line', () => {
  it("are the home's own while the voice is quiet", () => {
    const shown = hudHomeVoice(input());
    expect(shown.chip).toBeUndefined();
    expect(shown.line).toBeNull();
  });

  it("are the voice's while it works, after a typed send too", () => {
    for (const state of [AT.listening, AT.thinking, AT.speaking]) {
      const shown = hudHomeVoice(input({ state }));
      expect(shown.chip).toEqual(voiceChip(viewOf({ state })));
      expect(hudHomeVoice(input({ state, shows: 'thread' })).chip).toEqual(shown.chip);
    }
    expect(hudHomeVoice(input({ state: AT.speaking })).chip).toEqual({
      text: VOICE_CHIP.speaking.words,
      label: VOICE_CHIP.speaking.label,
    });
  });

  it('say why a press could not start: MIC OFF and Open Settings', () => {
    const shown = hudHomeVoice(input({ state: DENIED, viewInput: { permission: SETTINGS } }));
    expect(shown.chip).toEqual({ text: VOICE_CHIP.micOff.words, label: VOICE_CHIP.micOff.label });
    expect(shown.line?.button).toEqual({
      label: PERMISSION_COPY.openSettings,
      action: 'openSettings',
    });
  });

  it('give the hint for a tap: hold while you talk, READY on the chip', () => {
    const shown = hudHomeVoice(input({ state: TAPPED }));
    expect(shown.line).toEqual({ kind: 'hint', text: VOICE_MESSAGE_COPY.holdHint, button: null });
    expect(shown.chip?.text).toBe(VOICE_CHIP.ready.words);
  });

  it("give way to the home's own once a typed send is the newest", () => {
    const shown = hudHomeVoice(
      input({ state: DENIED, viewInput: { permission: SETTINGS }, shows: 'thread' }),
    );
    expect(shown.chip).toBeUndefined();
    expect(shown.line).toBeNull();
  });

  it("never say a viewer's words or 'See it in the chat' here", () => {
    const viewer = viewOf({ roleCanChat: false });
    expect(viewer.message?.kind).toBe('viewer');
    expect(homeLine(viewer)).toBeNull();
    expect(hudHomeVoice(input({ viewInput: { roleCanChat: false } })).chip).toBeUndefined();
    const cards = replyOf({ hasCards: true });
    const chat = viewOf({ state: FINISHED, reply: cards });
    expect(chat.message?.kind).toBe('chat');
    expect(homeLine(chat)).toBeNull();
    expect(hudHomeVoice(input({ state: FINISHED, reply: cards })).chip).toBeUndefined();
  });
});

describe('MIC LIVE, HOLD TO TALK and STOP', () => {
  it('MIC LIVE is the capture, never the phase (KV5)', () => {
    expect(hudHomeVoice(input({ state: AT.listening })).micOpen).toBe(true);
    expect(hudHomeVoice(input({ state: run(LISTENING.slice(0, 1)) })).micOpen).toBe(false);
    expect(hudHomeVoice(input({ state: AT.speaking })).micOpen).toBe(false);
  });

  it("HOLD TO TALK is the voice screen's: its words, its hold, its toggle", () => {
    const handlers = hold();
    const viewInput = { screenReader: true };
    const shown = hudHomeVoice(input({ state: AT.listening, viewInput, hold: handlers }));
    expect(shown.talk).toEqual(
      talkProps(viewOf({ state: AT.listening, ...viewInput }), 'listening', handlers),
    );
    expect(shown.talk.toggle).toBe(true);
    expect(shown.talk.onPressIn).toBe(handlers.onPressIn);
  });

  it('is off for a viewer, saying why (D-ROLES)', () => {
    const talk = hudHomeVoice(input({ viewInput: { roleCanChat: false } })).talk;
    expect(talk.enabled).toBe(false);
    expect(talk.hint).toBe(ROLE_COPY.viewerReadOnly);
  });

  it('STOP is on while the voice works or a typed turn streams', () => {
    expect(hudHomeVoice(input()).stopEnabled).toBe(false);
    expect(hudHomeVoice(input({ threadStreams: true })).stopEnabled).toBe(true);
    for (const state of [AT.listening, AT.thinking, AT.speaking])
      expect(hudHomeVoice(input({ state })).stopEnabled).toBe(true);
    expect(hudHomeVoice(input({ state: FINISHED })).stopEnabled).toBe(false);
  });

  it("STOP leaves A2's Stop to quick-ask while its own turn streams, and calls it otherwise", () => {
    expect(AT.thinking.replyStreaming).toBe(true);
    expect(stopsThread(AT.thinking)).toBe(false);
    expect(stopsThread(AT.speaking)).toBe(false);
    [AT.idle, AT.listening, AT.error, FINISHED].forEach((state) =>
      expect(stopsThread(state)).toBe(true),
    );
  });

  it('the voice works while the mic is open or Auto has its turn', () => {
    expect(voiceWorks(AT.idle)).toBe(false);
    expect(voiceWorks(run([{ type: 'mic_open' }]))).toBe(true);
    const failed = run([...LISTENING, { type: 'mic_closed' }, { type: 'error', kind: 'busy' }]);
    expect(failed.phase).toBe('error');
    expect(voiceWorks(failed)).toBe(false);
    expect(voiceWorks(FINISHED)).toBe(false);
  });

  it('returns a frozen view', () => {
    expect(Object.isFrozen(hudHomeVoice(input({ state: AT.thinking })))).toBe(true);
  });
});
