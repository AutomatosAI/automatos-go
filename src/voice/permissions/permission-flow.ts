// Microphone and speech permissions (US-019c, KV5): where they stand, and the one path that may raise
// the system prompt. Pure: no React, React Native or Expo. permissions.ts binds the port to
// expo-speech-recognition, the tests to a spy.
//   Quick-ask needs the microphone and, on iOS, speech recognition; Android has no speech permission
//   (the module answers 'granted' for it: ExpoSpeechRecognitionModule.kt:167-189). Live needs the
//   microphone only, whatever speech recognition says.
//   The step: 'restricted' when Content & Privacy restrictions (Screen Time) block speech
//   recognition; 'settings' when a needed permission is denied and the system will not ask again (iOS
//   after any denial, EXPermissionsService.m:142; Android once shouldShowRequestPermissionRationale is
//   false, PermissionsService.kt:215-219); 'ask' when one is undetermined or Android may ask again;
//   'granted' when every needed one is.
//   Only a press asks: check() reads and never prompts (a mount, a return to the screen, the app
//   coming back), press() reads and asks when the step is 'ask'. The prompt takes the hold that
//   raised it, so that press is never speech: its verdict says asked, and the reducer goes back to
//   idle with 'Ready. Hold to talk.' (permissionEvent).
// Every module answer is parsed (zod, unknown fields ignored); one that does not parse, or a read
// that throws, counts as undetermined: never as granted.

import { z } from 'zod';

import { logger } from '../../lib/logger';
import type { VoiceEvent } from '../machine/voice-reducer';
import type { PermissionStep } from '../machine/voice-state';
import type { RecognitionPlatform } from '../quick-ask/recognition-policy';
import { PERMISSION_COPY } from '../strings';

export type PermissionPurpose = 'quick-ask' | 'live';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export type PermissionState = {
  readonly status: PermissionStatus;
  readonly canAskAgain: boolean;
  /** iOS speech recognition: blocked by Content & Privacy restrictions (Screen Time). */
  readonly restricted?: boolean;
};

export type PermissionInput = {
  readonly purpose: PermissionPurpose;
  readonly platform: RecognitionPlatform;
  readonly mic: PermissionState;
  /** iOS speech recognition; quick-ask on iOS treats it missing as undetermined. */
  readonly speech?: PermissionState;
};

/** The permission the 'settings' notice names. */
export type BlockedPermission = 'microphone' | 'speech';

export type PermissionVerdict = {
  readonly step: PermissionStep;
  /** For 'settings', the permission that is off ('restricted' names both); else null. */
  readonly blocked: BlockedPermission | null;
  /** The system prompt was raised during this press: the hold it took is not speech. */
  readonly asked: boolean;
};

/** The module's answers as they come: the microphone's and, when read, speech recognition's. */
export type PermissionReading = { readonly mic: unknown; readonly speech?: unknown };

/** The slice of ExpoSpeechRecognitionModule (and the phone) the permission gate uses. */
export type PermissionPort = {
  readonly platform: () => RecognitionPlatform;
  readonly read: (purpose: PermissionPurpose) => Promise<PermissionReading>;
  /** The system prompt(s) for the purpose; what it resolves to is read again afterwards. */
  readonly ask: (purpose: PermissionPurpose) => Promise<unknown>;
};

export type PermissionGate = {
  /** Where the permissions stand, read only: never a prompt (mount, focus, foreground). */
  readonly check: (purpose: PermissionPurpose) => Promise<PermissionVerdict>;
  /** HOLD TO TALK or LIVE pressed: reads, and asks when the step is 'ask'. The only way to ask. */
  readonly press: (purpose: PermissionPurpose) => Promise<PermissionVerdict>;
};

/** What the notice under the core shows for a verdict: its words and whether Settings can help. */
export type PermissionNoticeModel = { readonly text: string; readonly openSettings: boolean };

const UNDETERMINED: PermissionState = Object.freeze({
  status: 'undetermined',
  canAskAgain: true,
});

const stateSchema = z.object({
  status: z.enum(['granted', 'denied', 'undetermined']),
  canAskAgain: z.boolean(),
  restricted: z.boolean().optional(),
});

