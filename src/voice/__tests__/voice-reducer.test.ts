// The voice machine (US-019a, KV8): every row of the table; barge-in from thinking and speaking;
// micOpen as the capture truth (a hold without mic_open stays closed); stop and interrupted from each
// phase. Unavailable, permissions, retryable and not, and frozen inputs: voice-reducer-errors.test.ts.
// The config's named constants.

import { describe, expect, it } from 'vitest';

import { WAVE } from '../../styles/hud/core/waveform';
import {
  AI_NOTICE_INTERVAL_MS,
  HOLD_MAX_MS,
  HOLD_MIN_MS,
  SPEECH_RATE,
  STOP_PHRASES,
  THINKING_AFTER_MS,
  VOLUME_MAX,
  VOLUME_MIN,
  WAVEFORM_BARS,
} from '../config';
import { voiceReducer, type VoiceEvent } from '../machine/voice-reducer';
import { INITIAL_VOICE_STATE } from '../machine/voice-state';
import { AT, LISTENING, NOW, PHASES, SPEAKING, THINKING, run } from './voice-fixtures';

describe('the initial state and the config', () => {
  it('starts idle, quick-ask, the mic closed, nothing on screen, deep-frozen', () => {
    expect(INITIAL_VOICE_STATE).toEqual({
      phase: 'idle',
      mode: 'quick',
      micOpen: false,
      heard: '',
      reply: '',
      replyStreaming: false,
      replyFinished: false,
      toolCaption: null,
      notice: null,
      errorKind: null,
      turnFailure: null,
      message: null,
      holdStartedAt: null,
      bargedIn: false,
    });
    expect(Object.isFrozen(INITIAL_VOICE_STATE)).toBe(true);
    expect(
      Object.values(INITIAL_VOICE_STATE).every((v) => v === null || typeof v !== 'object'),
    ).toBe(true);
  });

  it('names every threshold the wave reads', () => {
    expect(HOLD_MIN_MS).toBe(300);
    expect(HOLD_MAX_MS).toBe(60_000);
    expect(AI_NOTICE_INTERVAL_MS).toBe(600_000);
    expect(THINKING_AFTER_MS).toBe(700);
    expect([VOLUME_MIN, VOLUME_MAX]).toEqual([-2, 10]);
    expect(SPEECH_RATE).toBe(1);
    expect(STOP_PHRASES).toEqual(['stop', 'auto stop', 'stop auto', 'stop it', 'cancel']);
    expect(Object.isFrozen(STOP_PHRASES)).toBe(true);
  });

  it("matches A5's phone waveform", () => {
    expect(WAVEFORM_BARS).toBe(44);
    expect(WAVEFORM_BARS).toBe(WAVE.phone.bars);
  });
});

describe('holding to talk', () => {
  it('idle → listening on hold_start, the clock from the event', () => {
    const next = voiceReducer(AT.idle, { type: 'hold_start', now: NOW });
    expect(next).toMatchObject({ phase: 'listening', holdStartedAt: NOW, bargedIn: false });
    expect(next.micOpen).toBe(false);
  });

  it('a second hold_start while listening changes nothing', () => {
    expect(voiceReducer(AT.listening, { type: 'hold_start', now: NOW + 5 })).toBe(AT.listening);
  });

  it('a new hold clears the last turn: its words, notice, hint and failure', () => {
    const done = run([...SPEAKING, { type: 'turn_finished' }, { type: 'speak_done' }]);
    expect(done).toMatchObject({
      phase: 'idle',
      reply: 'You have two meetings.',
      notice: 'greeting',
    });
    expect(voiceReducer(done, { type: 'hold_start', now: NOW + 1 })).toMatchObject({
      phase: 'listening',
      heard: '',
      reply: '',
      notice: null,
      replyFinished: false,
      message: null,
      holdStartedAt: NOW + 1,
    });
  });

  it('shows the partial words while listening, and only then', () => {
    expect(AT.listening.heard).toBe('what is');
    expect(voiceReducer(AT.listening, { type: 'partial', text: 'what is on' }).heard).toBe(
      'what is on',
    );
    for (const phase of ['idle', 'thinking', 'speaking', 'error'] as const) {
      expect(voiceReducer(AT[phase], { type: 'partial', text: 'late' })).toBe(AT[phase]);
    }
  });

  it('listening → thinking on a final with words (trimmed)', () => {
    const next = voiceReducer(AT.listening, { type: 'final', text: '  what is on today?  ' });
    expect(next).toMatchObject({
      phase: 'thinking',
      heard: 'what is on today?',
      holdStartedAt: null,
    });
  });

  it('a blank final is nothing heard: idle with the hint', () => {
    const next = voiceReducer(AT.listening, { type: 'final', text: ' \n ' });
    expect(next).toMatchObject({ phase: 'idle', heard: '', message: 'nothingHeard' });
  });

  it.each([
    ['hold_too_short', 'holdHint'],
    ['nothing_heard', 'nothingHeard'],
    ['stop_phrase', null],
  ] as const)('listening → idle on %s, nothing sent', (type, message) => {
    const next = voiceReducer(AT.listening, { type });
    expect(next).toMatchObject({ phase: 'idle', heard: '', message, holdStartedAt: null });
    expect(next.replyStreaming).toBe(false);
  });

  it.each(['hold_too_short', 'nothing_heard', 'stop_phrase', 'final'] as const)(
    '%s outside listening changes nothing',
    (type) => {
      const event = (type === 'final' ? { type, text: 'late' } : { type }) as VoiceEvent;
      for (const phase of ['idle', 'thinking', 'speaking', 'error'] as const) {
        expect(voiceReducer(AT[phase], event)).toBe(AT[phase]);
      }
    },
  );
});

