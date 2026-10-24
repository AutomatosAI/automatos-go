// HUD's phone core (D54, US-018b), pure: what the core's words say, so the components only draw. The
// state chip is the vendored captionFor in capitals; the transcript is the turn's two rows, the
// user's words in quotes and Auto's with the cursor while he streams; the top bar's mic, status row,
// clock and command row (KS10); the three buttons (HOLD TO TALK inert until A6, STOP only while a
// turn streams); and the drawing's numbers. Props only: phase 2 (US-016k) maps A2's thread to a
// HudTurn. The chip, the status words and the transcript say everything the rings and the waveform
// show (the README's text twins).

import { captionFor } from '../../../core/web/lib/mascot/media';
import type { MascotName } from '../../../core/web/lib/mascot/types';
import { badgeText, commandCentreLabel } from '../../../ui/variants';
import type { AiLabelAgent } from '../../ai-label-state';
import { mascotGeometry } from '../../mascot/geometry';
import { HUD_CORE_COPY, HUD_STATE_WORDS } from '../../strings';
import { CORE_SIZE } from './ring-specs';
import { WAVE } from './waveform';

/** The drawing's phone core (390 x 844), in points. */
export const HUD_CORE = Object.freeze({
  /** The drawing's phone: the core keeps its share of the height on a shorter one. */
  frameHeight: 844,
  topBar: Object.freeze({ padY: 8, padX: 20, brandSize: 16 }),
  statusRow: Object.freeze({ padY: 6, padX: 20 }),
  commandRow: Object.freeze({ padY: 6, padX: 20, gap: 8, height: 34, padItem: 14, border: 1 }),
  core: Object.freeze({ size: CORE_SIZE.phone, marginTop: 14 }),
  /** Auto 104 in the 290 core, nudged down: translate(-50 %, -46 %). */
  mascot: Object.freeze({ size: 104, lift: 0.46 }),
  chip: Object.freeze({ marginTop: 10, padY: 5, padX: 12, border: 1 }),
  transcript: Object.freeze({
    padX: 24,
    gap: 12,
    you: Object.freeze({ size: 15, leading: 1.5 }),
    auto: Object.freeze({ size: 19, leading: 1.45 }),
    cursor: Object.freeze({ width: 9, height: 18, gap: 4, blinkMs: 1000 }),
  }),
  wave: Object.freeze({ padX: 20, bars: WAVE.phone.bars, height: WAVE.phone.height }),
  buttons: Object.freeze({
    padTop: 14,
    padX: 24,
    padBottom: 34,
    side: Object.freeze({ width: 64, height: 44, border: 1 }),
    talk: Object.freeze({ size: 84, border: 2, glow: 30 }),
  }),
  /** Geist Mono 11 at .1em (status, mic, TYPE, STOP), .12em (HOLD TO TALK), .16em (the chip). */
  tracking: Object.freeze({ mono: 0.1, talk: 0.12, chip: 0.16, brand: 0.18, row: 0.14 }),
  monoSize: 11,
  rowSize: 12,
});

/** The core's side on a screen this tall: 290, or its drawn share of a shorter screen. */
export function coreSizeFor(screenHeight: number): number {
  const { size } = HUD_CORE.core;
  if (!Number.isFinite(screenHeight) || screenHeight <= 0) return size;
  return Math.min(size, Math.floor((screenHeight * size) / HUD_CORE.frameHeight));
}

export type MascotPlace = { readonly size: number; readonly left: number; readonly top: number };

/**
 * Auto inside a core of this side: 104 in 290 (in step on a smaller core), his stage centred
 * across and lifted 46 % of its height above the centre (translate(-50 %, -46 %)).
 */
export function mascotPlace(coreSize: number): MascotPlace {
  const size = Math.max(1, Math.round((HUD_CORE.mascot.size * coreSize) / HUD_CORE.core.size));
  const { stage } = mascotGeometry(size);
  const centre = coreSize / 2;
  return Object.freeze({
    size,
    left: centre - stage.width / 2,
    top: centre - stage.height * HUD_CORE.mascot.lift,
  });
}

// ── The turn ─────────────────────────────────────────────────────────────────────────────────

/** The newest turn, as phase 2 maps it from A2's thread. */
export type HudTurn = {
  /** The user's last words; null before there are any. */
  readonly you: string | null;
  /** Auto's reply as plain text so far; null before he answers. */
  readonly auto: string | null;
  /** The reply is still coming: the cursor blinks, STOP is on, the clock runs. */
  readonly streaming: boolean;
  /** Who answers: Auto when absent; an agent picked for the conversation by name. */
  readonly agent?: AiLabelAgent;
  /** When the turn began and ended, in ms since the epoch: the status row's mm:ss. */
  readonly startedAt?: number | null;
  readonly endedAt?: number | null;
};

export const EMPTY_TURN: HudTurn = Object.freeze({ you: null, auto: null, streaming: false });

/** The answering agent's name: Auto, the picked agent's, or 'Agent' while it has none. */
export function agentName(agent: AiLabelAgent): string {
  if (!agent) return HUD_CORE_COPY.auto;
  return agent.name?.trim() || HUD_CORE_COPY.unnamedAgent;
}

