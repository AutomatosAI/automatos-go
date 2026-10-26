// The voice screen's view-model (US-019i, KV8): every word and switch from the one reducer's
// states (reached through the reducer itself), the last press's permission verdict and recognition
// policy: each phase, barge-in, MIC LIVE only with micOpen, the chip's words, screen-reader labels,
// a viewer, the AI label off screen (no fence, D73), the AI notice line and 'See it in the chat'.
// The blocks (unavailable, the download offer, the permission steps) are voice-view-blocks.test.ts.

import { describe, expect, it } from 'vitest';

import { API_ERROR_COPY } from '../../api/strings';
import { ROLE_COPY } from '../../auth/strings';
import { TURN_ERROR_COPY } from '../../chat/strings';
import { voiceReducer, type VoiceEvent } from '../machine/voice-reducer';
import { INITIAL_VOICE_STATE } from '../machine/voice-state';
import { voiceView } from '../screen/voice-view-model';
import {
  AI_VOICE_GREETING,
  SEE_IN_CHAT,
  VOICE_CENTRE_COPY,
  VOICE_CHIP,
  VOICE_MESSAGE_COPY,
} from '../strings';
import { AT, LISTENING, NOW, PHASES, SPEAKING, THINKING, run } from './voice-fixtures';
import { input, reply, view } from './voice-view-fixtures';

const FINISHED: readonly VoiceEvent[] = [...SPEAKING, { type: 'turn_finished' }];
const DONE: readonly VoiceEvent[] = [...FINISHED, { type: 'speak_done' }];

describe('voiceView per phase', () => {
  it('at rest: READY, the mic off, HOLD TO TALK and TYPE on, STOP off, no line', () => {
    const at = view({ mascotState: 'sleeping' });
    expect(at).toMatchObject({
      chipWords: 'READY',
      chipLabel: 'Ready',
      mic: 'off',
      mascot: 'sleeping',
      transcript: { you: null, auto: null, autoStreaming: false, notice: null },
      centre: { label: 'HOLD TO TALK', accessibilityLabel: 'Hold to talk', enabled: true },
      type: { enabled: true },
      stop: { enabled: false },
      message: null,
    });
    expect(at.centre.hint).toBe(VOICE_CENTRE_COPY.hold.talk.hint);
    expect(Object.isFrozen(at)).toBe(true);
  });

  it('listening: LISTENING, RELEASE TO SEND, STOP on; the mic and Auto wait for audiostart', () => {
    const pressed = view({ state: run([{ type: 'hold_start', now: NOW }]), mascotState: 'idle' });
    expect(pressed).toMatchObject({
      chipWords: 'LISTENING',
      mic: 'off',
      mascot: 'idle',
      centre: { label: 'RELEASE TO SEND', accessibilityLabel: 'Release to send', enabled: true },
      stop: { enabled: true },
    });
    const open = view({ state: AT.listening, mascotState: 'idle' });
    expect(open).toMatchObject({ mic: 'live', mascot: 'listening' });
    expect(open.transcript).toMatchObject({ you: 'what is', auto: null });
  });

  it('thinking: the words both ways, the cursor, the AI notice line, STOP on', () => {
    const at = view({ state: AT.thinking, mascotState: 'thinking' });
    expect(at).toMatchObject({
      chipWords: 'THINKING',
      mic: 'off',
      mascot: 'thinking',
      centre: { label: 'HOLD TO TALK', enabled: true },
      stop: { enabled: true },
      message: null,
    });
    expect(at.transcript).toEqual({
      you: 'what is on today?',
      auto: 'You have two meetings.',
      autoStreaming: true,
      notice: AI_VOICE_GREETING,
    });
  });

  it("a running tool's caption is the chip while Auto thinks, in capitals", () => {
    const state = run([...THINKING, { type: 'turn_tool', caption: 'Searching the web' }]);
    expect(view({ state })).toMatchObject({
      chipWords: 'SEARCHING THE WEB',
      chipLabel: 'Searching the web',
    });
  });

  it('speaking: SPEAKING, even while a tool runs', () => {
    expect(view({ state: AT.speaking }).chipWords).toBe('SPEAKING');
    const state = run([...SPEAKING, { type: 'turn_tool', caption: 'Reading' }]);
    expect(view({ state }).chipWords).toBe('SPEAKING');
  });

  it('done: READY again, the words kept, the cursor gone, STOP off', () => {
    const at = view({ state: run(DONE) });
    expect(at).toMatchObject({ chipWords: 'READY', stop: { enabled: false }, message: null });
    expect(at.transcript).toMatchObject({
      you: 'what is on today?',
      auto: 'You have two meetings.',
      autoStreaming: false,
    });
  });

  it('barge-in: a hold while Auto speaks listens at once, his words cleared', () => {
    const barged = run([{ type: 'hold_start', now: NOW + 5_000 }], AT.speaking);
    expect(barged.bargedIn).toBe(true);
    const at = view({ state: barged, mascotState: 'thinking' });
    expect(at).toMatchObject({
      chipWords: 'LISTENING',
      mic: 'off',
      mascot: 'thinking',
      centre: { label: 'RELEASE TO SEND' },
      stop: { enabled: true },
      transcript: { you: null, auto: null, autoStreaming: false, notice: null },
    });
    expect(view({ state: run([{ type: 'mic_open' }], barged) }).mic).toBe('live');
  });

  it('the AI notice names the answering agent when it is not Auto', () => {
    const at = view({ state: AT.thinking, reply: reply({ agentName: 'Researcher' }) });
    expect(at.transcript.notice).toBe('Hi, this is Researcher, your AI assistant.');
    expect(view({ state: AT.thinking, reply: reply() }).transcript.notice).toBe(AI_VOICE_GREETING);
  });
});

