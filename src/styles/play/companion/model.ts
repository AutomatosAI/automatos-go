// Play's Companion (Ember 01-03, D54), pure: what the chat's pieces say, so the components only
// draw. Auto's row is Play's status word for his state with the vendored chatCaption's detail
// (else its caption) under it; a tool chip is the vendored toolLineLabel; "What Auto did" is the
// vendored receiptLine with the web's badges (frontend/components/play/chat/receipts.tsx at the
// pin, its behaviour reference); the composer's button follows A2's composerState shape; the
// header's Shelf and needs line, and the bottom bar's three places (KS10). Conversations' sections
// and times are conversations.ts's, re-exported here. Props only: nothing here fetches or imports
// from src/chat (phase 1); phase 2 feeds these from A2's thread and history.

import { chatCaption, type CaptionFacts } from '../../../core/web/components/play/chat/caption';
import {
  MARK_DONE,
  MARK_FAILED,
  MARK_MUTED,
  MARK_WAITING,
  toolDetail,
  toolLineLabel,
  type LineTone,
} from '../../../core/web/components/play/chat/labels';
import { receiptLine } from '../../../core/web/lib/chat/receipts';
import type { MascotName } from '../../../core/web/lib/mascot/types';
import type { HostToolCall } from '../../../core/web/lib/theme-sdk';
import type { Receipt } from '../../../core/web/types/chat';
import { routes } from '../../../navigation/routes';
import { commandCentreLabel } from '../../../ui/variants';
import { PLAY_CHAT_COPY, PLAY_STATUS, PLAY_TABS_COPY } from '../../strings';

export * from './conversations';

/** Ember's phone numbers for the Companion, in points. */
export const COMPANION = Object.freeze({
  /** Apple's least touch target; Ember's header buttons and the composer's button. */
  target: 44,
  /** A pressed text button or row dims to this. */
  pressedOpacity: 0.7,
  header: Object.freeze({ height: 56, paddingX: 8, buttonPaddingX: 12, buttonSize: 15 }),
  autoRow: Object.freeze({ gap: 14, detailSize: 12, wordGap: 2 }),
  chip: Object.freeze({
    radius: 8,
    size: 12,
    paddingX: 12,
    paddingY: 6,
    gap: 10,
    spinner: 11,
    spinnerStroke: 2,
    spinMs: 800,
  }),
  receipts: Object.freeze({ size: 12, leading: 1.7 }),
  report: Object.freeze({
    pad: 12,
    gap: 14,
    paperWidth: 64,
    paperHeight: 80,
    paperRadius: 5,
    paperPad: 8,
    paperTitle: 11,
    paperRule: 2,
    chartHeight: 22,
    barGap: 2,
    /** The three bars of the paper's chart, as fractions of its height; the last in the accent. */
    bars: Object.freeze([0.6, 0.45, 1]),
  }),
  bubble: Object.freeze({ maxWidth: 290, paddingX: 16, paddingY: 12, size: 15 }),
  caret: Object.freeze({ width: 2, height: 20, blinkMs: 530 }),
  /** A new message rises 12 pt and fades in over 180 ms (Ember README 'Motion'). */
  rise: Object.freeze({ distance: 12, durationMs: 180 }),
  composer: Object.freeze({
    fieldPadLeft: 18,
    fieldPad: 6,
    size: 16,
    buttonPaddingX: 18,
    stopPaddingX: 16,
    square: 10,
    squareRadius: 2,
    maxLines: 6,
    /** A viewer's notice over the field (A2's composerState). */
    noticeSize: 13,
  }),
  conversations: Object.freeze({ rowPaddingX: 10, rowPaddingY: 12, timeSize: 11, previewSize: 14 }),
  bar: Object.freeze({ itemHeight: 48, itemMinWidth: 96, dot: 6, size: 14 }),
  avatar: 44,
});

// ── Auto's row ─────────────────────────────────────────────────────────────────────────────────

/** Geist Mono for a running tool's input (a query, a page), Geist otherwise. */
export type DetailFace = 'mono' | 'sans';

