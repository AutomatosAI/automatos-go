// The AI label's logic, pure (D-AI-LABEL, PRD-264 EUAI-11a): which words it says, and whether it
// can be seen. The words are the web's own (src/core/web/lib/ai-label/copy.ts, vendored). The
// visibility rule is the web's (frontend/lib/ai-label/visibility.ts @ the pinned SHA) for what a
// phone can measure: the label has been laid out, is not shrunk to nothing, and lies wholly inside
// the window. Until the first measurement it counts as hidden, so the composer waits for it.

import { AI_LABEL_PAUSED_TEXT, UNNAMED_AGENT, aiLabelText } from '../core/web/lib/ai-label/copy';

export { AI_LABEL_PAUSED_TEXT };

/** Who answers: Auto (null or undefined), or a picked agent whose name may not be loaded yet. */
export type AiLabelAgent = { readonly name?: string | null } | null | undefined;

/** "Auto is an AI", "{agent} is an AI", or "This agent is an AI" while the name is unknown. */
export function aiLabelWords(agent: AiLabelAgent): string {
  if (!agent) return aiLabelText(null);
  return aiLabelText(agent.name?.trim() || UNNAMED_AGENT);
}

/** A box narrower or shorter than this holds no readable text (visibility.ts MIN_LABEL_SIZE_PX). */
export const MIN_LABEL_SIZE = 4;
/** Rounding at the window's edge is not "outside" it (VIEWPORT_EDGE_TOLERANCE_PX). */
export const EDGE_TOLERANCE = 1;

/** The label's box in window coordinates (measureInWindow). */
export type LabelBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type WindowSize = { readonly width: number; readonly height: number };

export type AiLabelHiddenReason = 'detached' | 'size' | 'window';

/** Why the label can't be seen, or null when it can. */
export function aiLabelHiddenReason(
  box: LabelBox | null,
  window: WindowSize,
): AiLabelHiddenReason | null {
  if (box === null) return 'detached';
  const measured = [box.x, box.y, box.width, box.height].every(Number.isFinite);
  if (!measured) return 'detached';
  if (box.width < MIN_LABEL_SIZE || box.height < MIN_LABEL_SIZE) return 'size';
  const edge = EDGE_TOLERANCE;
  const inside =
    box.x >= -edge &&
    box.y >= -edge &&
    box.x + box.width <= window.width + edge &&
    box.y + box.height <= window.height + edge;
  return inside ? null : 'window';
}

export type AiLabelVisibility = {
  readonly box: LabelBox | null;
  readonly window: WindowSize;
  readonly visible: boolean;
};

export type AiLabelEvent =
  | { readonly type: 'layout'; readonly box: LabelBox }
  | { readonly type: 'window'; readonly window: WindowSize }
  | { readonly type: 'detach' };

function settle(box: LabelBox | null, window: WindowSize): AiLabelVisibility {
  return { box, window, visible: aiLabelHiddenReason(box, window) === null };
}

/** Not yet laid out: hidden. */
export function initialAiLabelVisibility(window: WindowSize): AiLabelVisibility {
  return settle(null, window);
}

/** A new measurement of the label or the window; detach when the label leaves the screen. */
export function aiLabelVisibilityReducer(
  state: AiLabelVisibility,
  event: AiLabelEvent,
): AiLabelVisibility {
  switch (event.type) {
    case 'layout':
      return settle(event.box, state.window);
    case 'window':
      return settle(state.box, event.window);
    case 'detach':
      return settle(null, state.window);
  }
}
