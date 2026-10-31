// The edge screens' numbers (US-017f), pure: Ember's 390 pt phones 06-09 ('Automatos Play
// Ember.dc.html'), in points, and which button each style draws a screen's one action as. Every
// style lays the same screen out with these; the style changes the faces, colours and grounds.
// Arcade (US-022i) puts each screen's words in a window with Auto's sprite at its head
// (ArcadeEdgeWindow.tsx), so it adds the window's padding and gaps; Candy (US-023l) a window with
// the band across its top and Auto at 140 on it (CandyEdgeWindow.tsx).

import type { ButtonVariant } from '../../ui/variants';
import type { Layout } from '../registry/style-id';

export const EDGE_METRICS = Object.freeze({
  /** The screen's sides (06 and 09: 24; 07 draws 22). */
  padX: 24,
  brand: Object.freeze({ padY: 10, statusSize: 11 }),
  /** The middle column's gap (06 and 09: 16; 07: 18). */
  gap: 16,
  notRunningGap: 18,
  /**
   * Check again and Back to chat: 48 high and full width, 12 above and 16 at the sides. Ember's 34
   * below (and the composer's 30) is the home indicator's room, which the Screen's safe area gives.
   */
  action: Object.freeze({ height: 48, padTop: 12, padX: 16, padBottom: 12, gap: 10 }),
  ledeSize: 15,
  ledeLeading: 1.5,
  messageSize: 16,
  messageLeading: 1.55,
  recheckSize: 13,
  command: Object.freeze({ size: 15, padY: 8, padX: 16, minHeight: 44 }),
  starter: Object.freeze({ height: 44, padX: 14, size: 14, gap: 8, rowPadX: 16, rowPadBottom: 12 }),
  composer: Object.freeze({ padTop: 6, padX: 12, padBottom: 6 }),
  snag: Object.freeze({ pad: 18, gap: 12, messageSize: 15, messageLeading: 1.5 }),
  /** The box the '404' stands in, Auto at its foot (09: 200 high). */
  lostStage: 200,
  /** Studio's sail mark over 'Talk to Auto'. */
  brandMark: 40,
  /**
   * Arcade's edge window: 16 inside its rings (the kit's 404 window draws 28 at 560 wide), 14
   * between its rows (the story window's), 6 between the sprite and its state word, and 8 between
   * the brand line's pieces when they wrap.
   */
  arcade: Object.freeze({ pad: 16, gap: 14, spriteGap: 6, brandGap: 8 }),
  /**
   * Candy's edge window (CANDY-LAYOUT §7; the kit's edges/asleep: the band 150 across its top, Auto
   * 140, 18 between its rows, its phone padding 20): 6 between Auto and his state word, and 8
   * between the brand line's pieces when they wrap.
   */
  candy: Object.freeze({ band: 150, auto: 140, pad: 20, gap: 18, wordGap: 6, brandGap: 8 }),
});

/**
 * Not running's Check again: Ember's cream button under Play (the glow is out, so no accent on the
 * screen), the solid primary in Studio, HUD and Arcade (the palette's accent, as its OPEN).
 */
export function checkAgainVariant(layout: Layout): ButtonVariant {
  return layout === 'play' ? 'secondary' : 'primary';
}