export type PlayStatus = {
  /** Ember's word beside Auto: 'Searching.' */
  readonly word: string;
  /** The vendored chatCaption's detail, else its caption. */
  readonly detail: string;
  readonly detailFace: DetailFace;
};

export function playStatus(state: MascotName, facts: CaptionFacts = {}): PlayStatus {
  const said = chatCaption(state, facts);
  const input = toolDetail(facts.runningInput);
  const fromInput = said.detail !== undefined && said.detail === input;
  return {
    word: PLAY_STATUS[state],
    detail: said.detail ?? said.caption,
    detailFace: fromInput ? 'mono' : 'sans',
  };
}

// ── Tool chips ─────────────────────────────────────────────────────────────────────────────────

export type ToolChipView = {
  readonly key: string;
  /** running and waiting are the accent, done the chip's own, failed the error, muted faded. */
  readonly kind: LineTone;
  /** ✓, ✕, … or –; null while running (the chip shows its spinner). */
  readonly mark: string | null;
  readonly text: string;
  /** What VoiceOver reads: the state's word, then the words (the spinner's text twin). */
  readonly label: string;
};

const CHIP_WORDS: Readonly<Partial<Record<LineTone, string>>> = PLAY_CHAT_COPY.tool;

export function toolChip(call: HostToolCall, streaming: boolean): ToolChipView {
  const line = toolLineLabel(call, streaming);
  const word = CHIP_WORDS[line.tone];
  return {
    key: call.toolCallId,
    kind: line.tone,
    mark: line.mark,
    text: line.text,
    label: word ? `${word}: ${line.text}` : line.text,
  };
}

// ── What Auto did ──────────────────────────────────────────────────────────────────────────────

export type BadgeTone = 'accent' | 'error' | 'faded';

export type ReceiptRow = {
  readonly key: string;
  readonly mark: string;
  readonly text: string;
  readonly badge: string | null;
  readonly badgeTone: BadgeTone | null;
  /** A done write: Ember draws its line in the text colour, not text2. */
  readonly emphasis: boolean;
  /** What VoiceOver reads (A2's words for the status and the line); the line itself when absent. */
  readonly label?: string;
  /** The receipt opens something (A2's link): the line is a link. */
  readonly linked?: boolean;
};

const RECEIPT_MARKS: Readonly<Record<Receipt['status'], string>> = Object.freeze({
  done: MARK_DONE,
  refused: MARK_FAILED,
  skipped: MARK_MUTED,
  waiting: MARK_WAITING,
});

type Badge = { readonly text: string; readonly tone: BadgeTone };

/** The web's receiptBadge: Done for a done write, Not done for a refused call, Skipped. */
export function receiptBadge(receipt: Pick<Receipt, 'status' | 'kind'>): Badge | null {
  const said = PLAY_CHAT_COPY.receipts;
  if (receipt.status === 'refused') return { text: said.notDone, tone: 'error' };
  if (receipt.status === 'skipped') return { text: said.skipped, tone: 'faded' };
  return receipt.status === 'done' && receipt.kind === 'write'
    ? { text: said.done, tone: 'accent' }
    : null;
}

export function receiptRows(receipts: readonly Receipt[]): readonly ReceiptRow[] {
  return receipts.map((receipt, index) => {
    const badge = receiptBadge(receipt);
    return {
      key: `${index}:${receipt.action}`,
      mark: RECEIPT_MARKS[receipt.status],
      text: receiptLine(receipt),
      badge: badge?.text ?? null,
      badgeTone: badge?.tone ?? null,
      emphasis: receipt.status === 'done' && receipt.kind === 'write',
    };
  });
}

// ── The report card ────────────────────────────────────────────────────────────────────────────

/** 'Report · just now' (the label style draws it in capitals). */
export function reportEyebrow(
  kind: string = PLAY_CHAT_COPY.report.kind,
  when: string = PLAY_CHAT_COPY.report.justNow,
): string {
  return PLAY_CHAT_COPY.report.eyebrow(kind, when);
}

