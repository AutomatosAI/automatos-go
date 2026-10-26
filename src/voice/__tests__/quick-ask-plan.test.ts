// What a press and a release of HOLD TO TALK come to (US-019g, KV5): a viewer, a permission and the
// recognition policy block in that order; a press that starts stops the speech before the mic opens
// (barge-in), cancels the turn only while it streams, clears an error, then listens. A release is a
// tap, a stop phrase, nothing heard, or words to send.

import { describe, expect, it } from 'vitest';

import { HOLD_MIN_MS } from '../config';
import type { VoicePhase } from '../machine/voice-state';
import type { PermissionVerdict } from '../permissions/permission-flow';
import {
  isStartPlan,
  isTap,
  onPress,
  onRelease,
  type PressInput,
  type PressPlan,
  type PressStart,
} from '../quick-ask/quick-ask-plan';
import { onDeviceOptions, type RecognitionPolicy } from '../quick-ask/recognition-policy';

const READY: RecognitionPolicy = Object.freeze({
  kind: 'ready',
  options: onDeviceOptions('en-GB'),
});
const GRANTED: PermissionVerdict = Object.freeze({ step: 'granted', blocked: null, asked: false });

function input(changes: Partial<PressInput> = {}): PressInput {
  return {
    phase: 'idle',
    replyStreaming: false,
    roleCanChat: true,
    policy: READY,
    permission: GRANTED,
    ...changes,
  };
}

function started(plan: PressPlan): PressStart {
  if (!isStartPlan(plan)) throw new Error(`blocked: ${plan.blocked}`);
  return plan;
}

describe('onPress: what blocks a press', () => {
  it('a viewer never talks, whatever else stands (D17), and nothing on the screen changes', () => {
    const asked: PermissionVerdict = { step: 'ask', blocked: null, asked: true };
    const plan = onPress(input({ roleCanChat: false, permission: asked, phase: 'speaking' }));
    expect(plan).toEqual({ blocked: 'viewer', event: null });
  });

  it('a first-time grant takes the hold: ready, not speech (US-019c)', () => {
    const plan = onPress(input({ permission: { step: 'granted', blocked: null, asked: true } }));
    expect(plan).toEqual({ blocked: 'permission', event: { type: 'permission', step: 'granted' } });
  });

  it('a permission off in Settings, restricted, or still to ask blocks with its step', () => {
    for (const step of ['settings', 'restricted', 'ask'] as const) {
      const permission: PermissionVerdict = { step, blocked: null, asked: true };
      expect(onPress(input({ permission })), step).toEqual({
        blocked: 'permission',
        event: { type: 'permission', step },
      });
    }
  });

  it('a permission is checked before the recognition policy', () => {
    const permission: PermissionVerdict = { step: 'settings', blocked: 'microphone', asked: false };
    const policy: RecognitionPolicy = { kind: 'unavailable', reason: 'no-on-device' };
    expect(onPress(input({ permission, policy }))).toMatchObject({ blocked: 'permission' });
  });

  it('recognition off the phone is unavailable, with its reason (KV4)', () => {
    expect(
      onPress(input({ policy: { kind: 'unavailable', reason: 'no-on-device' } })),
    ).toEqual({ blocked: 'notOnPhone', event: { type: 'unavailable', reason: 'no-on-device' } });
    expect(
      onPress(input({ policy: { kind: 'unavailable', reason: 'android-too-old' } })),
    ).toEqual({
      blocked: 'androidTooOld',
      event: { type: 'unavailable', reason: 'android-too-old' },
    });
  });

  it("a language not yet downloaded is the offer: nothing on the voice machine changes", () => {
    const plan = onPress(input({ policy: { kind: 'download', locale: 'en-GB' } }));
    expect(plan).toEqual({ blocked: 'download', event: null });
  });

  it('a press that cannot start leaves a reply under way alone (no stop, no cancel)', () => {
    const plan = onPress(
      input({
        phase: 'speaking',
        replyStreaming: true,
        policy: { kind: 'unavailable', reason: 'no-recognizer' },
      }),
    );
    expect(isStartPlan(plan)).toBe(false);
    expect(plan).not.toHaveProperty('stopSpeech');
    expect(plan).not.toHaveProperty('cancelTurn');
  });
});

