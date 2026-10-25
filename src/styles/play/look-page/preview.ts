// The look page's live preview (US-017e, 'Automatos Play Looks.dc.html'), pure: the sample the
// design draws in the look being edited — Auto celebrating, the user's question, the two tool
// chips ('✓ Searched the web · 5 results', '✓ Made a report'), his reply and the report card. The
// chips are Play's done chips (companion/model.ts ToolChipView) with the vendored done mark, so
// they read as the real thread's do.

import { MARK_DONE } from '../../../core/web/components/play/chat/labels';
import type { MascotName } from '../../../core/web/lib/mascot/types';
import { PLAY_CHAT_COPY, PLAY_LOOK_COPY } from '../../strings';
import type { ToolChipView } from '../companion/model';

/** The design's Auto in the preview: 'Ta-da.' */
export const PREVIEW_STATE: MascotName = 'celebrate';

function doneChip(key: string, text: string): ToolChipView {
  const label = `${PLAY_CHAT_COPY.tool.done}: ${text}`;
  return Object.freeze({ key, kind: 'done', mark: MARK_DONE, text, label });
}

export const PREVIEW_CHIPS: readonly ToolChipView[] = Object.freeze([
  doneChip('searched', PLAY_LOOK_COPY.preview.searched),
  doneChip('report', PLAY_LOOK_COPY.preview.report),
]);
