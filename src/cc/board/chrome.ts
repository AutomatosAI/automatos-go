// The Board's paints and sizes, pure (handoff §2 'Board', D-ONE-SET): every value the filter row,
// the list and the ticket card draw with is a token key or a named size here, so BoardTab and
// TicketCard only wire and A5 can dress them for Play and HUD in one place. The handoff's 9.5 and
// 10 px mono runs are the 11 pt label (D38).

import type { ColourName, RadiusName, SpaceName } from '../../styles/tokens';
import type { TextLevel, TextTone } from '../../ui/variants';

/** The tab: 14 pt over the pills, 12 between the pills and the list, 18 in, 28 under the last card. */
export const BOARD_LAYOUT = Object.freeze({
  paddingTop: 'space6' as SpaceName,
  gap: 'space5' as SpaceName,
  paddingX: 'space8' as SpaceName,
  paddingBottom: 'space10' as SpaceName,
  /** Between two pills, and between two cards. */
  pillGap: 'space2' as SpaceName,
  cardGap: 'space3' as SpaceName,
  /** The pull-to-refresh spinner. */
  spinner: 'mutedForeground' as ColourName,
});

/** The card: 11 × 13 in, 7 between its rows; the kind row in the muted label, priority in accent. */
export const TICKET_CARD = Object.freeze({
  paddingY: 11,
  paddingX: 13,
  rowGap: 7,
  kindGap: 'space2' as SpaceName,
  kindTone: 'muted' as TextTone,
  priorityTone: 'accent' as TextTone,
  kindIconSize: 11,
  kindIconColour: 'mutedForeground' as ColourName,
  titleLevel: 5 as TextLevel,
  footGap: 'space2' as SpaceName,
});

/** A tag: 2 pt radius on --secondary, the mono label as written (the handoff does not shout tags). */
export const TICKET_TAG = Object.freeze({
  radius: 'tag' as RadiusName,
  ground: 'secondary' as ColourName,
  tone: 'muted' as TextTone,
  paddingX: 'space2' as SpaceName,
  paddingY: 1,
  textCase: 'none' as const,
});

/** The agent: an 8 pt square swatch, 2 pt radius, and the name at Body 6, 500, muted. */
export const TICKET_AGENT = Object.freeze({
  swatchSize: 8,
  swatchRadius: 'tag' as RadiusName,
  gap: 5,
  level: 6 as TextLevel,
  weight: 500 as const,
  tone: 'muted' as TextTone,
});

/**
 * The agents' swatches: five tokens that read apart in Light and Dark (the chart set), picked by
 * the agent's name so one agent keeps one colour on every card. The web keeps a table of its
 * roster's names (agent-tones.ts) in literal colours; the phone cannot carry literals, so it
 * folds the name onto tokens instead. No agent: the web's muted swatch.
 */
export const AGENT_SWATCHES: readonly ColourName[] = Object.freeze([
  'chart1',
  'chart2',
  'chart3',
  'chart4',
  'chart5',
]);
export const NO_AGENT_SWATCH: ColourName = 'mutedForeground';