describe('onPress: a press that starts', () => {
  it('from idle only listens, on the phone', () => {
    const plan = started(onPress(input()));
    expect(plan).toEqual({
      stopSpeech: false,
      cancelTurn: false,
      reset: false,
      start: READY,
      steps: ['listen'],
    });
    expect(plan.start.options.requiresOnDeviceRecognition).toBe(true);
  });

  it('while Auto speaks a streaming turn: stop the speech, then cancel, then listen (barge-in)', () => {
    const plan = started(onPress(input({ phase: 'speaking', replyStreaming: true })));
    expect(plan.steps).toEqual(['stop-speech', 'cancel-turn', 'listen']);
    expect(plan).toMatchObject({ stopSpeech: true, cancelTurn: true });
  });

  it('while Auto thinks: the speech is stopped and the streaming turn cancelled', () => {
    const plan = started(onPress(input({ phase: 'thinking', replyStreaming: true })));
    expect(plan.steps).toEqual(['stop-speech', 'cancel-turn', 'listen']);
  });

  it('cancels only while the turn streams: a finished turn still being spoken is left', () => {
    const plan = started(onPress(input({ phase: 'speaking', replyStreaming: false })));
    expect(plan.steps).toEqual(['stop-speech', 'listen']);
    expect(plan.cancelTurn).toBe(false);
  });

  it('clears an error before the hold, so the new hold takes', () => {
    const plan = started(onPress(input({ phase: 'error' })));
    expect(plan.steps).toEqual(['reset', 'listen']);
    expect(plan).toMatchObject({ stopSpeech: false, cancelTurn: false, reset: true });
  });

  it('always listens last, after every other step', () => {
    const phases: readonly VoicePhase[] = ['idle', 'listening', 'thinking', 'speaking', 'error'];
    for (const phase of phases)
      for (const replyStreaming of [false, true]) {
        const { steps } = started(onPress(input({ phase, replyStreaming })));
        expect(steps[steps.length - 1], `${phase} ${replyStreaming}`).toBe('listen');
        expect(steps.filter((step) => step === 'listen')).toHaveLength(1);
      }
  });

  it('returns a frozen plan', () => {
    const plan = started(onPress(input({ phase: 'speaking', replyStreaming: true })));
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.steps)).toBe(true);
  });
});

describe('isTap', () => {
  it('is a hold under HOLD_MIN_MS, or one never measured', () => {
    expect(isTap(0)).toBe(true);
    expect(isTap(HOLD_MIN_MS - 1)).toBe(true);
    expect(isTap(Number.NaN)).toBe(true);
    expect(isTap(HOLD_MIN_MS)).toBe(false);
    expect(isTap(60_000)).toBe(false);
  });
});

describe('onRelease', () => {
  const held = HOLD_MIN_MS + 200;

  it('a tap is too short, whatever was heard', () => {
    expect(onRelease({ heard: 'What is on today?', heldMs: HOLD_MIN_MS - 1 })).toBe('too-short');
    expect(onRelease({ heard: 'stop', heldMs: 10 })).toBe('too-short');
  });

  it("'Auto, stop' as the whole utterance is STOP, nothing sent", () => {
    expect(onRelease({ heard: 'Auto, stop.', heldMs: held })).toBe('stop');
    expect(onRelease({ heard: 'Hey Auto, cancel!', heldMs: held })).toBe('stop');
  });

  it('a request that mentions stopping is sent as heard', () => {
    expect(onRelease({ heard: 'Stop the deploy', heldMs: held })).toEqual({
      send: 'Stop the deploy',
    });
  });

  it('nothing sayable is nothing heard', () => {
    for (const heard of ['', '   ', '…', '?!'])
      expect(onRelease({ heard, heldMs: held }), JSON.stringify(heard)).toBe('nothing');
  });

  it('words are sent trimmed, as heard', () => {
    const plan = onRelease({ heard: "  What's on today?  ", heldMs: held });
    expect(plan).toEqual({ send: "What's on today?" });
    expect(Object.isFrozen(plan)).toBe(true);
  });
});
