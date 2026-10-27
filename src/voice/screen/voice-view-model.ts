// The voice screen's words (KV8, US-019i): every word, state and switch on the voice screen, from
// the one reducer's state and what the last press read (the permission verdict and the recognition
// policy). Pure: no React, React Native or Expo; the screen only draws what voiceView returns.
//   The chip: what the screen is doing in capitals, the rings' and the waveform's text twin:
//   READY, LISTENING, the running tool's caption ('SEARCHING THE WEB') else THINKING, SPEAKING;
//   VOICE UNAVAILABLE when hold to talk cannot run (KV4, a viewer), MIC OFF when a permission
//   blocks it, ERROR for a failure. A turn under way keeps its phase's words to its end.
//   MIC LIVE is the reducer's micOpen, the recognizer's capture (KV5), never the button or the
//   phase; Auto shows 'listening' while it is open, else what A5's driver says.
//   HOLD TO TALK talks while held and sends on release; under a screen reader it toggles (TAP TO
//   TALK, TAP TO SEND). It is off for a viewer (D17) and on a phone too old for on-device
//   recognition; for anything else a press re-checks (a downloaded language, a permission turned
//   on in Settings). Nothing waits on the AI label (D73): it is not an input. TYPE stays for
//   everyone who may chat; STOP while the mic is held or Auto has the turn.
//   The line under the core, first that applies: a viewer's words; the error's; why the next hold
//   cannot start (a permission, the download offer, the reason); the reducer's message; 'See it in
//   the chat' when this turn's reply came with cards or receipts. The reason names the language hold
//   to talk listens in ("I speak", spokenName: 'Portuguese (Portugal)') and, for iOS's
//   'other-language', the iPhone's own.

import { ROLE_COPY } from '../../auth/strings';
import type { ThreadFailure } from '../../chat/controller/thread';
import { failureCopy } from '../../chat/view-model';
import type { MascotName } from '../../core/frozen/lib/mascot/types';
import {
  hasWords,
  type PermissionStep,
  type RecognizerFailure,
  type UnavailableReason,
  type VoiceErrorKind,
  type VoicePhase,
  type VoiceState,
} from '../machine/voice-state';
import { noticeText } from '../notice/ai-notice';
import { permissionNotice, type PermissionVerdict } from '../permissions/permission-flow';
import { spokenName } from '../language/speak-language';
import { refusalCopyKey, type RecognitionPolicy } from '../quick-ask/recognition-policy';
import type { QuickAskReply } from '../quick-ask/reply-text';
import {
  RECOGNITION_COPY,
  SEE_IN_CHAT,
  VOICE_CENTRE_COPY,
  VOICE_CHIP,
  VOICE_ERROR_COPY,
  VOICE_MESSAGE_COPY,
} from '../strings';

export type VoiceViewInput = {
  readonly state: VoiceState;
  /** The last press's recognition policy (the quick-ask snapshot's); null before any press. */
  readonly policy: RecognitionPolicy | null;
  /** The last permission verdict: a press's, or a read-only check at mount; null before either. */
  readonly permission: PermissionVerdict | null;
  readonly roleCanChat: boolean;
  /** VoiceOver or TalkBack is on: HOLD TO TALK toggles (KV5). */
  readonly screenReader: boolean;
  /** What A5's mascot driver shows for Auto (useMascot's driver.mascot.mascot). */
  readonly mascotState: MascotName;
  /** The language hold to talk listens in ("I speak"): the one the unavailable words name. */
  readonly locale: string;
  /** The phone's own locale (locale.ts phoneLocale); absent, the same as `locale`. */
  readonly phoneLocale?: string;
  /** Quick-ask's last reply (the snapshot's): 'See it in the chat' and the answering agent. */
  readonly reply?: QuickAskReply | null;
  /** A2's failure for a failed turn (the thread state's): its words, as the chat says them. */
  readonly failure?: ThreadFailure | null;
};

export type MessageKind =
  'viewer' | 'error' | 'unavailable' | 'download' | 'permission' | 'hint' | 'chat';

/** What the line's button does: Open Settings, download the language, open the conversation. */
export type MessageAction = 'openSettings' | 'download' | 'openChat';

export type VoiceMessageView = {
  readonly kind: MessageKind;
  readonly text: string;
  readonly action: MessageAction | null;
};

export type VoiceTranscriptView = {
  /** The user's words: the partial while listening, the final after; null before any. */
  readonly you: string | null;
  /** Auto's words so far, plain text; null before any. */
  readonly auto: string | null;
  /** The reply still streams: the cursor blinks after Auto's words. */
  readonly autoStreaming: boolean;
  /** The AI notice's own AUTO line, once per voice session (KV7); null otherwise. */
  readonly notice: string | null;
};

