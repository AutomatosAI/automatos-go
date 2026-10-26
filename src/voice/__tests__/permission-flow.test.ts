// Microphone and speech permissions (US-019c, KV5): the step for every state per purpose and
// platform (quick-ask needs speech recognition on iOS only, Live never), the notice's words, the
// press as the only path that asks, and a first-time grant ending the hold that raised the prompt.

import { describe, expect, it, vi } from 'vitest';

import { voiceReducer } from '../machine/voice-reducer';
import { INITIAL_VOICE_STATE, type PermissionStep } from '../machine/voice-state';
import {
  blockedPermission,
  createPermissionGate,
  parsePermission,
  permissionEvent,
  permissionNotice,
  permissionStep,
  permissionVerdict,
  type PermissionInput,
  type PermissionPort,
  type PermissionPurpose,
  type PermissionReading,
  type PermissionState,
} from '../permissions/permission-flow';
import { PERMISSION_COPY } from '../strings';
import { AT } from './voice-fixtures';

const GRANTED: PermissionState = { status: 'granted', canAskAgain: true };
const UNDETERMINED: PermissionState = { status: 'undetermined', canAskAgain: true };
const DENIED_ASKABLE: PermissionState = { status: 'denied', canAskAgain: true };
const DENIED_FINAL: PermissionState = { status: 'denied', canAskAgain: false };
const RESTRICTED: PermissionState = { status: 'denied', canAskAgain: false, restricted: true };

const STATES = {
  granted: GRANTED,
  undetermined: UNDETERMINED,
  'denied, can ask again': DENIED_ASKABLE,
  'denied, cannot ask again': DENIED_FINAL,
} as const;

/** The step a state of one permission gives when every other needed one is granted. */
const ALONE: Readonly<Record<keyof typeof STATES, PermissionStep>> = {
  granted: 'granted',
  undetermined: 'ask',
  'denied, can ask again': 'ask',
  'denied, cannot ask again': 'settings',
};

const input = (
  purpose: PermissionPurpose,
  platform: 'ios' | 'android',
  mic: PermissionState,
  speech?: PermissionState,
): PermissionInput => (speech ? { purpose, platform, mic, speech } : { purpose, platform, mic });

describe('permissionStep — the microphone, every purpose and platform', () => {
  const cases = (['quick-ask', 'live'] as const).flatMap((purpose) =>
    (['ios', 'android'] as const).flatMap((platform) =>
      Object.keys(STATES).map((name) => [purpose, platform, name] as const),
    ),
  );

  it.each(cases)('%s on %s, microphone %s', (purpose, platform, name) => {
    const mic = STATES[name as keyof typeof STATES];
    expect(permissionStep(input(purpose, platform, mic, GRANTED))).toBe(
      ALONE[name as keyof typeof STATES],
    );
  });
});

describe('permissionStep — speech recognition', () => {
  it.each(Object.keys(STATES))('quick-ask on iOS needs it: speech %s', (name) => {
    const speech = STATES[name as keyof typeof STATES];
    expect(permissionStep(input('quick-ask', 'ios', GRANTED, speech))).toBe(
      ALONE[name as keyof typeof STATES],
    );
  });

  it('quick-ask on iOS counts a missing speech answer as undetermined, never granted', () => {
    expect(permissionStep(input('quick-ask', 'ios', GRANTED))).toBe('ask');
  });

  it.each([DENIED_FINAL, UNDETERMINED, RESTRICTED])(
    'quick-ask on Android ignores it (Android has no speech permission): %o',
    (speech) => {
      expect(permissionStep(input('quick-ask', 'android', GRANTED, speech))).toBe('granted');
    },
  );

  it.each(['ios', 'android'] as const)('Live on %s ignores it: the microphone only', (platform) => {
    for (const speech of [DENIED_FINAL, UNDETERMINED, RESTRICTED]) {
      expect(permissionStep(input('live', platform, GRANTED, speech))).toBe('granted');
      expect(permissionStep(input('live', platform, UNDETERMINED, speech))).toBe('ask');
      expect(permissionStep(input('live', platform, DENIED_FINAL, speech))).toBe('settings');
    }
  });
});

