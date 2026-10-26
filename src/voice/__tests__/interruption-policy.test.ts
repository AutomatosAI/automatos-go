// Interruptions (US-019h, KV10, KV11, KV12): every event × phase through the policy; 'active' never
// resumes anything; the recognizer's errors as interruptions (a call mid-hold, the microphone going
// away mid-hold, the input busy before it opened); keep-awake on and off per state, and the hold on
// the screen taken and released under the voice's one tag.

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { VoicePhase } from '../machine/voice-state';
import type { RecognizerVoiceEvent } from '../quick-ask/recognizer-events';
import { AT, PHASES } from './voice-fixtures';

// The native module, replaced: keep-awake.ts is the one file that imports expo-keep-awake.
const native = vi.hoisted(() => ({
  activateKeepAwakeAsync: vi.fn(async (_tag?: string) => undefined),
  deactivateKeepAwake: vi.fn(async (_tag?: string) => undefined),
}));
vi.mock('expo-keep-awake', () => native);

const { interruptionActions, interruptionOf } =
  await import('../interruptions/interruption-policy');
const { holdScreenOn, keepAwakeFor, VOICE_KEEP_AWAKE_TAG } =
  await import('../interruptions/keep-awake');
const { logger } = await import('../../lib/logger');

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

/** Each phase as the reducer produces it, with the capture closed or open. */
const at = (phase: VoicePhase, micOpen = false) => ({ ...AT[phase], micOpen });
const app = (status: string) => ({ type: 'app', status }) as const;

const ABORT = { type: 'abort-recognition' };
const STOP_SPEECH = { type: 'stop-speech' };
const END_SESSION = { type: 'end-notice-session' };
const LEFT = [ABORT, STOP_SPEECH, END_SESSION];
const LEFT_MID_TURN = [...LEFT, { type: 'interrupted', reason: 'background' }];

describe("the app leaves the screen ('background')", () => {
  it.each([
    ['idle', LEFT],
    ['listening', LEFT_MID_TURN],
    ['thinking', LEFT_MID_TURN],
    ['speaking', LEFT_MID_TURN],
    ['error', LEFT],
  ] as const)(
    'in %s: abort recognition, stop speech, end the notice session',
    (phase, expected) => {
      expect(interruptionActions(app('background'), at(phase))).toEqual(expected);
    },
  );

  it.each(PHASES)('with the mic open in %s, the line says it was interrupted', (phase) => {
    expect(interruptionActions(app('background'), at(phase, true))).toEqual(LEFT_MID_TURN);
  });

  it("an iOS extension's state is away as well", () => {
    expect(interruptionActions(app('extension'), at('speaking'))).toEqual(LEFT_MID_TURN);
  });

  it('returns frozen actions (nothing to mutate)', () => {
    const actions = interruptionActions(app('background'), at('listening'));
    expect(Object.isFrozen(actions)).toBe(true);
    actions.forEach((action) => expect(Object.isFrozen(action)).toBe(true));
  });
});

describe("another screen comes over HUD's home ('covered', US-019k)", () => {
  const covered = { type: 'covered' } as const;

  it.each([
    ['idle', LEFT],
    ['listening', LEFT_MID_TURN],
    ['thinking', LEFT_MID_TURN],
    ['speaking', LEFT_MID_TURN],
    ['error', LEFT],
  ] as const)('in %s: the screen is left, as for the background', (phase, expected) => {
    expect(interruptionActions(covered, at(phase))).toEqual(expected);
    expect(interruptionActions(covered, at(phase))).toEqual(
      interruptionActions(app('background'), at(phase)),
    );
  });

  it.each(PHASES)('with the mic open in %s, the line says it was interrupted', (phase) => {
    expect(interruptionActions(covered, at(phase, true))).toEqual(LEFT_MID_TURN);
  });
});