export type CentreView = {
  /** The button's words: HOLD TO TALK, RELEASE TO SEND, TAP TO TALK or TAP TO SEND. */
  readonly label: string;
  /** The same words as a screen reader says them. */
  readonly accessibilityLabel: string;
  readonly enabled: boolean;
  /** How to use it, or why it is off. */
  readonly hint: string;
  /** Under a screen reader the button toggles instead of being held. */
  readonly toggle: boolean;
};

export type VoiceView = {
  readonly chipWords: string;
  readonly chipLabel: string;
  readonly mic: 'live' | 'off';
  readonly mascot: MascotName;
  readonly transcript: VoiceTranscriptView;
  readonly centre: CentreView;
  readonly type: { readonly enabled: boolean };
  readonly stop: { readonly enabled: boolean };
  readonly message: VoiceMessageView | null;
};

type ChipKey = keyof typeof VOICE_CHIP;

/** Something that keeps hold to talk from working, or a failure: its chip and its line. */
type Trouble = { readonly chip: ChipKey; readonly message: VoiceMessageView };

/** How each error kind reads: hold to talk cannot run here, a permission is off, or a failure. */
type ErrorGroup = 'unavailable' | 'permission' | 'recognizer' | 'turn';

const ERROR_GROUPS: Readonly<Record<VoiceErrorKind, ErrorGroup>> = Object.freeze({
  'no-on-device': 'unavailable',
  'android-too-old': 'unavailable',
  'language-missing': 'unavailable',
  'no-recognizer': 'unavailable',
  'other-language': 'unavailable',
  'permission-settings': 'permission',
  'permission-restricted': 'permission',
  'mic-busy': 'recognizer',
  busy: 'recognizer',
  recognizer: 'recognizer',
  turn: 'turn',
});

/** Auto has the turn or the mic is held: STOP ends it. */
const STOPPABLE: ReadonlySet<VoicePhase> = new Set<VoicePhase>([
  'listening',
  'thinking',
  'speaking',
]);

function line(
  kind: MessageKind,
  text: string,
  action: MessageAction | null = null,
): VoiceMessageView {
  return Object.freeze({ kind, text, action });
}

function isUnavailable(kind: VoiceErrorKind): kind is UnavailableReason {
  return ERROR_GROUPS[kind] === 'unavailable';
}

function isRecognizerFailure(kind: VoiceErrorKind): kind is RecognizerFailure {
  return ERROR_GROUPS[kind] === 'recognizer';
}

function unavailableTrouble(reason: UnavailableReason, input: VoiceViewInput): Trouble {
  const words = RECOGNITION_COPY[refusalCopyKey({ kind: 'unavailable', reason })];
  const text = words(spokenName(input.locale), spokenName(input.phoneLocale ?? input.locale));
  return { chip: 'unavailable', message: line('unavailable', text) };
}

function permissionTrouble(verdict: PermissionVerdict): Trouble | null {
  const notice = permissionNotice(verdict);
  if (notice === null) return null;
  const action = notice.openSettings ? 'openSettings' : null;
  return { chip: 'micOff', message: line('permission', notice.text, action) };
}

/** The press's verdict when it is for this step, else the step alone (the recognizer's refusal). */
function verdictFor(step: PermissionStep, verdict: PermissionVerdict | null): PermissionVerdict {
  if (verdict !== null && verdict.step === step) return verdict;
  return { step, blocked: step === 'settings' ? 'microphone' : null, asked: false };
}

/** A2's failure when it is this turn's kind, else the kind's own words (failureCopy). */
function turnText(state: VoiceState, failure: ThreadFailure | null | undefined): string {
  if (failure && failure.kind === state.turnFailure) return failureCopy(failure).text;
  const kind = state.turnFailure ?? 'turn';
  const fallback: ThreadFailure =
    kind === 'turn' ? { kind, code: 'turn_failed' } : { kind, code: null };
  return failureCopy(fallback).text;
}

function errorTrouble(input: VoiceViewInput): Trouble | null {
  const kind = input.state.errorKind;
  if (kind === null) return null;
  if (isUnavailable(kind)) return unavailableTrouble(kind, input);
  if (isRecognizerFailure(kind))
    return { chip: 'error', message: line('error', VOICE_ERROR_COPY[kind]) };
  if (kind === 'turn')
    return { chip: 'error', message: line('error', turnText(input.state, input.failure)) };
  const step = kind === 'permission-restricted' ? 'restricted' : 'settings';
  return permissionTrouble(verdictFor(step, input.permission));
}

