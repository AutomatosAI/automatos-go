// Receipts and tool lines as the thread draws them (US-008c), pure: 'What Auto did' and the calls
// Auto made, in the web's words (the vendored receipts.ts, Play's labels.ts) with Play's marks on
// Studio's tokens. Every mark has a word for screen readers (§4.6). A receipt's link is mapped by
// the foundation's appRouteForWebLink, so it opens an app screen or Studio, never another site.

import {
  MARK_DONE,
  MARK_FAILED,
  MARK_MUTED,
  MARK_WAITING,
  toolLineLabel,
  toolStatusOf,
  type LineTone,
} from '../core/frozen/components/play/chat/labels';
import {
  NO_ACTIONS,
  NOTHING_ON_THE_BOARD,
  movedSomethingOnTheBoard,
  receiptLine,
  safeLink,
} from '../core/web/lib/chat/receipts';
import type { Receipt, ToolCall } from '../core/web/types';
import { appRouteForWebLink, type WebLinkTarget } from '../navigation/web-links';
import type { ColourName } from '../styles/tokens';
import { joinLabel } from '../ui/paint';
import { RECEIPT_BADGES, RECEIPT_STATUS_WORDS, TOOL_STATUS_WORDS } from './strings';

export type LineOptions = {
  /** Studio's base URL for links the phone has no screen for (EXPO_PUBLIC_WEB_URL by default). */
  readonly webUrl?: string;
};

export type ReceiptRow = {
  readonly key: string;
  readonly status: Receipt['status'];
  readonly mark: string;
  readonly tone: LineTone;
  readonly text: string;
  /** Play's tag beside the line: Done, Not done or Skipped. */
  readonly badge: string | null;
  readonly link: WebLinkTarget | null;
  readonly accessibilityLabel: string;
};

export type ReceiptsView = {
  readonly lines: readonly ReceiptRow[];
  /** NO_ACTIONS, NOTHING_ON_THE_BOARD, or none when a card on the board moved. */
  readonly note: string | null;
};

export type ToolLineRow = {
  readonly key: string;
  /** null while the call runs: the line shows a spinner. */
  readonly mark: string | null;
  readonly tone: LineTone;
  readonly text: string;
  readonly accessibilityLabel: string;
};

/** The token a mark is painted in: Play's tones on Studio's colours (the handoff's markColor). */
export const MARK_COLOURS: Readonly<Record<LineTone, ColourName>> = Object.freeze({
  running: 'accent',
  done: 'olive',
  failed: 'destructive',
  waiting: 'accent',
  muted: 'mutedForeground',
});

const RECEIPT_LOOK: Readonly<
  Record<Receipt['status'], { readonly mark: string; readonly tone: LineTone }>
> = Object.freeze({
  done: { mark: MARK_DONE, tone: 'done' },
  refused: { mark: MARK_FAILED, tone: 'failed' },
  skipped: { mark: MARK_MUTED, tone: 'muted' },
  waiting: { mark: MARK_WAITING, tone: 'waiting' },
});

/** The status word, then the line; the word alone is left out when the line already says it. */
function spoken(word: string, text: string): string {
  return text.toLowerCase().includes(word.toLowerCase()) ? text : joinLabel(word, text);
}

/** Play's receiptBadge: a done write says Done, a refused call Not done, a skipped one Skipped. */
export function receiptBadge(receipt: Receipt): string | null {
  if (receipt.status === 'refused') return RECEIPT_BADGES.refused;
  if (receipt.status === 'skipped') return RECEIPT_BADGES.skipped;
  return receipt.status === 'done' && receipt.kind === 'write' ? RECEIPT_BADGES.done : null;
}

function receiptRow(receipt: Receipt, index: number, options: LineOptions): ReceiptRow {
  const look = RECEIPT_LOOK[receipt.status];
  const text = receiptLine(receipt);
  const path = safeLink(receipt.link);
  return {
    key: `${index}-${receipt.action}`,
    status: receipt.status,
    mark: look.mark,
    tone: look.tone,
    text,
    badge: receiptBadge(receipt),
    link: path === null ? null : appRouteForWebLink(path, options.webUrl),
    accessibilityLabel: spoken(RECEIPT_STATUS_WORDS[receipt.status], text),
  };
}

/** 'What Auto did': null for a reply from before receipts, which shows none (receipts.tsx). */
export function receiptsView(
  receipts: readonly Receipt[] | undefined,
  options: LineOptions = {},
): ReceiptsView | null {
  if (!receipts) return null;
  const note =
    receipts.length === 0
      ? NO_ACTIONS
      : movedSomethingOnTheBoard([...receipts])
        ? null
        : NOTHING_ON_THE_BOARD;
  return { lines: receipts.map((receipt, index) => receiptRow(receipt, index, options)), note };
}

/** One line per tool call; `streaming`: the reply is being written, so a running call spins. */
export function toolLineRows(calls: readonly ToolCall[], streaming: boolean): ToolLineRow[] {
  return calls.map((call) => {
    const host = { ...call, skipped: call.skipped ?? false, waiting: call.waiting ?? false };
    const label = toolLineLabel(host, streaming);
    const word = TOOL_STATUS_WORDS[toolStatusOf(host, streaming)];
    return {
      key: call.toolCallId,
      mark: label.mark,
      tone: label.tone,
      text: label.text,
      accessibilityLabel: spoken(word, label.text),
    };
  });
}
