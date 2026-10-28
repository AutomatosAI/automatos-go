// Settings → Notifications in words (PRD-001 §4.7; D19, D21, D22, D24), pure: what the screen read
// in, every line and switch out, so each state is tested without a renderer. This phone: one
// sentence and at most one button per US-014c status — the server's gates first (no 'push', no
// Expo, no EAS project id), then the registrar's answer, with the server's own row (GET /devices)
// read for why push is off once it is newer than that answer. The push types and the redact switch
// show only where the server pushes through Expo (the foundation's canPush), the digest only with
// 'digest' too; Face ID always. Nothing here is changed: every answer is a new, frozen value.

import { canPush, type GateInput } from '../../api/capabilities';
import type { WorkspaceRole } from '../../api/workspace';
import { STEP_UP_SETTING_COPY } from '../../step-up/strings';
import { ACTIVE_DEVICE_STATUS } from '../config';
import type { RegistrationOutcome } from '../registration/register';
import {
  gateStatus,
  pushStatus,
  serverRowOf,
  type OffReason,
  type PushSource,
  type PushStatus,
  type PushStatusKind,
} from '../registration/state';
import type { Device, Preferences, WorkspacePush } from '../schemas/server';
import { PUSH_PHONE_COPY, PUSH_PREFS_COPY, PUSH_SETTINGS_COPY, PUSH_TYPE_COPY } from '../strings';
import { DIGEST_TIMES, digestOn, digestShown, digestTimeOf } from './digest';
import { digestNowShown } from './digest-now';
import type { RegistrarAction } from './phone-link';
import { PUSH_TYPE_SWITCHES, pushTypesOf, switchState } from './prefs';
import { canRedact, redactNote, redactState } from './redact';

export type PhoneAction = RegistrarAction | 'open_settings';

export type PhoneStatusView = Readonly<{ sentence: string; action: PhoneAction | null }>;

/** What the status card's words depend on besides the status. */
export type PhoneContext = Readonly<{ source: PushSource; serverName: string }>;

const view = (sentence: string, action: PhoneAction | null = null): PhoneStatusView =>
  Object.freeze({ sentence, action });

const CHECKING = view(PUSH_PHONE_COPY.checking);

const OFF_VIEWS: Readonly<Record<OffReason, PhoneStatusView>> = Object.freeze({
  DeviceNotRegistered: view(PUSH_PHONE_COPY.offDeviceNotRegistered, 'turn_on_again'),
  token_moved: view(PUSH_PHONE_COPY.offTokenMoved, 'turn_on_again'),
  device_revoked: view(PUSH_PHONE_COPY.offDeviceRevoked, 'turn_on_again'),
  // granted but not registered yet, or a 409 with no words of its own
  other: view(PUSH_PHONE_COPY.offOther, 'try_again'),
});

type FixedKind = Exclude<PushStatusKind, 'operator_off' | 'key_missing'>;

const FIXED_VIEWS: Readonly<Record<FixedKind, PhoneStatusView>> = Object.freeze({
  unsupported: view(PUSH_PHONE_COPY.unsupported),
  not_configured: view(PUSH_PHONE_COPY.notConfigured),
  ask: view(PUSH_PHONE_COPY.ask, 'turn_on'),
  denied: view(PUSH_PHONE_COPY.denied, 'open_settings'),
  on: view(PUSH_PHONE_COPY.on),
  revoked_by_admin: view(PUSH_PHONE_COPY.revokedByAdmin),
  token_elsewhere: view(PUSH_PHONE_COPY.tokenElsewhere),
  // removed in Studio, then Try again registers past the 409 (phone-link.ts runPhoneAction)
  device_limit: view(PUSH_PHONE_COPY.deviceLimit, 'try_again'),
});

const ACTION_LABELS: Readonly<Record<PhoneAction, string>> = Object.freeze({
  turn_on: PUSH_PHONE_COPY.turnOn,
  open_settings: PUSH_PHONE_COPY.openSettings,
  turn_on_again: PUSH_PHONE_COPY.turnOnAgain,
  try_again: PUSH_PHONE_COPY.tryAgain,
});

export function phoneActionLabel(action: PhoneAction): string {
  return ACTION_LABELS[action];
}

/**
 * The card's sentence and button. A hosted phone with no key waits for its once-a-day recovery
 * (US-014c), so only an own server is told to pair again; null (no answer yet) is 'checking'.
 */
export function phoneStatusView(status: PushStatus | null, context: PhoneContext): PhoneStatusView {
  if (!status) return CHECKING;
  if (status.kind === 'off') return OFF_VIEWS[status.reason];
  if (status.kind === 'operator_off') return view(PUSH_PHONE_COPY.operatorOff(context.serverName));
  if (status.kind === 'key_missing') {
    const own = context.source === 'own';
    return view(own ? PUSH_PHONE_COPY.keyMissingOwn : PUSH_PHONE_COPY.keyMissingHosted);
  }
  return FIXED_VIEWS[status.kind];
}

export type PhoneStatusInput = Readonly<{
  discovery: GateInput;
  /** The build's EAS project id (device-facts.ts), null when it has none. */
  projectId: string | null;
  /** The registrar's latest answer, and when the screen took it (epoch ms). */
  outcome: Pick<RegistrationOutcome, 'status' | 'facts'> | null;
  outcomeAt: number;
  /** GET /api/v1/mobile/devices's rows, and when they were read (epoch ms); null before. */
  devices: readonly Device[] | null;
  devicesAt: number;
}>;