describe('MIC LIVE only with micOpen (KV5)', () => {
  it('follows the capture through a hold, never the phase or the button', () => {
    const events: readonly VoiceEvent[] = [
      { type: 'hold_start', now: NOW },
      { type: 'mic_open' },
      { type: 'partial', text: 'what' },
      { type: 'final', text: 'what is on' },
      { type: 'mic_closed' },
      { type: 'sent', notice: null },
      { type: 'speak_start' },
    ];
    const states = events.reduce(
      (seen, event) => [...seen, voiceReducer(seen[seen.length - 1] ?? INITIAL_VOICE_STATE, event)],
      [INITIAL_VOICE_STATE],
    );
    const mics = states.map((state) => view({ state }).mic);
    expect(mics).toEqual(['off', 'off', 'live', 'live', 'live', 'off', 'off', 'off']);
    // The final came before audioend: thinking, and the mic still open says so.
    expect(view({ state: states[4], mascotState: 'thinking' })).toMatchObject({
      chipWords: 'LISTENING',
      mascot: 'listening',
    });
  });

  it('every phase: live exactly when the state says micOpen', () => {
    PHASES.forEach((phase) => {
      const state = AT[phase];
      expect(view({ state }).mic).toBe(state.micOpen ? 'live' : 'off');
    });
    expect(view({ state: run([{ type: 'stop' }], AT.listening) }).mic).toBe('off');
  });
});

describe('STOP and TYPE', () => {
  it('STOP is on while listening, thinking or speaking, and off otherwise', () => {
    const on = PHASES.filter((phase) => view({ state: AT[phase] }).stop.enabled);
    expect(on).toEqual(['listening', 'thinking', 'speaking']);
  });

  it('TYPE stays on in every phase for someone who may chat', () => {
    PHASES.forEach((phase) => expect(view({ state: AT[phase] }).type.enabled).toBe(true));
  });
});

describe('a screen reader (KV5)', () => {
  it('HOLD TO TALK toggles: TAP TO TALK, then TAP TO SEND, and the hint says so', () => {
    const idle = view({ screenReader: true });
    expect(idle.centre).toEqual({
      label: 'TAP TO TALK',
      accessibilityLabel: 'Tap to talk',
      enabled: true,
      hint: VOICE_CENTRE_COPY.toggle.talk.hint,
      toggle: true,
    });
    const listening = view({ screenReader: true, state: AT.listening });
    expect(listening.centre).toMatchObject({
      label: 'TAP TO SEND',
      accessibilityLabel: 'Tap to send',
      hint: VOICE_CENTRE_COPY.toggle.send.hint,
    });
    expect(view().centre.toggle).toBe(false);
    expect(view({ state: AT.listening }).centre.hint).toBe(VOICE_CENTRE_COPY.hold.send.hint);
  });
});

describe('a viewer (D17)', () => {
  it('no voice and no typing: VOICE UNAVAILABLE and the owner line', () => {
    const at = view({ roleCanChat: false });
    expect(at).toMatchObject({
      chipWords: 'VOICE UNAVAILABLE',
      centre: { enabled: false, hint: ROLE_COPY.viewerReadOnly },
      type: { enabled: false },
      stop: { enabled: false },
      message: { kind: 'viewer', text: ROLE_COPY.viewerReadOnly, action: null },
    });
  });

  it("the viewer's line comes before a permission or the language", () => {
    const blocked = { step: 'settings', blocked: 'microphone', asked: false } as const;
    const policy = { kind: 'download', locale: 'en-GB' } as const;
    const at = view({ roleCanChat: false, permission: blocked, policy });
    expect(at.message?.kind).toBe('viewer');
  });
});

