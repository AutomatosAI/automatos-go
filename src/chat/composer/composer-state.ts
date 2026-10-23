// The composer's state, pure (US-009a; D-COMPOSER, D-AI-LABEL, D-ROLES): what its one round button
// does (send, stop, or nothing yet), whether the pill takes typing, its placeholder, and the notice
// above it. Return never sends: it inserts a newline, and the button is the only way to send.
//
// The order is the web's. A viewer reads the thread and never writes to it (D17). While the AI label
// can't be seen every control is off, Stop included (the web's ai-label-fence.tsx), and before its
// first measurement the composer is held without a notice, so the paused words never flash as a
// screen opens. A role not yet read offers nothing (roleCan). Then a reply in flight turns the
// button into Stop while the pill still takes the next message; an upload or a thread still opening
// holds the send; and a blank message with nothing attached has nothing to send.

import type { WorkspaceRole } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import { ROLE_COPY } from '../../auth/strings';
import { AI_LABEL_PAUSED_TEXT } from '../../styles/ai-label-state';
import { COMPOSER_COPY } from '../strings';

export type ComposerButtonMode = 'send' | 'stop' | 'disabled';

export type ComposerInput = {
  readonly text: string;
  /** A reply is streaming, or a reopened chat's turn is still in flight (the thread's canStop). */
  readonly streaming: boolean;
  readonly role: WorkspaceRole | null | undefined;
  readonly aiLabelVisible: boolean;
  /** false until the label's first measurement is in (useLabelFence); true when omitted. */
  readonly aiLabelChecked?: boolean;
  /** A file is still uploading: the message waits for it (US-009b). */
  readonly uploading: boolean;
  /** Files uploaded and ready to go with the message (US-009b); none when omitted. */
  readonly attachments?: number;
  /** The thread is still being opened (its stale-id check or saved list): it takes no send yet. */
  readonly loading?: boolean;
};

/** 'paused' is drawn by the foundation's AiLabelPaused, in the label's fixed colours. */
export type ComposerNotice = { readonly kind: 'paused' | 'viewer'; readonly text: string };

export type ComposerState = {
  readonly buttonMode: ComposerButtonMode;
  readonly inputEditable: boolean;
  readonly placeholder: string;
  readonly notice: ComposerNotice | null;
};

/** How long after the label's first layout a missing measurement counts as hidden (the web's 400). */
export const LABEL_SETTLE_MS = 400;

const OFF = Object.freeze({ buttonMode: 'disabled', inputEditable: false }) as Pick<
  ComposerState,
  'buttonMode' | 'inputEditable'
>;

/** The composer switched off, and why: the viewer's words, the paused label's, or none. */
function switchedOff(input: ComposerInput): ComposerState | null {
  if (input.role && !roleCan(input.role, 'chat')) {
    return {
      ...OFF,
      placeholder: COMPOSER_COPY.readOnlyPlaceholder,
      notice: { kind: 'viewer', text: ROLE_COPY.viewerReadOnly },
    };
  }
  if (!input.aiLabelVisible) {
    const checked = input.aiLabelChecked ?? true;
    const notice = checked ? ({ kind: 'paused', text: AI_LABEL_PAUSED_TEXT } as const) : null;
    return { ...OFF, placeholder: COMPOSER_COPY.placeholder, notice };
  }
  if (!roleCan(input.role, 'chat')) {
    return { ...OFF, placeholder: COMPOSER_COPY.placeholder, notice: null };
  }
  return null;
}

/** The words a send carries: what was typed, without the blank lines and spaces around it. */
export function outgoingText(text: string): string {
  return text.trim();
}

function buttonMode(input: ComposerInput): ComposerButtonMode {
  if (input.streaming) return 'stop';
  if (input.uploading || input.loading) return 'disabled';
  const hasFiles = (input.attachments ?? 0) > 0;
  return outgoingText(input.text) || hasFiles ? 'send' : 'disabled';
}

export function composerState(input: ComposerInput): ComposerState {
  const off = switchedOff(input);
  if (off) return off;
  return {
    buttonMode: buttonMode(input),
    inputEditable: true,
    placeholder: COMPOSER_COPY.placeholder,
    notice: null,
  };
}

/** The button's icon, VoiceOver name and hint: Stop says what it stops; disabled is a dim send. */
export function composerButton(mode: ComposerButtonMode) {
  if (mode === 'stop') {
    return { icon: 'stop', label: COMPOSER_COPY.stop, hint: COMPOSER_COPY.stopHint } as const;
  }
  return { icon: 'send', label: COMPOSER_COPY.send, hint: undefined } as const;
}

// ── The pill (the handoff's 2j input: 42 tall, 21 radius, 16 side padding) ───────────────────

export const PILL_INPUT = Object.freeze({
  minHeight: 42,
  border: 1,
  paddingX: 16,
  /** The pill grows with the message up to this many lines, then scrolls. */
  maxLines: 6,
});

export type PillMetrics = {
  readonly minHeight: number;
  readonly maxHeight: number;
  readonly radius: number;
  readonly paddingVertical: number;
  readonly paddingHorizontal: number;
};

/** One line sits centred in the 42 pt pill; the radius stays the pill's as more lines grow it. */
export function pillMetrics(lineHeight: number): PillMetrics {
  const { minHeight, border, paddingX, maxLines } = PILL_INPUT;
  const paddingVertical = Math.max(0, (minHeight - 2 * border - lineHeight) / 2);
  return {
    minHeight,
    maxHeight: maxLines * lineHeight + 2 * (paddingVertical + border),
    radius: minHeight / 2,
    paddingVertical,
    paddingHorizontal: paddingX,
  };
}
