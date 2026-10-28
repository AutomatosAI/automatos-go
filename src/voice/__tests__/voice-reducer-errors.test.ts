// The voice machine's refusals (US-019a, KV8): unavailable, a denied permission and a recognizer
// failure → error with its kind, a reply under way left alone; retryable kinds let the next hold
// start, the others wait for the phone or the permission to change; reset; deep-frozen inputs never
// throw and an unknown event returns the same state object.

import { describe, expect, it } from 'vitest';

import { voiceReducer, type VoiceEvent } from '../machine/voice-reducer';
import { INITIAL_VOICE_STATE, isRetryable, type VoiceErrorKind } from '../machine/voice-state';
import { AT, NOW, PHASES, deepFreeze } from './voice-fixtures';

describe('unavailable, permissions and recognizer failures', () => {
  it.each(['idle', 'listening', 'error'] as const)(
    'unavailable in %s → error with its reason',
    (phase) => {
      expect(
        voiceReducer(AT[phase], { type: 'unavailable', reason: 'android-too-old' }),
      ).toMatchObject({
        phase: 'error',
        errorKind: 'android-too-old',
        holdStartedAt: null,
      });
    },
  );

  it.each(['thinking', 'speaking'] as const)(
    'a press that cannot start leaves %s alone',
    (phase) => {
      expect(voiceReducer(AT[phase], { type: 'unavailable', reason: 'no-on-device' })).toBe(
        AT[phase],
      );
      expect(voiceReducer(AT[phase], { type: 'permission', step: 'settings' })).toBe(AT[phase]);
      expect(voiceReducer(AT[phase], { type: 'permission', step: 'granted' })).toBe(AT[phase]);
    },
  );

  it.each([
    ['settings', 'permission-settings'],
    ['restricted', 'permission-restricted'],
  ] as const)('a %s permission → error %s', (step, errorKind) => {
    expect(voiceReducer(AT.idle, { type: 'permission', step })).toMatchObject({
      phase: 'error',
      errorKind,
    });
  });

  it('a first-time grant is not speech: idle, ready to hold', () => {
    expect(voiceReducer(AT.listening, { type: 'permission', step: 'granted' })).toMatchObject({
      phase: 'idle',
      heard: '',
      message: 'ready',
      holdStartedAt: null,
    });
    expect(voiceReducer(AT.idle, { type: 'permission', step: 'ask' })).toBe(AT.idle);
  });

  it('a recognizer failure while listening → error with its kind; a late one is ignored', () => {
    expect(voiceReducer(AT.listening, { type: 'error', kind: 'mic-busy' })).toMatchObject({
      phase: 'error',
      errorKind: 'mic-busy',
    });
    for (const phase of ['idle', 'thinking', 'speaking', 'error'] as const) {
      expect(voiceReducer(AT[phase], { type: 'error', kind: 'recognizer' })).toBe(AT[phase]);
    }
  });
});

describe('retryable or not', () => {
  const RETRYABLE: readonly VoiceErrorKind[] = ['mic-busy', 'busy', 'recognizer', 'turn'];
  const NOT: readonly VoiceErrorKind[] = [
    'no-on-device',
    'android-too-old',
    'language-missing',
    'no-recognizer',
    'permission-settings',
    'permission-restricted',
  ];

  it.each(RETRYABLE)('error %s → listening on the next hold', (errorKind) => {
    expect(isRetryable(errorKind)).toBe(true);
    const error = deepFreeze({ ...INITIAL_VOICE_STATE, phase: 'error' as const, errorKind });
    expect(voiceReducer(error, { type: 'hold_start', now: NOW })).toMatchObject({
      phase: 'listening',
      errorKind: null,
      bargedIn: false,
    });
  });

  it.each(NOT)('error %s waits for the phone or the permission to change', (errorKind) => {
    expect(isRetryable(errorKind)).toBe(false);
    const error = deepFreeze({ ...INITIAL_VOICE_STATE, phase: 'error' as const, errorKind });
    expect(voiceReducer(error, { type: 'hold_start', now: NOW })).toBe(error);
    expect(voiceReducer(error, { type: 'reset' })).toBe(INITIAL_VOICE_STATE);
  });

  it('no kind is not retryable', () => {
    expect(isRetryable(null)).toBe(false);
  });
});

describe('a turn whose read broke runs on (28 Oct 2026)', () => {
  it('error turn → thinking on turn_resumed, the words to come; nothing else resumes', () => {
    const broke = voiceReducer(AT.thinking, { type: 'turn_failed', kind: 'network' });
    expect(broke).toMatchObject({ phase: 'error', errorKind: 'turn', turnFailure: 'network' });
    expect(voiceReducer(broke, { type: 'turn_resumed' })).toMatchObject({
      phase: 'thinking',
      replyStreaming: true,
      replyFinished: false,
      errorKind: null,
      turnFailure: null,
    });
    for (const phase of PHASES.filter((name) => name !== 'error')) {
      expect(voiceReducer(AT[phase], { type: 'turn_resumed' })).toBe(AT[phase]);
    }
    const refused = voiceReducer(AT.idle, { type: 'unavailable', reason: 'no-recognizer' });
    expect(voiceReducer(refused, { type: 'turn_resumed' })).toBe(refused);
  });
});

describe('reset and immutability', () => {
  it('reset returns the initial state, and never closes a mic still open', () => {
    expect(voiceReducer(AT.speaking, { type: 'reset' })).toBe(INITIAL_VOICE_STATE);
    const open = voiceReducer(AT.listening, { type: 'reset' });
    expect(open).toEqual({ ...INITIAL_VOICE_STATE, micOpen: true });
  });

  const EVERY_EVENT: readonly VoiceEvent[] = [
    { type: 'hold_start', now: NOW },
    { type: 'mic_open' },
    { type: 'partial', text: 'p' },
    { type: 'mic_closed' },
    { type: 'final', text: 'f' },
    { type: 'hold_too_short' },
    { type: 'nothing_heard' },
    { type: 'stop_phrase' },
    { type: 'sent', notice: 'greeting' },
    { type: 'turn_text', text: 't' },
    { type: 'turn_tool', caption: 'c' },
    { type: 'turn_finished' },
    { type: 'turn_failed', kind: 'server' },
    { type: 'turn_resumed' },
    { type: 'speak_start' },
    { type: 'speak_done' },
    { type: 'stop' },
    { type: 'error', kind: 'busy' },
    { type: 'unavailable', reason: 'no-recognizer' },
    { type: 'permission', step: 'restricted' },
    { type: 'interrupted', reason: 'background' },
    { type: 'reset' },
  ];

  it('every event on every deep-frozen phase returns without throwing or mutating', () => {
    for (const phase of PHASES) {
      const before = JSON.stringify(AT[phase]);
      for (const event of EVERY_EVENT) {
        expect(() => voiceReducer(AT[phase], deepFreeze({ ...event }))).not.toThrow();
      }
      expect(JSON.stringify(AT[phase])).toBe(before);
    }
  });

  it('an unknown event returns the same state object', () => {
    const unknown = { type: 'live_connected' } as unknown as VoiceEvent;
    for (const phase of PHASES) {
      expect(voiceReducer(AT[phase], unknown)).toBe(AT[phase]);
    }
    expect(voiceReducer(AT.idle, { type: 'toString' } as unknown as VoiceEvent)).toBe(AT.idle);
  });
});