describe('the turn', () => {
  it('sent marks the turn streaming, with the AI notice when given', () => {
    const thinking = run(THINKING.slice(0, -2));
    expect(thinking).toMatchObject({ phase: 'thinking', replyStreaming: false, notice: null });
    expect(voiceReducer(thinking, { type: 'sent', notice: 'greeting' })).toMatchObject({
      replyStreaming: true,
      notice: 'greeting',
    });
    expect(voiceReducer(thinking, { type: 'sent' }).notice).toBeNull();
  });

  it('sent counts once per turn, and only while thinking', () => {
    expect(voiceReducer(AT.thinking, { type: 'sent', notice: null })).toBe(AT.thinking);
    for (const phase of ['idle', 'listening', 'speaking', 'error'] as const) {
      expect(voiceReducer(AT[phase], { type: 'sent' })).toBe(AT[phase]);
    }
  });

  it.each(['thinking', 'speaking'] as const)(
    'turn_text and turn_tool update the reply in %s',
    (phase) => {
      const text = voiceReducer(AT[phase], {
        type: 'turn_text',
        text: 'You have two meetings. One',
      });
      expect(text).toMatchObject({ phase, reply: 'You have two meetings. One' });
      const tool = voiceReducer(text, { type: 'turn_tool', caption: 'Searching the web' });
      expect(tool).toMatchObject({ phase, toolCaption: 'Searching the web' });
      expect(voiceReducer(tool, { type: 'turn_tool', caption: null }).toolCaption).toBeNull();
    },
  );

  it.each(['idle', 'listening', 'error'] as const)(
    'turn_text and turn_tool are ignored in %s',
    (phase) => {
      expect(voiceReducer(AT[phase], { type: 'turn_text', text: 'stale' })).toBe(AT[phase]);
      expect(voiceReducer(AT[phase], { type: 'turn_tool', caption: 'stale' })).toBe(AT[phase]);
    },
  );

  it('thinking → speaking on speak_start; elsewhere it changes nothing', () => {
    expect(voiceReducer(AT.thinking, { type: 'speak_start' }).phase).toBe('speaking');
    expect(voiceReducer(AT.speaking, { type: 'speak_start' })).toBe(AT.speaking);
    for (const phase of ['idle', 'listening', 'error'] as const) {
      expect(voiceReducer(AT[phase], { type: 'speak_start' })).toBe(AT[phase]);
    }
  });

  it('speaking → idle on speak_done once the turn finished, the words kept', () => {
    const finished = voiceReducer(AT.speaking, { type: 'turn_finished' });
    expect(finished).toMatchObject({
      phase: 'speaking',
      replyStreaming: false,
      replyFinished: true,
    });
    expect(voiceReducer(finished, { type: 'speak_done' })).toMatchObject({
      phase: 'idle',
      heard: 'what is on today?',
      reply: 'You have two meetings.',
      replyStreaming: false,
    });
  });

  it('speak_done while the turn still streams is Auto working again: thinking', () => {
    const next = voiceReducer(AT.speaking, { type: 'speak_done' });
    expect(next).toMatchObject({ phase: 'thinking', replyStreaming: true });
    expect(voiceReducer(next, { type: 'speak_done' })).toBe(next);
  });

  it('speak_done in thinking after the turn finished ends it (nothing left to speak)', () => {
    const caughtUp = run([{ type: 'speak_done' }, { type: 'turn_finished' }], AT.speaking);
    expect(caughtUp).toMatchObject({ phase: 'thinking', replyFinished: true });
    expect(voiceReducer(caughtUp, { type: 'speak_done' }).phase).toBe('idle');
  });

  it('a turn that finished while thinking waits for its speech when it has words', () => {
    const next = voiceReducer(AT.thinking, { type: 'turn_finished' });
    expect(next).toMatchObject({ phase: 'thinking', replyFinished: true, toolCaption: null });
    expect(voiceReducer(next, { type: 'turn_finished' })).toBe(next);
  });

  it('a turn that finished with no words to speak is done: idle', () => {
    const silent = run(THINKING.slice(0, -1));
    expect(voiceReducer(silent, { type: 'turn_finished' })).toMatchObject({
      phase: 'idle',
      replyStreaming: false,
      replyFinished: true,
    });
  });

  it.each(['thinking', 'speaking'] as const)(
    'a failed turn in %s → error turn, retryable',
    (phase) => {
      const next = voiceReducer(AT[phase], { type: 'turn_failed', kind: 'network' });
      expect(next).toMatchObject({
        phase: 'error',
        errorKind: 'turn',
        turnFailure: 'network',
        replyStreaming: false,
        reply: 'You have two meetings.',
      });
      expect(voiceReducer(next, { type: 'hold_start', now: NOW }).phase).toBe('listening');
    },
  );

  it.each(['turn_finished', 'speak_done'] as const)(
    '%s outside a reply changes nothing',
    (type) => {
      for (const phase of ['idle', 'listening', 'error'] as const) {
        expect(voiceReducer(AT[phase], { type })).toBe(AT[phase]);
      }
      expect(voiceReducer(AT.idle, { type: 'turn_failed', kind: 'turn' })).toBe(AT.idle);
    },
  );
});