/** At rest: what the last check found that keeps the next hold from starting. */
function idleTrouble(input: VoiceViewInput): Trouble | null {
  const blocked = input.permission === null ? null : permissionTrouble(input.permission);
  if (blocked !== null) return blocked;
  const { policy } = input;
  if (policy === null || policy.kind === 'ready') return null;
  if (policy.kind === 'unavailable') return unavailableTrouble(policy.reason, input);
  const text = RECOGNITION_COPY.download(spokenName(policy.locale));
  return { chip: 'unavailable', message: line('download', text, 'download') };
}

function trouble(input: VoiceViewInput): Trouble | null {
  const { phase } = input.state;
  // A turn under way runs to its end, whoever may talk next.
  if (STOPPABLE.has(phase)) return null;
  if (!input.roleCanChat)
    return { chip: 'unavailable', message: line('viewer', ROLE_COPY.viewerReadOnly) };
  return phase === 'error' ? errorTrouble(input) : idleTrouble(input);
}

/** The chip while nothing is wrong: the phase, the running tool's words while Auto thinks. */
function phaseChip(state: VoiceState): { readonly words: string; readonly label: string } {
  if (state.phase === 'listening' || state.micOpen) return VOICE_CHIP.listening;
  if (state.phase === 'thinking' && state.toolCaption)
    return { words: state.toolCaption.toUpperCase(), label: state.toolCaption };
  if (state.phase === 'thinking') return VOICE_CHIP.thinking;
  if (state.phase === 'speaking') return VOICE_CHIP.speaking;
  return state.phase === 'error' ? VOICE_CHIP.error : VOICE_CHIP.ready;
}

/** The reply on screen came with cards or what Auto did, and it is this turn's. */
function chatLine(input: VoiceViewInput): VoiceMessageView | null {
  const { state, reply } = input;
  const ownTurn = state.phase !== 'listening' && (state.replyStreaming || state.replyFinished);
  if (!ownTurn || !reply || !(reply.hasCards || reply.hasReceipts)) return null;
  return line('chat', SEE_IN_CHAT, 'openChat');
}

function messageOf(input: VoiceViewInput, found: Trouble | null): VoiceMessageView | null {
  if (found !== null) return found.message;
  const { message } = input.state;
  if (message !== null) return line('hint', VOICE_MESSAGE_COPY[message]);
  return chatLine(input);
}

/** A phone below Android 13 never recognises on the phone: no press can help (KV4). */
function tooOld(input: VoiceViewInput): boolean {
  const { policy, state } = input;
  if (state.errorKind === 'android-too-old') return true;
  return policy?.kind === 'unavailable' && policy.reason === 'android-too-old';
}

/** Why HOLD TO TALK is off, or null while it is on. */
function centreOff(input: VoiceViewInput): string | null {
  if (!input.roleCanChat) return ROLE_COPY.viewerReadOnly;
  return tooOld(input) ? RECOGNITION_COPY.androidTooOld(spokenName(input.locale)) : null;
}

function centreView(input: VoiceViewInput): CentreView {
  const mode = input.screenReader ? VOICE_CENTRE_COPY.toggle : VOICE_CENTRE_COPY.hold;
  const words = input.state.phase === 'listening' ? mode.send : mode.talk;
  const off = centreOff(input);
  return Object.freeze({
    label: words.label,
    accessibilityLabel: words.spoken,
    enabled: off === null,
    hint: off ?? words.hint,
    toggle: input.screenReader,
  });
}

function transcriptView(input: VoiceViewInput): VoiceTranscriptView {
  const { state, reply } = input;
  const agent = reply?.agentName === undefined ? null : { name: reply.agentName };
  return Object.freeze({
    you: hasWords(state.heard) ? state.heard : null,
    auto: hasWords(state.reply) ? state.reply : null,
    autoStreaming: state.replyStreaming,
    notice: state.notice === 'greeting' ? noticeText(agent) : null,
  });
}

export function voiceView(input: VoiceViewInput): VoiceView {
  const { state } = input;
  const found = trouble(input);
  const chip = found === null ? phaseChip(state) : VOICE_CHIP[found.chip];
  return Object.freeze({
    chipWords: chip.words,
    chipLabel: chip.label,
    mic: state.micOpen ? 'live' : 'off',
    mascot: state.micOpen ? 'listening' : input.mascotState,
    transcript: transcriptView(input),
    centre: centreView(input),
    type: Object.freeze({ enabled: input.roleCanChat }),
    stop: Object.freeze({ enabled: STOPPABLE.has(state.phase) }),
    message: messageOf(input, found),
  });
}