// ── The composer ───────────────────────────────────────────────────────────────────────────────

export type ComposerMode = 'send' | 'stop' | 'disabled';

/** A2's ComposerState as Play reads it (src/chat/composer/composer-state.ts; wired in US-016k). */
export type PlayComposerState = {
  readonly buttonMode: ComposerMode;
  readonly inputEditable: boolean;
  readonly placeholder?: string;
  readonly notice?: { readonly text: string } | null;
};

/** Before A2's state is wired: Send once something is typed. */
export function draftComposerState(text: string): PlayComposerState {
  return { buttonMode: text.trim() ? 'send' : 'disabled', inputEditable: true };
}

export type ComposerView = {
  readonly mode: ComposerMode;
  readonly editable: boolean;
  readonly placeholder: string;
  readonly label: string;
  readonly hint: string | undefined;
  /** The accent on First open (Ember 06), else the ground's text with its ink. */
  readonly fill: 'accent' | 'cream';
  /** Stop draws its 10 x 10 square. */
  readonly square: boolean;
  readonly disabled: boolean;
};

export function composerView(state: PlayComposerState, firstOpen = false): ComposerView {
  const said = PLAY_CHAT_COPY.composer;
  const stop = state.buttonMode === 'stop';
  return {
    mode: state.buttonMode,
    editable: state.inputEditable,
    placeholder: state.inputEditable ? said.placeholder : (state.placeholder ?? said.placeholder),
    label: stop ? said.stop : said.send,
    hint: stop ? said.stopHint : undefined,
    fill: firstOpen && !stop ? 'accent' : 'cream',
    square: stop,
    disabled: state.buttonMode === 'disabled',
  };
}

// ── The header ─────────────────────────────────────────────────────────────────────────────────

export type ShelfView = { readonly text: string; readonly fresh: boolean; readonly label: string };

/** 'Shelf', or 'Shelf +N' in the accent text when N Deliverables landed in this conversation. */
export function shelfView(count: number): ShelfView {
  const fresh = Number.isFinite(count) && count >= 1;
  const n = fresh ? Math.floor(count) : 0;
  const said = PLAY_CHAT_COPY;
  return { text: fresh ? said.shelfFresh(n) : said.shelf, fresh, label: said.shelfLabel(n) };
}

export type NeedsLineView = { readonly text: string; readonly link: string; readonly label: string };

/** The slim line under the header while the server's needs-you total is above zero (FR-4). */
export function needsLine(total: number): NeedsLineView | null {
  if (!Number.isFinite(total) || total < 1) return null;
  const n = Math.floor(total);
  const said = PLAY_CHAT_COPY;
  return {
    text: said.needs(n),
    link: `${said.needsLink} ${said.linkArrow}`,
    label: said.needsLabel(n),
  };
}

// ── The bottom bar ─────────────────────────────────────────────────────────────────────────────

export const PLAY_TABS = ['chats', 'shelf', 'centre'] as const;
export type PlayTab = (typeof PLAY_TABS)[number];

/** Where each place goes: the history, the Deliverables (Play's shelf), the Command Centre. */
export const PLAY_TAB_ROUTES: Readonly<Record<PlayTab, string>> = Object.freeze({
  chats: routes.chats,
  shelf: routes.cc.deliverables,
  centre: routes.cc.board,
});

export type TabView = {
  readonly tab: PlayTab;
  readonly text: string;
  readonly selected: boolean;
  /** The needs-you number on Centre (CountBadge draws nothing at 0). */
  readonly count: number;
  readonly label: string;
};

/** Each place's word; Centre says what it is and the needs-you number to VoiceOver. */
export function tabViews(active: PlayTab, needs: number): readonly TabView[] {
  return PLAY_TABS.map((tab) => ({
    tab,
    text: PLAY_TABS_COPY[tab],
    selected: tab === active,
    count: tab === 'centre' ? needs : 0,
    label: tab === 'centre' ? commandCentreLabel(needs) : PLAY_TABS_COPY[tab],
  }));
}