describe('barge-in (KV5)', () => {
  it.each(['thinking', 'speaking'] as const)(
    'hold_start in %s → listening with bargedIn',
    (phase) => {
      const next = voiceReducer(AT[phase], { type: 'hold_start', now: NOW + 9 });
      expect(next).toMatchObject({
        phase: 'listening',
        bargedIn: true,
        replyStreaming: false,
        reply: '',
        heard: '',
        holdStartedAt: NOW + 9,
      });
    },
  );

  it("the cancelled turn's late text and speech are ignored; the next final starts afresh", () => {
    const barged = voiceReducer(AT.speaking, { type: 'hold_start', now: NOW });
    expect(voiceReducer(barged, { type: 'turn_text', text: 'late' })).toBe(barged);
    expect(voiceReducer(barged, { type: 'speak_done' })).toBe(barged);
    expect(voiceReducer(barged, { type: 'final', text: 'and tomorrow?' })).toMatchObject({
      phase: 'thinking',
      bargedIn: false,
    });
  });
});

describe('MIC LIVE is the capture truth (KV5)', () => {
  it('a hold without mic_open keeps the mic closed', () => {
    expect(voiceReducer(AT.idle, { type: 'hold_start', now: NOW }).micOpen).toBe(false);
  });

  it('opens on mic_open and closes on mic_closed, whatever the phase', () => {
    for (const phase of PHASES) {
      const open = voiceReducer(AT[phase], { type: 'mic_open' });
      expect(open.micOpen).toBe(true);
      expect(open.phase).toBe(AT[phase].phase);
      expect(voiceReducer(open, { type: 'mic_closed' }).micOpen).toBe(false);
    }
  });

  it('stays open from the release to the recognizer’s audioend', () => {
    const released = run([...LISTENING, { type: 'final', text: 'hello' }]);
    expect(released).toMatchObject({ phase: 'thinking', micOpen: true });
    expect(voiceReducer(released, { type: 'mic_closed' }).micOpen).toBe(false);
  });

  it('a repeated mic event changes nothing', () => {
    expect(voiceReducer(AT.listening, { type: 'mic_open' })).toBe(AT.listening);
    expect(voiceReducer(AT.idle, { type: 'mic_closed' })).toBe(AT.idle);
  });
});

describe('stop and interruptions from every phase', () => {
  it.each(PHASES)('stop in %s → idle, the mic and the stream off, the words kept', (phase) => {
    const from = voiceReducer(AT[phase], { type: 'mic_open' });
    const next = voiceReducer(from, { type: 'stop' });
    expect(next).toMatchObject({
      phase: 'idle',
      micOpen: false,
      replyStreaming: false,
      toolCaption: null,
      holdStartedAt: null,
      bargedIn: false,
      errorKind: null,
      heard: from.heard,
      reply: from.reply,
    });
  });

  it.each(PHASES)('interrupted in %s → idle with its message, the words kept un-sent', (phase) => {
    const from = voiceReducer(AT[phase], { type: 'mic_open' });
    const next = voiceReducer(from, { type: 'interrupted', reason: 'audio-session' });
    expect(next).toMatchObject({
      phase: 'idle',
      micOpen: false,
      replyStreaming: false,
      message: 'interrupted',
      heard: from.heard,
      reply: from.reply,
    });
  });

  it.each([
    ['audio-session', 'interrupted'],
    ['route-change', 'micChanged'],
    ['background', 'interrupted'],
  ] as const)('an interruption by %s says %s', (reason, message) => {
    expect(voiceReducer(AT.listening, { type: 'interrupted', reason }).message).toBe(message);
  });

  it('a stop at rest changes nothing', () => {
    expect(voiceReducer(AT.idle, { type: 'stop' })).toBe(AT.idle);
  });
});