describe('permissionStep — restricted (Screen Time)', () => {
  it('is restricted on iOS quick-ask, before settings and ask', () => {
    for (const mic of [GRANTED, UNDETERMINED, DENIED_FINAL]) {
      expect(permissionStep(input('quick-ask', 'ios', mic, RESTRICTED))).toBe('restricted');
    }
  });

  it('a denial the system will not ask again beats an undetermined one: Settings first', () => {
    expect(permissionStep(input('quick-ask', 'ios', DENIED_FINAL, UNDETERMINED))).toBe('settings');
    expect(permissionStep(input('quick-ask', 'ios', UNDETERMINED, DENIED_FINAL))).toBe('settings');
  });
});

describe('blockedPermission and permissionNotice', () => {
  it('names the microphone first, then speech recognition', () => {
    expect(blockedPermission(input('quick-ask', 'ios', DENIED_FINAL, DENIED_FINAL))).toBe(
      'microphone',
    );
    expect(blockedPermission(input('quick-ask', 'ios', GRANTED, DENIED_FINAL))).toBe('speech');
    expect(blockedPermission(input('live', 'ios', DENIED_FINAL))).toBe('microphone');
  });

  it('names nothing for any step but settings', () => {
    expect(blockedPermission(input('quick-ask', 'ios', GRANTED, RESTRICTED))).toBeNull();
    expect(blockedPermission(input('quick-ask', 'ios', UNDETERMINED, GRANTED))).toBeNull();
    expect(blockedPermission(input('live', 'android', GRANTED))).toBeNull();
  });

  it("'settings' says which one is off and offers Open Settings", () => {
    const mic = permissionVerdict(input('live', 'android', DENIED_FINAL));
    expect(permissionNotice(mic)).toEqual({ text: PERMISSION_COPY.micOff, openSettings: true });
    const speech = permissionVerdict(input('quick-ask', 'ios', GRANTED, DENIED_FINAL));
    expect(permissionNotice(speech)).toEqual({
      text: PERMISSION_COPY.speechOff,
      openSettings: true,
    });
  });

  it("'restricted' has its words and no button", () => {
    const verdict = permissionVerdict(input('quick-ask', 'ios', GRANTED, RESTRICTED));
    expect(permissionNotice(verdict)).toEqual({
      text: PERMISSION_COPY.restricted,
      openSettings: false,
    });
  });

  it("'granted' and 'ask' show no notice", () => {
    expect(permissionNotice(permissionVerdict(input('live', 'ios', GRANTED)))).toBeNull();
    expect(permissionNotice(permissionVerdict(input('live', 'ios', UNDETERMINED)))).toBeNull();
  });

  it("the copy is the AC's, and Settings is named", () => {
    expect(PERMISSION_COPY.micOff).toBe(
      "Automatos Go can't hear you: the microphone is off for it. Turn it on in Settings.",
    );
    expect(PERMISSION_COPY.speechOff).toContain('speech recognition is off');
    expect(PERMISSION_COPY.restricted).toBe(
      'The microphone or speech recognition is restricted on this phone (Screen Time).',
    );
    expect(PERMISSION_COPY.openSettings).toBe('Open Settings');
  });
});

describe('parsePermission', () => {
  it("reads the module's answer, unknown fields ignored", () => {
    expect(
      parsePermission({ status: 'denied', canAskAgain: false, granted: false, expires: 'never' }),
    ).toEqual(DENIED_FINAL);
    expect(parsePermission({ status: 'denied', canAskAgain: false, restricted: true })).toEqual(
      RESTRICTED,
    );
  });

  it.each([undefined, null, {}, { status: 'granted' }, { status: 'yes', canAskAgain: true }])(
    'an answer that does not parse is undetermined, never granted: %o',
    (answer) => {
      expect(parsePermission(answer)).toEqual(UNDETERMINED);
    },
  );
});

/** A spy port: each read answers the next reading in the list (the last one repeats). */
function spyGate(
  readings: readonly PermissionReading[],
  platform: 'ios' | 'android' = 'ios',
  overrides: Partial<PermissionPort> = {},
) {
  let index = 0;
  const port = {
    platform: vi.fn(() => platform),
    read: vi.fn(async () => readings[Math.min(index++, readings.length - 1)] as PermissionReading),
    ask: vi.fn(async () => undefined as unknown),
    ...overrides,
  };
  return { port, gate: createPermissionGate(port) };
}

const reading = (mic: PermissionState, speech?: PermissionState): PermissionReading =>
  speech ? { mic, speech } : { mic };