describe('the app stays on screen or comes back: nothing resumes by itself', () => {
  it.each(PHASES.flatMap((phase) => [true, false].map((micOpen) => [phase, micOpen] as const)))(
    "'inactive', 'active' and 'unknown' in %s (mic open: %s) do nothing",
    (phase, micOpen) => {
      for (const status of ['inactive', 'active', 'unknown'])
        expect(interruptionActions(app(status), at(phase, micOpen))).toEqual([]);
    },
  );

  it("'active' after 'background' does nothing: no mic, no speech, no rejoin", () => {
    const left = interruptionActions(app('background'), at('speaking'));
    expect(left).toEqual(LEFT_MID_TURN);
    // What the reducer shows after the interruption: idle, the words kept.
    expect(interruptionActions(app('active'), at('idle'))).toEqual([]);
  });

  it('no action the policy can return starts or resumes anything', () => {
    const statuses = ['active', 'background', 'inactive', 'unknown', 'extension'];
    const reasons = ['audio-session', 'route-change'] as const;
    const types = new Set(
      PHASES.flatMap((phase) => [
        ...statuses.flatMap((status) => interruptionActions(app(status), at(phase, true))),
        ...reasons.flatMap((reason) =>
          interruptionActions({ type: 'recognizer', reason }, at(phase, true)),
        ),
      ]).map((action) => action.type),
    );
    expect([...types].sort()).toEqual(
      ['abort-recognition', 'end-notice-session', 'interrupted', 'stop-speech'].sort(),
    );
  });
});

describe('the recognizer loses the audio mid-hold', () => {
  it.each([
    ['audio-session', 'audio-session'],
    ['route-change', 'route-change'],
  ] as const)('%s while listening: abort, then the reason on the line', (reason, shown) => {
    expect(interruptionActions({ type: 'recognizer', reason }, at('listening', true))).toEqual([
      ABORT,
      { type: 'interrupted', reason: shown },
    ]);
  });

  it.each(['idle', 'thinking', 'speaking', 'error'] as const)(
    'after the hold is over (%s, mic closed) it does nothing',
    (phase) => {
      for (const reason of ['audio-session', 'route-change'] as const)
        expect(interruptionActions({ type: 'recognizer', reason }, at(phase))).toEqual([]);
    },
  );

  it('a hold whose mic is still opening is a hold', () => {
    expect(
      interruptionActions({ type: 'recognizer', reason: 'audio-session' }, at('listening')),
    ).toEqual([ABORT, { type: 'interrupted', reason: 'audio-session' }]);
  });
});

describe("the recognizer's events as interruptions (interruptionOf)", () => {
  const interrupted: RecognizerVoiceEvent = { type: 'interrupted', reason: 'audio-session' };
  const capture: RecognizerVoiceEvent = { type: 'error', kind: 'mic-busy' };

  it.each(PHASES)("'interrupted' in %s is the audio session", (phase) => {
    expect(interruptionOf(interrupted, at(phase))).toEqual({
      type: 'recognizer',
      reason: 'audio-session',
    });
  });

  it("'audio-capture' with the mic open is the microphone changing", () => {
    expect(interruptionOf(capture, at('listening', true))).toEqual({
      type: 'recognizer',
      reason: 'route-change',
    });
  });

  it("'audio-capture' before the mic opened is the input busy: its usual way", () => {
    expect(interruptionOf(capture, at('listening'))).toBeNull();
  });

  it.each<RecognizerVoiceEvent>([
    { type: 'error', kind: 'busy' },
    { type: 'error', kind: 'recognizer' },
    { type: 'mic_open' },
    { type: 'mic_closed' },
    { type: 'partial', text: 'what' },
    { type: 'final', text: 'what is on' },
    { type: 'nothing_heard' },
    { type: 'permission', step: 'settings' },
    { type: 'unavailable', reason: 'no-on-device' },
  ])('$type is not an interruption', (event) => {
    expect(interruptionOf(event, at('listening', true))).toBeNull();
  });
});

describe('keep-awake (KV12)', () => {
  it.each([
    ['idle', false],
    ['listening', true],
    ['thinking', true],
    ['speaking', true],
    ['error', false],
  ] as const)('in %s with the mic closed: %s', (phase, awake) => {
    expect(keepAwakeFor(at(phase))).toBe(awake);
  });

  it.each(PHASES)('the open mic keeps the screen on in %s', (phase) => {
    expect(keepAwakeFor(at(phase, true))).toBe(true);
  });

  it('holds the screen under the one voice tag, and releases that tag', () => {
    const releaseHold = holdScreenOn();
    expect(native.activateKeepAwakeAsync).toHaveBeenCalledWith(VOICE_KEEP_AWAKE_TAG);
    expect(native.deactivateKeepAwake).not.toHaveBeenCalled();
    releaseHold();
    expect(native.deactivateKeepAwake).toHaveBeenCalledWith(VOICE_KEEP_AWAKE_TAG);
  });

  it('a failed hold or release is logged, never thrown', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    native.activateKeepAwakeAsync.mockRejectedValueOnce(new Error('no module'));
    native.deactivateKeepAwake.mockRejectedValueOnce(new Error('no module'));
    const releaseHold = holdScreenOn();
    expect(() => releaseHold()).not.toThrow();
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
  });
});
