// The Questions' paints and sizes, pure (handoff §2 'Questions', D-ONE-SET): every value the tab and
// the question card draw with is a token key or a named size here, so QuestionsTab and QuestionCard
// only wire and A5 can dress them for Play and HUD in one place. The handoff's 11 and 11.5 px runs
// are Body 6 (11.5), its 12 px Body 5 (D38: nothing under 11 pt).

import type { ColourName, RadiusName, SpaceName } from '../../styles/tokens';
import type { TextLevel, TextTone } from '../../ui/variants';

/** The tab: 14 pt over the first card, 18 in, 10 between cards, 28 under the last. */
export const QUESTIONS_LAYOUT = Object.freeze({
  paddingTop: 'space6' as SpaceName,
  paddingX: 'space8' as SpaceName,
  paddingBottom: 'space10' as SpaceName,
  cardGap: 'space4' as SpaceName,
  /** The read-only reason over the list. */
  noteLevel: 5 as TextLevel,
  noteTone: 'muted' as TextTone,
  noteGap: 'space5' as SpaceName,
  spinner: 'mutedForeground' as ColourName,
});

/** The card: 13 × 14 in, a 10 pt panel radius, 10 between its blocks. */
export const QUESTION_CARD = Object.freeze({
  paddingY: 13,
  paddingX: 'space6' as SpaceName,
  radius: 'panel' as const,
  gap: 'space4' as SpaceName,
});

/** Who asked · the ticket: the bot icon, the agent at 500, the ticket link muted, Body 5 (12). */
export const QUESTION_HEAD = Object.freeze({
  iconSize: 14,
  iconColour: 'mutedForeground' as ColourName,
  gap: 'space2' as SpaceName,
  level: 5 as TextLevel,
  agentWeight: 500 as const,
  tone: 'muted' as TextTone,
});

/** The question: Body 1 (14 / 1.5), 8 between paragraphs. */
export const QUESTION_TEXT = Object.freeze({
  level: 1 as TextLevel,
  gap: 'space3' as SpaceName,
});

/** 'Blocking N downstream tasks': 7 × 9 in, 4 pt radius, the muted ground, its rows at Body 6. */
export const CASCADE_BOX = Object.freeze({
  paddingY: 7,
  paddingX: 9,
  radius: 'segment' as RadiusName,
  border: 'border' as ColourName,
  borderAlpha: 0.7,
  ground: 'muted' as ColourName,
  groundAlpha: 0.35,
  gap: 3,
  level: 6 as TextLevel,
  titleWeight: 500 as const,
  tone: 'muted' as TextTone,
  iconSize: 12,
  iconColour: 'mutedForeground' as ColourName,
  rowGap: 5,
});

/** The controls: 9 between rows, 8 between option buttons and between the action buttons. */
export const QUESTION_CONTROLS = Object.freeze({
  gap: 9,
  optionGap: 'space3' as SpaceName,
  /**
   * Between wrapped rows of options: 14, so two 30 pt buttons' 7 pt slops meet and never overlap
   * (an option answers at once, so a mis-hit sends the wrong answer).
   */
  optionRowGap: 'space6' as SpaceName,
  actionGap: 'space3' as SpaceName,
  /** What dismissing does, over Keep and Dismiss. */
  effectLevel: 5 as TextLevel,
  effectTone: 'muted' as TextTone,
});