/** This phone's row: the one the registrar last heard of, or the one its key was minted for. */
export function thisPhoneRow(
  outcome: Pick<RegistrationOutcome, 'facts'> | null,
  devices: readonly Device[] | null,
): Device | null {
  const id = outcome?.facts.serverRow?.deviceId ?? outcome?.facts.record?.deviceId;
  if (!id || !devices) return null;
  return devices.find((device) => device.id === id) ?? null;
}

export function phoneStatusOf(input: PhoneStatusInput): PushStatus | null {
  const { discovery, outcome } = input;
  const gated = gateStatus({
    capabilityPush: discovery?.capabilities.includes('push') ?? false,
    pushExpo: discovery?.push.expo === true,
    projectId: input.projectId,
  });
  if (gated) return gated;
  if (!outcome) return null;
  const row = thisPhoneRow(outcome, input.devices);
  if (!row || input.devicesAt < input.outcomeAt) return outcome.status;
  return pushStatus({ ...outcome.facts, serverRow: serverRowOf(row) });
}

export type SectionsShown = Readonly<{
  pushTypes: boolean;
  digest: boolean;
  /** "Send today's brief now" under the digest time: the digest's gates and digest_now. */
  digestNow: boolean;
  redact: boolean;
  faceId: true;
}>;

export function sectionsShown(discovery: GateInput): SectionsShown {
  const push = canPush(discovery);
  return Object.freeze({
    pushTypes: push,
    digest: digestShown(discovery),
    digestNow: digestNowShown(discovery),
    redact: push,
    faceId: true,
  });
}

export function screenHead(workspaceName: string) {
  return Object.freeze({
    eyebrow: PUSH_SETTINGS_COPY.eyebrow(workspaceName),
    title: PUSH_SETTINGS_COPY.title,
    lede: PUSH_SETTINGS_COPY.lede,
  });
}

/** A switch's state in a word beside it (§4.6: never only a colour). */
export function switchWord(on: boolean): string {
  return on ? PUSH_SETTINGS_COPY.on : PUSH_SETTINGS_COPY.off;
}

/** A switch's value while its write is out: what the person chose, until the server answers. */
export type Overrides = Readonly<Partial<Record<string, boolean>>>;

export type PushTypeSwitch = (typeof PUSH_TYPE_SWITCHES)[number];

export type PushTypeRow = Readonly<{
  key: PushTypeSwitch;
  label: string;
  detail: string;
  on: boolean;
  /** A write for this switch is out: it takes no tap until the server answers. */
  saving: boolean;
}>;

export function pushTypeRows(
  preferences: Preferences,
  overrides: Overrides = {},
): readonly PushTypeRow[] {
  const types = pushTypesOf(preferences);
  return Object.freeze(
    PUSH_TYPE_SWITCHES.map((key) => {
      const pending = overrides[key];
      return Object.freeze({
        key,
        ...PUSH_TYPE_COPY[key],
        on: pending ?? switchState(preferences.preferences, types[key]),
        saving: pending !== undefined,
      });
    }),
  );
}

export type DigestInput = Readonly<{
  preferences: Preferences;
  /** This phone's device row (thisPhoneRow), null when it has none. */
  row: Device | null;
  timeZone: string | null;
  overrides?: Overrides;
  /** The time being saved, shown until the server answers. */
  pendingTime?: string | null;
}>;

export type DigestView = Readonly<{
  on: boolean;
  saving: boolean;
  time: string;
  times: readonly string[];
  timeDisabled: boolean;
  zoneLine: string;
  phoneLine: string;
  /** Why the time cannot be chosen yet, in words; null when it can (or the switch says Off). */
  note: string | null;
}>;

/** The digest's time is this phone's row's: no active row, no time to choose (W1 PATCH). */
export function digestView({
  preferences,
  row,
  timeZone,
  overrides = {},
  pendingTime = null,
}: DigestInput): DigestView {
  const pending = overrides.digest;
  const on = pending ?? digestOn(preferences);
  const active = row?.status === ACTIVE_DEVICE_STATUS;
  return Object.freeze({
    on,
    saving: pending !== undefined,
    time: pendingTime ?? digestTimeOf(row),
    times: DIGEST_TIMES,
    timeDisabled: !on || !active || pendingTime !== null,
    zoneLine: PUSH_SETTINGS_COPY.digestZone(timeZone),
    phoneLine: PUSH_PREFS_COPY.digestPhone,
    note: active ? null : PUSH_SETTINGS_COPY.digestNoRow,
  });
}

export type RedactView = Readonly<{
  label: string;
  detail: string;
  on: boolean;
  /** Owners and admins only (W2 US-014b: workspace:manage); everyone else reads it. */
  editable: boolean;
  saving: boolean;
  note: string | null;
}>;

export function redactView(
  role: WorkspaceRole | null | undefined,
  workspacePush: Pick<WorkspacePush, 'redactQuestions'>,
  pending: boolean | null = null,
): RedactView {
  return Object.freeze({
    label: PUSH_SETTINGS_COPY.redactLabel,
    detail: PUSH_SETTINGS_COPY.redactDetail,
    on: pending ?? redactState(workspacePush),
    editable: canRedact(role) && pending === null,
    saving: pending !== null,
    note: redactNote(role),
  });
}

export type FaceIdView = Readonly<{ label: string; detail: string; note: string | null }>;

/** D19: checked on this phone only; a phone with no passcode is told nothing is asked. */
export function faceIdView(secure: boolean | null): FaceIdView {
  return Object.freeze({
    label: STEP_UP_SETTING_COPY.label,
    detail: STEP_UP_SETTING_COPY.detail,
    note: secure === false ? STEP_UP_SETTING_COPY.noSecurity : null,
  });
}