describe('the gate — only a press asks', () => {
  it("check() reads 'undetermined' as 'ask' and never prompts", async () => {
    const { port, gate } = spyGate([reading(UNDETERMINED, UNDETERMINED)]);
    for (const purpose of ['quick-ask', 'live'] as const) {
      await expect(gate.check(purpose)).resolves.toEqual({
        step: 'ask',
        blocked: null,
        asked: false,
      });
    }
    expect(port.ask).not.toHaveBeenCalled();
  });

  it("press() asks once on 'undetermined', for that purpose, and reads again", async () => {
    const { port, gate } = spyGate([
      reading(UNDETERMINED, UNDETERMINED),
      reading(GRANTED, GRANTED),
    ]);
    const verdict = await gate.press('quick-ask');
    expect(port.ask).toHaveBeenCalledTimes(1);
    expect(port.ask).toHaveBeenCalledWith('quick-ask');
    expect(port.read).toHaveBeenCalledTimes(2);
    expect(verdict).toEqual({ step: 'granted', blocked: null, asked: true });
  });

  it.each([
    ['granted', reading(GRANTED, GRANTED), 'granted'],
    ['settings', reading(DENIED_FINAL, GRANTED), 'settings'],
    ['restricted', reading(GRANTED, RESTRICTED), 'restricted'],
  ] as const)('press() never asks when the step is already %s', async (_name, answer, step) => {
    const { port, gate } = spyGate([answer]);
    await expect(gate.press('quick-ask')).resolves.toMatchObject({ step, asked: false });
    expect(port.ask).not.toHaveBeenCalled();
  });

  it('Android may ask again after a first denial: still a press, still one prompt', async () => {
    const { port, gate } = spyGate([reading(DENIED_ASKABLE), reading(DENIED_ASKABLE)], 'android');
    await expect(gate.press('quick-ask')).resolves.toEqual({
      step: 'ask',
      blocked: null,
      asked: true,
    });
    expect(port.ask).toHaveBeenCalledTimes(1);
  });

  it('a read that throws is undetermined, never granted', async () => {
    const { port, gate } = spyGate([], 'android', {
      read: vi.fn(async () => {
        throw new Error('no permissions module');
      }),
    });
    await expect(gate.check('live')).resolves.toMatchObject({ step: 'ask' });
    await expect(gate.press('live')).resolves.toMatchObject({ step: 'ask', asked: true });
    expect(port.ask).toHaveBeenCalledTimes(1);
  });

  it('a prompt that throws is read again: the phone has the last word', async () => {
    const { gate } = spyGate([reading(UNDETERMINED), reading(DENIED_FINAL)], 'android', {
      ask: vi.fn(async () => {
        throw new Error('no activity');
      }),
    });
    await expect(gate.press('live')).resolves.toEqual({
      step: 'settings',
      blocked: 'microphone',
      asked: true,
    });
  });
});

describe('permissionEvent — the press that raised the prompt is not speech', () => {
  it('granted with no prompt lets the hold go on', () => {
    expect(permissionEvent({ step: 'granted', blocked: null, asked: false })).toBeNull();
  });

  it("a first-time grant ends the hold: idle with 'Ready. Hold to talk.'", () => {
    const event = permissionEvent({ step: 'granted', blocked: null, asked: true });
    expect(event).toEqual({ type: 'permission', step: 'granted' });
    for (const from of [AT.listening, AT.idle]) {
      const next = voiceReducer(from, event ?? { type: 'reset' });
      expect(next).toMatchObject({ phase: 'idle', heard: '', message: 'ready' });
    }
    expect(PERMISSION_COPY.ready).toBe('Ready. Hold to talk.');
  });

  it("a prompt the user declined on Android ('ask' again) changes nothing", () => {
    const event = permissionEvent({ step: 'ask', blocked: null, asked: true });
    expect(event).toEqual({ type: 'permission', step: 'ask' });
    expect(voiceReducer(INITIAL_VOICE_STATE, event ?? { type: 'reset' })).toBe(INITIAL_VOICE_STATE);
  });

  it.each([
    ['settings', 'permission-settings'],
    ['restricted', 'permission-restricted'],
  ] as const)('%s → the error the notice explains', (step, errorKind) => {
    const event = permissionEvent({ step, blocked: null, asked: false });
    expect(voiceReducer(INITIAL_VOICE_STATE, event ?? { type: 'reset' })).toMatchObject({
      phase: 'error',
      errorKind,
    });
  });
});