// ── The state chip ───────────────────────────────────────────────────────────────────────────

export type ChipView = { readonly text: string; readonly label: string };

/** 'SEARCHING THE WEB'; VoiceOver reads the caption as written. */
export function chipView(state: MascotName, deliverableKind?: string): ChipView {
  const caption = captionFor(state, deliverableKind);
  return { text: caption.toUpperCase(), label: caption };
}

// ── The transcript ───────────────────────────────────────────────────────────────────────────

export type TranscriptRow =
  | { readonly who: 'you'; readonly text: string; readonly label: string }
  | {
      readonly who: 'auto';
      readonly text: string;
      readonly label: string;
      /** The 9 x 18 block cursor after the words, blinking while loops run. */
      readonly cursor: boolean;
    };

const clean = (words: string | null | undefined) => words?.trim() ?? '';

export function transcriptRows(turn: HudTurn): readonly TranscriptRow[] {
  const said = HUD_CORE_COPY;
  const you = clean(turn.you);
  const auto = clean(turn.auto);
  const name = agentName(turn.agent);
  const rows: TranscriptRow[] = [];
  if (you) rows.push({ who: 'you', text: said.quote(you), label: said.youLabel(you) });
  if (auto || turn.streaming) {
    const label = turn.streaming ? said.streamingLabel(name, auto) : said.autoLabel(name, auto);
    rows.push({ who: 'auto', text: auto, label, cursor: turn.streaming });
  }
  return Object.freeze(rows);
}

export type TranscriptAlign = 'center' | 'end';

/** Centred while it fits; past that the box shows the newest lines (the oldest go off the top). */
export function transcriptAlign(contentHeight: number, boxHeight: number): TranscriptAlign {
  return contentHeight > boxHeight ? 'end' : 'center';
}

// ── The top bar ──────────────────────────────────────────────────────────────────────────────

export type MicView = { readonly text: string; readonly live: boolean; readonly label: string };

/** '● MIC LIVE' in the accent whenever the mic is open (A6), else '○ MIC OFF' in text2. */
export function micView(micOpen: boolean): MicView {
  const said = HUD_CORE_COPY;
  return micOpen
    ? { text: said.micLive, live: true, label: said.micLiveLabel }
    : { text: said.micOff, live: false, label: said.micOffLabel };
}

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** mm:ss of a span ('02:14'); minutes past 99 keep counting. */
export function elapsedText(ms: number): string {
  const seconds = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / MS_PER_SECOND) : 0;
  return `${pad2(Math.floor(seconds / SECONDS_PER_MINUTE))}:${pad2(seconds % SECONDS_PER_MINUTE)}`;
}

/** How long the turn has run: to its end, or to now while it streams; 0 before it starts. */
export function turnElapsedMs(turn: HudTurn, now: number): number {
  if (turn.startedAt === null || turn.startedAt === undefined) return 0;
  const end = turn.endedAt ?? (turn.streaming ? now : turn.startedAt);
  return Math.max(0, end - turn.startedAt);
}

export type StatusRowView = { readonly text: string; readonly clock: string; readonly label: string };

/** 'AUTO · SEARCHING' and '02:14' (the row draws the words in capitals). */
export function statusRow(turn: HudTurn, state: MascotName, now: number): StatusRowView {
  const agent = agentName(turn.agent);
  const word = HUD_STATE_WORDS[state];
  const clock = elapsedText(turnElapsedMs(turn, now));
  return {
    text: HUD_CORE_COPY.status(agent, word).toUpperCase(),
    clock,
    label: HUD_CORE_COPY.statusLabel(agent, word, clock),
  };
}

export type CommandView = { readonly text: string; readonly label: string };

/** 'COMMAND · 6' (the badge's '99+' past the cap), 'COMMAND' at 0; VoiceOver hears the button's. */
export function commandView(needsYou: number): CommandView {
  const count = badgeText(needsYou);
  return {
    text: count === null ? HUD_CORE_COPY.command : HUD_CORE_COPY.commandCount(count),
    label: commandCentreLabel(needsYou),
  };
}

// ── The buttons ──────────────────────────────────────────────────────────────────────────────

export type HudButtonView = {
  readonly text: string;
  readonly label: string;
  readonly hint?: string;
  readonly disabled: boolean;
};

export type HudButtonsView = {
  readonly type: HudButtonView;
  readonly talk: HudButtonView;
  readonly stop: HudButtonView;
};

/** TYPE always; HOLD TO TALK inert in this wave (A6 gives it the voice); STOP while it streams. */
export function hudButtons(streaming: boolean): HudButtonsView {
  const said = HUD_CORE_COPY;
  return {
    type: { text: said.type, label: said.typeLabel, disabled: false },
    talk: { text: said.talk, label: said.talkLabel, hint: said.talkHint, disabled: true },
    stop: { text: said.stop, label: said.stopLabel, hint: said.stopHint, disabled: !streaming },
  };
}
