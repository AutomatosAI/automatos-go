// Face ID before approve or answer (D19, KP13): the ONLY module that imports
// expo-local-authentication. stepUp(action) passes an ungated action, or a gated one while the
// setting is off, without reading the phone; otherwise it reads hasHardwareAsync, then
// getEnrolledLevelAsync, and shows the system prompt with the passcode as the fallback
// (disableDeviceFallback false: LAPolicyDeviceOwnerAuthentication on iOS, DEVICE_CREDENTIAL on
// Android). Single-flight: a call while the prompt is open shares it (Android answers a second
// prompt with app_cancel), so one pass lets every write the person tapped for go. A thrown error
// is 'unavailable', never a silent pass. Logs carry kinds only. A notification Reply is not gated
// (D18: the unlocked phone is the check); this gate is for the app's own buttons.

import * as LocalAuthentication from 'expo-local-authentication';

import { logger } from '../lib/logger';
import {
  decide,
  gateOf,
  hasSecurity,
  outcomeOf,
  type AuthResult,
  type PromptedAction,
  type StepUpAction,
  type StepUpVerdict,
} from './policy';
import { stepUpSetting } from './setting-store';
import { STEP_UP_CANCEL_LABEL, STEP_UP_PROMPT_COPY } from './strings';

export type AuthOptions = Readonly<{
  promptMessage: string;
  cancelLabel: string;
  disableDeviceFallback: false;
}>;

/** The three calls of expo-local-authentication 17.0.9 the gate makes; tests fake them. */
export type LocalAuthPort = Readonly<{
  hasHardwareAsync: () => Promise<boolean>;
  getEnrolledLevelAsync: () => Promise<number>;
  authenticateAsync: (options: AuthOptions) => Promise<AuthResult>;
}>;

export type StepUp = (action: StepUpAction) => Promise<StepUpVerdict>;

export type StepUpDeps = Readonly<{
  auth: LocalAuthPort;
  /** The switch, read on each call. */
  settingOn: () => boolean;
}>;

function optionsFor(action: PromptedAction): AuthOptions {
  return Object.freeze({
    promptMessage: STEP_UP_PROMPT_COPY[action],
    cancelLabel: STEP_UP_CANCEL_LABEL,
    disableDeviceFallback: false,
  });
}

async function check(
  { auth, settingOn }: StepUpDeps,
  action: PromptedAction,
): Promise<StepUpVerdict> {
  try {
    const hasHardware = await auth.hasHardwareAsync();
    const enrolledLevel = await auth.getEnrolledLevelAsync();
    const decision = decide({ action, settingOn: settingOn(), hasHardware, enrolledLevel });
    if (decision !== 'prompt') return decision;
    const outcome = outcomeOf(await auth.authenticateAsync(optionsFor(action)));
    logger.info('[step-up] prompt answered', outcome);
    return outcome;
  } catch {
    logger.warn('[step-up] the check failed; nothing is sent');
    return 'unavailable';
  }
}

export function createStepUp(deps: StepUpDeps): StepUp {
  let open: Promise<StepUpVerdict> | null = null;
  return (action) => {
    const gate = gateOf(action, deps.settingOn());
    if ('pass' in gate) return Promise.resolve(gate.pass);
    open ??= check(deps, gate.ask).finally(() => {
      open = null;
    });
    return open;
  };
}

/**
 * Whether the phone can be asked at all (a passcode, or biometrics over one), for the Settings line
 * "This phone has no passcode or Face ID". null when it cannot be read: nothing is claimed then.
 */
export async function readPhoneSecurity(
  auth: Pick<LocalAuthPort, 'hasHardwareAsync' | 'getEnrolledLevelAsync'>,
): Promise<boolean | null> {
  try {
    const hasHardware = await auth.hasHardwareAsync();
    return hasSecurity(hasHardware, await auth.getEnrolledLevelAsync());
  } catch {
    logger.warn('[step-up] could not read whether the phone has a passcode');
    return null;
  }
}

const nativeAuth: LocalAuthPort = Object.freeze({
  hasHardwareAsync: () => LocalAuthentication.hasHardwareAsync(),
  getEnrolledLevelAsync: () => LocalAuthentication.getEnrolledLevelAsync(),
  authenticateAsync: (options: AuthOptions) => LocalAuthentication.authenticateAsync(options),
});

/** The app's gate, over the phone's Face ID and the app's switch. */
export const stepUp: StepUp = createStepUp({
  auth: nativeAuth,
  settingOn: () => stepUpSetting.isOn(),
});

/** readPhoneSecurity over the phone's own module. */
export const phoneSecurity = (): Promise<boolean | null> => readPhoneSecurity(nativeAuth);
