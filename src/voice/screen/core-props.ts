// The voice screen on A5's core (US-019j, D-ONE-VOICE), pure: what the voice view-model and the dress
// say, as HudCore's props. No React, React Native or Expo; VoiceScreen.tsx only draws what this
// returns, and every word still comes from the one reducer through voiceView (KV8).
//   The transcript is the view-model's: the user's words, Auto's, and the AI notice as its own line
//   above Auto's words, once per voice session (KV7); the AI label is A5's Transcript's first row.
//   Once the voice's reply is saved, the turn names it for Report this, as A2's thread offers it on
//   that message (voiceReportId, P001R-AF-1); before that, and while it streams, it names none.
//   HOLD TO TALK's words break after the first ('HOLD\nTO TALK', as A5 draws them in the circle);
//   it is lit while the mic is held. Under a screen reader one activation talks and the next sends.
//   The waveform stands at the recognizer's levels while the mic is open, newest last, the most
//   A5's phone waveform has bars for; null otherwise (the idle shimmer while Auto speaks).
//   Auto in the core shows what the voice is doing: listening, thinking (working while a tool runs),
//   at rest while he answers (as the chat's own reducer rests him once his words start), a snag;
//   in Arcade as its pixel sprite on the window-filled core (the dress's sprite and coreFill).
//   The line under the chip: the view-model's message, with its button (Open Settings, Download)
//   or, for 'See it in the chat', the button alone.

import type { ThreadState } from '../../chat/controller/thread';
import type { MascotName } from '../../core/frozen/lib/mascot/types';
import { reportableId } from '../../styles/homes/hud-turn';
import type { ChipView, HudTalk, HudTurn } from '../../styles/hud/core/model';
import { WAVEFORM_BARS } from '../config';
import type { VoicePhase, VoiceState } from '../machine/voice-state';
import { savedReplyId, type QuickAskReply } from '../quick-ask/reply-text';
import { DOWNLOAD_ACTION, PERMISSION_COPY, VOICE_SCREEN_COPY } from '../strings';
import type { VoiceDress } from './dress';
import type { MessageAction, MessageKind, VoiceMessageView, VoiceView } from './voice-view-model';

const MASCOT_FOR: Readonly<Record<VoicePhase, MascotName>> = Object.freeze({
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'idle',
  error: 'oops',
});

/** Auto in the core: the voice's phase as his state; 'working' while a tool runs. */
export function phaseMascot(state: VoiceState): MascotName {
  if (state.phase === 'thinking' && state.toolCaption) return 'working';
  return MASCOT_FOR[state.phase];
}

/** The voice's saved reply, where A2's thread offers Report this on it; null otherwise. */
export function voiceReportId(state: ThreadState, reply: QuickAskReply | null): string | null {
  return reportableId(state, savedReplyId(state, reply));
}

/**
 * The newest voice turn as A5's transcript draws it, with the answering agent for the AI label and
 * `reportId` (voiceReportId) naming Auto's saved reply while his words are on screen.
 */
export function voiceTurn(
  view: VoiceView,
  reply: QuickAskReply | null,
  reportId: string | null = null,
): HudTurn {
  const { you, auto, autoStreaming, notice } = view.transcript;
  const words = [notice, auto].filter((part): part is string => part !== null).join('\n');
  const named = reply?.agentName;
  return Object.freeze({
    you,
    auto: words === '' ? null : words,
    streaming: autoStreaming,
    autoMessageId: auto === null || autoStreaming ? null : reportId,
    agent: named === undefined ? null : Object.freeze({ name: named }),
  });
}

/** The circle's words on two lines: 'HOLD TO TALK' → 'HOLD\nTO TALK'. */
export function centreText(label: string): string {
  return label.replace(' ', '\n');
}

/** Under a screen reader, an activation sends while the mic is held and talks otherwise. */
export function toggleStep(phase: VoicePhase): 'press' | 'release' {
  return phase === 'listening' ? 'release' : 'press';
}

export type HoldHandlers = Pick<HudTalk, 'onPressIn' | 'onPressOut' | 'onToggle'>;

export function talkProps(view: VoiceView, phase: VoicePhase, hold: HoldHandlers): HudTalk {
  const { centre } = view;
  return Object.freeze({
    text: centreText(centre.label),
    label: centre.accessibilityLabel,
    hint: centre.hint,
    enabled: centre.enabled,
    active: phase === 'listening',
    toggle: centre.toggle,
    ...hold,
  });
}

/** The chip's words and what a screen reader says (the status row's word too). */
export function voiceChip(view: VoiceView): ChipView {
  return Object.freeze({ text: view.chipWords, label: view.chipLabel });
}

const clampLevel = (level: number) =>
  Number.isFinite(level) ? Math.min(Math.max(level, 0), 1) : 0;

/** The waveform's run: the new level appended (the oldest dropped past `bars`); null when closed. */
export function nextLevels(
  levels: readonly number[] | null,
  level: number | null,
  bars: number = WAVEFORM_BARS,
): readonly number[] | null {
  if (level === null) return null;
  return Object.freeze([...(levels ?? []), clampLevel(level)].slice(-bars));
}

/** HudCore's voice props but the line: the dress's paint and the view's words and switches. */
export type VoiceCoreProps = {
  readonly ringLine: string;
  readonly overlay: boolean;
  readonly mascotInCore: boolean;
  /** Auto in the core is Arcade's pixel sprite (the dress's). */
  readonly sprite: boolean;
  /** The disc inside the rings (the dress's): Arcade's window, clear elsewhere. */
  readonly coreFill: string;
  readonly chip: ChipView;
  readonly talk: HudTalk;
  readonly stopEnabled: boolean;
  readonly typeEnabled: boolean;
  readonly menuLabel: string;
  readonly lookHint: string;
};

export type VoiceCoreInput = {
  readonly view: VoiceView;
  readonly phase: VoicePhase;
  readonly dress: VoiceDress;
  readonly hold: HoldHandlers;
};

export function voiceCoreProps({ view, phase, dress, hold }: VoiceCoreInput): VoiceCoreProps {
  return Object.freeze({
    ringLine: dress.ringLine,
    overlay: dress.overlay,
    mascotInCore: dress.mascotInCore,
    sprite: dress.sprite,
    coreFill: dress.coreFill,
    chip: voiceChip(view),
    talk: talkProps(view, phase, hold),
    stopEnabled: view.stop.enabled,
    typeEnabled: view.type.enabled,
    menuLabel: VOICE_SCREEN_COPY.close,
    lookHint: VOICE_SCREEN_COPY.lookHint,
  });
}

export type VoiceLineButton = { readonly label: string; readonly action: MessageAction };

export type VoiceLine = {
  readonly kind: MessageKind;
  /** The words; null when the button says them ('See it in the chat'). */
  readonly text: string | null;
  readonly button: VoiceLineButton | null;
};

const BUTTON_LABELS: Readonly<Record<Exclude<MessageAction, 'openChat'>, string>> = Object.freeze({
  openSettings: PERMISSION_COPY.openSettings,
  download: DOWNLOAD_ACTION,
});

/** The line under the chip: the message's words and its button; null when there is none. */
export function voiceLine(message: VoiceMessageView | null): VoiceLine | null {
  if (message === null) return null;
  const { kind, text, action } = message;
  if (action === null) return Object.freeze({ kind, text, button: null });
  if (action === 'openChat')
    return Object.freeze({ kind, text: null, button: { label: text, action } });
  return Object.freeze({ kind, text, button: { label: BUTTON_LABELS[action], action } });
}
