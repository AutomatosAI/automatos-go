// The rows this phone adds to "What Auto depends on" (PRD-268 §6.11.3, §6.12.5), pure: push from
// the registrar's status in the Notifications screen's own words (src/push/settings/view-model.ts),
// the microphone and speech recognition from the permission read and the recognizer's policy in the
// voice screen's words (src/voice/strings.ts), and the server voice from discovery's tts and the
// server's voice list. Ready, not checked (not read yet, or the read failed) or needs setup; a row a
// person can fix on this phone carries an in-app fix (Settings → Notifications, the voice screen),
// never an outside URL, and opening it asks for nothing: only a press on the voice screen asks.

import type { PushStatus } from '../push/registration/state';
import { pushScreens } from '../push/nav';
import { phoneStatusView, type PhoneContext } from '../push/settings/view-model';
import { spokenName } from '../voice/language/speak-language';
import { VOICE_SCREENS } from '../voice/nav';
import type { PermissionVerdict } from '../voice/permissions/permission-flow';
import { refusalCopyKey } from '../voice/quick-ask/recognition-policy';
import { PERMISSION_COPY, RECOGNITION_COPY } from '../voice/strings';
import type { ClientFacts, ServerVoiceFact, SpeechFacts } from './client-facts';
import type { ReadinessState } from './schema';
import { CLIENT_ROW_COPY } from './strings';

/** A fix the phone can open: its label and the app route it pushes. */
export type AppFix = Readonly<{ label: string; route: string }>;

/** One row before it is drawn: the server's item or the phone's own. */
export type RowInput = Readonly<{
  id: string;
  label: string;
  detail: string;
  state: ReadinessState;
  fix: AppFix | null;
}>;

/** The ids the phone answers for (§6.11.3); in the order they follow the server's items. */
export const CLIENT_ROW_IDS = ['push', 'microphone', 'speech', 'server_voice'] as const;
export type ClientRowId = (typeof CLIENT_ROW_IDS)[number];

const NOTIFICATIONS_FIX: AppFix = Object.freeze({
  label: CLIENT_ROW_COPY.openNotifications,
  route: pushScreens.notifications,
});

/** The voice screen: its notice opens the phone's Settings, its press asks, it offers a download. */
const VOICE_FIX: AppFix = Object.freeze({
  label: CLIENT_ROW_COPY.openVoice,
  route: VOICE_SCREENS.voice,
});

function row(
  id: ClientRowId,
  label: string,
  state: ReadinessState,
  detail: string,
  fix: AppFix | null = null,
): RowInput {
  return Object.freeze({ id, label, detail, state, fix });
}

/** Push: 'on' is ready; any other status needs setup, with Notifications when it offers a step. */
export function pushRow(status: PushStatus | null, context: PhoneContext): RowInput {
  const label = CLIENT_ROW_COPY.pushLabel;
  if (!status) return row('push', label, 'not_checked', CLIENT_ROW_COPY.notReadYet);
  const view = phoneStatusView(status, context);
  if (status.kind === 'on') return row('push', label, 'ready', view.sentence);
  return row('push', label, 'needs_setup', view.sentence, view.action ? NOTIFICATIONS_FIX : null);
}

/** The words for a permission the person must set up; null when it is granted. */
function permissionNeed(verdict: PermissionVerdict): Omit<RowInput, 'id' | 'label'> | null {
  switch (verdict.step) {
    case 'granted':
      return null;
    case 'ask':
      return { state: 'needs_setup', detail: CLIENT_ROW_COPY.notAskedYet, fix: VOICE_FIX };
    case 'settings': {
      const off = verdict.blocked === 'speech' ? PERMISSION_COPY.speechOff : PERMISSION_COPY.micOff;
      return { state: 'needs_setup', detail: off, fix: VOICE_FIX };
    }
    case 'restricted':
      return { state: 'needs_setup', detail: PERMISSION_COPY.restricted, fix: null };
  }
}

/** The microphone alone: ready when allowed. */
export function microphoneRow(verdict: PermissionVerdict | null): RowInput {
  const label = CLIENT_ROW_COPY.microphoneLabel;
  if (!verdict) return row('microphone', label, 'not_checked', CLIENT_ROW_COPY.notReadYet);
  const need = permissionNeed(verdict);
  if (!need) return row('microphone', label, 'ready', CLIENT_ROW_COPY.microphoneAllowed);
  return row('microphone', label, need.state, need.detail, need.fix);
}

/**
 * Speech recognition in the language hold to talk listens in: a blocked permission first (Screen
 * Time, or off in the phone's Settings), then a recognizer that is not ready (a model to download:
 * the voice screen offers it; none on this phone), then a permission not asked yet.
 */
export function speechRow(speech: SpeechFacts | null): RowInput {
  const label = CLIENT_ROW_COPY.speechLabel;
  if (!speech) return row('speech', label, 'not_checked', CLIENT_ROW_COPY.notReadYet);
  const { verdict, policy } = speech;
  const blocked = verdict.step === 'restricted' || verdict.step === 'settings';
  const need = permissionNeed(verdict);
  if (blocked && need) return row('speech', label, need.state, need.detail, need.fix);
  const language = spokenName(speech.locale);
  if (policy.kind !== 'ready') {
    const detail = RECOGNITION_COPY[refusalCopyKey(policy)](language);
    return row(
      'speech',
      label,
      'needs_setup',
      detail,
      policy.kind === 'download' ? VOICE_FIX : null,
    );
  }
  if (need) return row('speech', label, need.state, need.detail, need.fix);
  return row('speech', label, 'ready', CLIENT_ROW_COPY.speechReady(language));
}

const SERVER_VOICE_ROWS: Readonly<Record<ServerVoiceFact, [ReadinessState, string]>> =
  Object.freeze({
    off: ['needs_setup', CLIENT_ROW_COPY.serverVoiceOff],
    unanswered: ['not_checked', CLIENT_ROW_COPY.serverVoiceUnanswered],
    speaks: ['ready', CLIENT_ROW_COPY.serverVoiceOn],
    phone_chosen: ['ready', CLIENT_ROW_COPY.serverVoicePhoneChosen],
  });

/** Auto's server voice: discovery's tts and the server's voice list (no fix: a server's setting). */
export function serverVoiceRow(fact: ServerVoiceFact | null): RowInput {
  const label = CLIENT_ROW_COPY.serverVoiceLabel;
  if (!fact) return row('server_voice', label, 'not_checked', CLIENT_ROW_COPY.notReadYet);
  const [state, detail] = SERVER_VOICE_ROWS[fact];
  return row('server_voice', label, state, detail);
}

/** Every row this phone adds, in CLIENT_ROW_IDS' order. */
export function clientRows(facts: ClientFacts, context: PhoneContext): readonly RowInput[] {
  return Object.freeze([
    pushRow(facts.push, context),
    microphoneRow(facts.microphone),
    speechRow(facts.speech),
    serverVoiceRow(facts.serverVoice),
  ]);
}
