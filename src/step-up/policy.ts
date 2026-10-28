// Face ID before approve or answer (D19, KP13): which actions ask, and what the phone's answer
// means. Pure: step-up.ts reads the phone and calls these. Client-side only, as on the web; no
// server step-up. Gated in the app: an answer (an option or own words), approving a ticket, a
// Mission plan or a social post, granting a tool, and a row's Try again (PRD-268 'retry': it starts
// work, as PRD-268's Start does). Not gated: reject, deny, withdraw, dismiss,
// send back, request changes, report. Turning the setting off asks first ('settings_off'). A
// notification Reply is not gated (D18: the unlocked phone is the check; iOS asks for the unlock
// before the reply field opens). A phone with no passcode and no biometrics cannot be asked, so it
// passes and the Notifications screen says so.

/** The writes that ask for Face ID (or the passcode) first while the setting is on (KP13). */
export const GATED_ACTIONS = Object.freeze([
  'answer',
  'approve_ticket',
  'approve_plan',
  'grant_tool',
  'approve_social',
  'retry',
] as const);
export type GatedAction = (typeof GATED_ACTIONS)[number];

/** Turning the setting off: always asks, whatever the setting says now. */
export const SETTINGS_OFF_ACTION = 'settings_off';

/** The writes that never ask (KP13): the safe direction needs no proof. */
export const UNGATED_ACTIONS = Object.freeze([
  'reject',
  'deny',
  'withdraw',
  'dismiss',
  'send_back',
  'request_changes',
  'report',
] as const);
export type UngatedAction = (typeof UNGATED_ACTIONS)[number];

/** The actions the prompt can be shown for: each has its line in strings.ts. */
export type PromptedAction = GatedAction | typeof SETTINGS_OFF_ACTION;

export type StepUpAction = PromptedAction | UngatedAction;

/**
 * expo-local-authentication 17.0.9's SecurityLevel (build/LocalAuthentication.types.d.ts), named
 * here so this module imports no native one. iOS reports any biometric as BIOMETRIC_STRONG.
 */
export const ENROLLED_LEVEL = Object.freeze({
  NONE: 0,
  SECRET: 1,
  BIOMETRIC_WEAK: 2,
  BIOMETRIC_STRONG: 3,
});

export type Decision = 'prompt' | 'pass_off' | 'pass_no_security' | 'pass_not_gated';

/** What the phone said, as the person hears it; each has its line in strings.ts. */
export type Outcome = 'passed' | 'cancelled' | 'failed' | 'locked_out' | 'unavailable';

/** Every answer stepUp gives: a pass that asked nothing, or the prompt's outcome. */
export type StepUpVerdict = Exclude<Decision, 'prompt'> | Outcome;

/** The verdicts that let the write go. */
export type LettingVerdict = 'passed' | 'pass_off' | 'pass_no_security' | 'pass_not_gated';

/** The verdicts that send nothing; each has its line in strings.ts. */
export type Refusal = Exclude<StepUpVerdict, LettingVerdict>;

/** Before the phone is read: a pass, or the action the phone must decide for. */
export type Gate = Readonly<{ pass: 'pass_not_gated' | 'pass_off' } | { ask: PromptedAction }>;

export type DecideInput = Readonly<{
  action: StepUpAction;
  settingOn: boolean;
  hasHardware: boolean;
  enrolledLevel: number;
}>;

export function isGated(action: StepUpAction): action is GatedAction {
  return (GATED_ACTIONS as readonly string[]).includes(action);
}

/**
 * The part of the decision the phone is not needed for: an ungated action, or a gated one while the
 * setting is off, passes before anything is read. Turning the setting off always asks.
 */
export function gateOf(action: StepUpAction, settingOn: boolean): Gate {
  if (action === SETTINGS_OFF_ACTION) return { ask: action };
  if (!isGated(action)) return { pass: 'pass_not_gated' };
  return settingOn ? { ask: action } : { pass: 'pass_off' };
}

/**
 * Both platforms report NONE when the phone has no passcode (iOS: no device-owner policy; Android:
 * no secure lock screen), and biometrics need one, so the level is what proves "no security".
 */
export function hasSecurity(hasHardware: boolean, enrolledLevel: number): boolean {
  const passcode = enrolledLevel >= ENROLLED_LEVEL.SECRET;
  const biometrics = hasHardware && enrolledLevel >= ENROLLED_LEVEL.BIOMETRIC_WEAK;
  return passcode || biometrics;
}

export function decide({ action, settingOn, hasHardware, enrolledLevel }: DecideInput): Decision {
  const gate = gateOf(action, settingOn);
  if ('pass' in gate) return gate.pass;
  return hasSecurity(hasHardware, enrolledLevel) ? 'prompt' : 'pass_no_security';
}

/**
 * expo-local-authentication's result. error is a string: besides the typed codes, iOS resolves
 * 'missing_usage_description' and 'unknown: <code>, <description>'
 * (ios/LocalAuthenticationModule.swift).
 */
export type AuthResult = Readonly<{ success: true } | { success: false; error: string }>;

const CANCELLED_ERRORS: ReadonlySet<string> = new Set([
  'user_cancel',
  'app_cancel',
  'system_cancel',
  'user_fallback',
]);
const FAILED_ERRORS: ReadonlySet<string> = new Set(['authentication_failed', 'timeout']);
const LOCKED_OUT_ERRORS: ReadonlySet<string> = new Set(['lockout']);

/** Anything that is not a success, a cancel, a miss or a lockout is 'unavailable': never a pass. */
export function outcomeOf(result: AuthResult): Outcome {
  if (result.success) return 'passed';
  if (CANCELLED_ERRORS.has(result.error)) return 'cancelled';
  if (FAILED_ERRORS.has(result.error)) return 'failed';
  if (LOCKED_OUT_ERRORS.has(result.error)) return 'locked_out';
  return 'unavailable';
}

const LETTING_VERDICTS: ReadonlySet<StepUpVerdict> = new Set<LettingVerdict>([
  'passed',
  'pass_off',
  'pass_no_security',
  'pass_not_gated',
]);

/** The prompt passed, or nothing needed asking: the write may go. */
export function lets(verdict: StepUpVerdict): verdict is LettingVerdict {
  return LETTING_VERDICTS.has(verdict);
}