describe('the AI label is not an input (D73)', () => {
  it('with the label off screen, nothing waits on it: HOLD TO TALK and TYPE stay on', () => {
    const plain = input();
    const labelOff = { ...plain, aiLabelVisible: false, aiLabelOnScreen: false };
    expect(voiceView(labelOff)).toEqual(voiceView(plain));
    expect(voiceView(labelOff)).toMatchObject({
      centre: { enabled: true },
      type: { enabled: true },
      message: null,
    });
  });
});

describe('the reducer messages', () => {
  it('a tap, nothing heard, a first grant and the interruptions each say their line', () => {
    const cases: readonly [VoiceEvent, keyof typeof VOICE_MESSAGE_COPY][] = [
      [{ type: 'hold_too_short' }, 'holdHint'],
      [{ type: 'nothing_heard' }, 'nothingHeard'],
      [{ type: 'interrupted', reason: 'audio-session' }, 'interrupted'],
      [{ type: 'interrupted', reason: 'route-change' }, 'micChanged'],
    ];
    cases.forEach(([event, key]) => {
      const at = view({ state: run([...LISTENING, { type: 'mic_closed' }, event]) });
      expect(at.message).toEqual({ kind: 'hint', text: VOICE_MESSAGE_COPY[key], action: null });
      expect(at.chipWords).toBe('READY');
    });
    // Until audioend the capture is still on, and the chip says so with MIC LIVE.
    const capturing = view({ state: run([...LISTENING, { type: 'hold_too_short' }]) });
    expect(capturing).toMatchObject({ chipWords: 'LISTENING', mic: 'live' });
    const granted = run([{ type: 'permission', step: 'granted' }]);
    expect(view({ state: granted }).message?.text).toBe(VOICE_MESSAGE_COPY.ready);
  });
});

describe("'See it in the chat' (KV6)", () => {
  const withCards = reply({ hasCards: true });

  it('shows while the turn with cards or receipts is on screen, with the chat to open', () => {
    const line = { kind: 'chat', text: SEE_IN_CHAT, action: 'openChat' };
    expect(view({ state: AT.thinking, reply: withCards }).message).toEqual(line);
    expect(view({ state: run(DONE), reply: reply({ hasReceipts: true }) }).message).toEqual(line);
  });

  it('not for a reply with neither, a new hold, or a turn stopped before it finished', () => {
    expect(view({ state: run(DONE), reply: reply() }).message).toBeNull();
    expect(view({ state: AT.listening, reply: withCards }).message).toBeNull();
    expect(view({ state: AT.idle, reply: withCards }).message).toBeNull();
    const stopped = run([{ type: 'stop' }], AT.thinking);
    expect(view({ state: stopped, reply: withCards }).message).toBeNull();
  });

  it("an interruption's line comes first", () => {
    const state = run([{ type: 'interrupted', reason: 'background' }], run(FINISHED));
    const at = view({ state, reply: withCards });
    expect(at.message?.text).toBe(VOICE_MESSAGE_COPY.interrupted);
  });
});

describe('a failed turn', () => {
  const failed = (kind: 'turn' | 'network') => run([...THINKING, { type: 'turn_failed', kind }]);

  it("ERROR and A2's own words for the failure", () => {
    const at = view({ state: failed('turn'), failure: { kind: 'turn', code: 'no_api_key' } });
    expect(at).toMatchObject({
      chipWords: VOICE_CHIP.error.words,
      stop: { enabled: false },
      centre: { enabled: true },
      message: { kind: 'error', text: TURN_ERROR_COPY.no_api_key.text, action: null },
    });
  });

  it('without the thread failure, the kind says it; a failure of another kind is ignored', () => {
    expect(view({ state: failed('turn') }).message?.text).toBe(TURN_ERROR_COPY.turn_failed.text);
    expect(view({ state: failed('network') }).message?.text).toBe(API_ERROR_COPY.network);
    const other = { kind: 'turn', code: 'no_api_key' } as const;
    expect(view({ state: failed('network'), failure: other }).message?.text).toBe(
      API_ERROR_COPY.network,
    );
  });
});