/** A module answer as a state; anything that does not parse is undetermined, never granted. */
export function parsePermission(answer: unknown): PermissionState {
  const parsed = stateSchema.safeParse(answer);
  if (!parsed.success) return UNDETERMINED;
  const { status, canAskAgain, restricted } = parsed.data;
  return Object.freeze(
    restricted === undefined ? { status, canAskAgain } : { status, canAskAgain, restricted },
  );
}

/** Quick-ask on iOS needs speech recognition too (Apple asks for it even on the phone). */
export function needsSpeech(purpose: PermissionPurpose, platform: RecognitionPlatform): boolean {
  return purpose === 'quick-ask' && platform === 'ios';
}

type Needed = readonly (readonly [BlockedPermission, PermissionState])[];

/** The permissions the purpose needs on this platform, the microphone first. */
function needed(input: PermissionInput): Needed {
  const mic = ['microphone', input.mic] as const;
  return needsSpeech(input.purpose, input.platform)
    ? [mic, ['speech', input.speech ?? UNDETERMINED] as const]
    : [mic];
}

/** Denied, and the system will not show its prompt again: only Settings can change it. */
const settled = (state: PermissionState): boolean =>
  state.status === 'denied' && !state.canAskAgain;

export function permissionStep(input: PermissionInput): PermissionStep {
  const states = needed(input).map(([, state]) => state);
  if (states.some((state) => state.restricted === true)) return 'restricted';
  if (states.some(settled)) return 'settings';
  return states.every((state) => state.status === 'granted') ? 'granted' : 'ask';
}

/** The permission a 'settings' step names (the microphone first); null for any other step. */
export function blockedPermission(input: PermissionInput): BlockedPermission | null {
  if (permissionStep(input) !== 'settings') return null;
  return needed(input).find(([, state]) => settled(state))?.[0] ?? null;
}

export function permissionVerdict(input: PermissionInput, asked = false): PermissionVerdict {
  return Object.freeze({ step: permissionStep(input), blocked: blockedPermission(input), asked });
}

/**
 * The reducer's event for a press's verdict, or null when the hold goes on (granted, no prompt).
 * Asked and granted → 'granted': idle with 'Ready. Hold to talk.' (the prompt took the hold);
 * still 'ask' after the prompt (Android may ask again) → 'ask', which changes nothing.
 */
export function permissionEvent(
  verdict: PermissionVerdict,
): Extract<VoiceEvent, { type: 'permission' }> | null {
  if (verdict.step === 'granted' && !verdict.asked) return null;
  return Object.freeze({ type: 'permission', step: verdict.step });
}

/** The notice for a step the user must fix outside the app; null when a press can go on or ask. */
export function permissionNotice(verdict: PermissionVerdict): PermissionNoticeModel | null {
  if (verdict.step === 'restricted')
    return Object.freeze({ text: PERMISSION_COPY.restricted, openSettings: false });
  if (verdict.step !== 'settings') return null;
  const text = verdict.blocked === 'speech' ? PERMISSION_COPY.speechOff : PERMISSION_COPY.micOff;
  return Object.freeze({ text, openSettings: true });
}

export function createPermissionGate(port: PermissionPort): PermissionGate {
  async function readInput(purpose: PermissionPurpose): Promise<PermissionInput> {
    const base = { purpose, platform: port.platform() };
    try {
      const reading = await port.read(purpose);
      const mic = parsePermission(reading.mic);
      return reading.speech === undefined
        ? { ...base, mic }
        : { ...base, mic, speech: parsePermission(reading.speech) };
    } catch (error) {
      logger.warn('[voice] the permission read failed', error);
      return { ...base, mic: UNDETERMINED };
    }
  }

  async function check(purpose: PermissionPurpose): Promise<PermissionVerdict> {
    return permissionVerdict(await readInput(purpose));
  }

  async function press(purpose: PermissionPurpose): Promise<PermissionVerdict> {
    const before = await check(purpose);
    if (before.step !== 'ask') return before;
    try {
      await port.ask(purpose);
    } catch (error) {
      logger.warn('[voice] the permission prompt failed', error);
    }
    return permissionVerdict(await readInput(purpose), true);
  }

  return Object.freeze({ check, press });
}
