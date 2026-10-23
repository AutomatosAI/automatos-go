// The Deliverables gallery's paints and sizes, pure (handoff §2 'Deliverables', D-ONE-SET): every
// value the tab, the filters and the card draw with is a token key or a named size here, so
// DeliverablesTab and DeliverableCard only wire and A5 can dress them for Play and HUD in one place.
// The handoff's 9.5 and 10.5 px mono runs are the 11 pt label (D38).

import type { ColourName, RadiusName, SpaceName } from '../../styles/tokens';
import type { TextLevel, TextTone } from '../../ui/variants';

/** The tab: 14 pt over the pills, 18 in, 10 between the pills and the list and between cards. */
export const GALLERY_LAYOUT = Object.freeze({
  paddingTop: 'space6' as SpaceName,
  paddingX: 'space8' as SpaceName,
  paddingBottom: 'space10' as SpaceName,
  gap: 'space4' as SpaceName,
  pillGap: 'space2' as SpaceName,
  cardGap: 'space4' as SpaceName,
  /** 'Load more' under the last card. */
  footerGap: 'space6' as SpaceName,
  /** The pull-to-refresh spinner. */
  spinner: 'mutedForeground' as ColourName,
});

/** The card: 13 × 14 in, the 10 pt panel radius, 8 between its rows. */
export const DELIVERABLE_CARD = Object.freeze({
  paddingY: 13,
  paddingX: 'space6' as SpaceName,
  radius: 'panel' as const,
  gap: 'space3' as SpaceName,
  /** The type row: the icon and the type in the muted label, 7 apart. */
  typeGap: 7,
  iconSize: 14,
  iconColour: 'mutedForeground' as ColourName,
  typeTone: 'muted' as TextTone,
  /** The serif title at Title 4 (15), the excerpt at Body 4 (12.5) muted, up to three lines. */
  titleLevel: 4 as TextLevel,
  excerptLevel: 4 as TextLevel,
  excerptTone: 'muted' as TextTone,
  excerptLines: 3,
  /** Who made it and when, in the mono label as written ('Scout · 08:06', not shouted). */
  metaTone: 'muted' as TextTone,
  metaCase: 'none' as const,
});

/**
 * One Deliverable's page (US-013b): 18 in and 12 between blocks, the serif title at Title 2 (23)
 * as the ticket sheet's, running text at Body 2 (13.5) with 10 between paragraphs, code and data in
 * the mono label as written, notes at Body 3 (13) muted, an image no taller than 520.
 */
export const DELIVERABLE_PAGE = Object.freeze({
  paddingTop: 'space4' as SpaceName,
  paddingX: 'space8' as SpaceName,
  paddingBottom: 'space10' as SpaceName,
  gap: 'space5' as SpaceName,
  headGap: 'space3' as SpaceName,
  paragraphGap: 'space4' as SpaceName,
  titleLevel: 2 as TextLevel,
  textLevel: 2 as TextLevel,
  monoCase: 'none' as const,
  noteLevel: 3 as TextLevel,
  noteTone: 'muted' as TextTone,
  labelTone: 'muted' as TextTone,
  imageMaxHeight: 520,
  imageRadius: 'card' as RadiusName,
  imageBorder: 'border' as ColourName,
  imageBorderWidth: 1,
  imageGround: 'muted' as ColourName,
  spinner: 'mutedForeground' as ColourName,
});
