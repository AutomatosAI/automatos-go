// Studio's type is the foundation's scale unchanged (type.ts STUDIO_TYPE): titles are its title
// roles, each display slot the role nearest it by rank (the large slots Title 1, a status and the
// snag card's title Title 2, a header Title 3, a card Title 4, a small card Title 5, a panel the
// mono label, a number Figure 1), buttons the md button's label (ui/variants.ts BUTTON_SIZES.md:
// Body 1 at Geist 500). The one addition is Lost's decorative '404', drawn behind the screen in
// every style at Play's 200/0.8 and hidden from accessibility: a mark, not a text level.

import type { FontWeight } from '../fonts';
import { LEADING, STUDIO_TYPE, TRACKING, typeStyle, type TypeRole, type TypeStyle } from '../type';
import { STYLE_FACES } from './faces';
import { roleStyle, styleTable, textStyle } from './text-style';
import {
  DISPLAY_SLOTS,
  type DisplaySlot,
  type StyleType,
  type TitleRole,
  type TypeOptions,
} from './types';

export const STUDIO_SLOT_ROLES: Readonly<Record<Exclude<DisplaySlot, 'lostNumber'>, TypeRole>> =
  Object.freeze({
    hero: 'title1', // First open: 'Talk to Auto', Newsreader 28
    screenLg: 'title1',
    screen: 'title1',
    notRunning: 'title1',
    snag: 'title2',
    status: 'title2',
    header: 'title3',
    card: 'title4',
    cardSm: 'title5',
    brand: 'title3',
    panel: 'label',
    number: 'figure1',
  });

/** Lost's '404' (Play's lostNumber), in Studio's title face. */
export const STUDIO_LOST_NUMBER = Object.freeze({ size: 200, leading: 0.8 });

/** ui/variants.ts: the md button's label is Body 1 at BUTTON_LABEL_WEIGHT. */
const BUTTON_WEIGHT: FontWeight = 500;

function display(slot: DisplaySlot): TypeStyle {
  if (slot !== 'lostNumber') return STUDIO_TYPE[STUDIO_SLOT_ROLES[slot]];
  return textStyle({
    face: STYLE_FACES.studio.display.serif,
    ...STUDIO_LOST_NUMBER,
    tracking: TRACKING.display,
  });
}

function body(size: number, weight: FontWeight = 400, options?: TypeOptions): TypeStyle {
  return roleStyle(STYLE_FACES.studio.body, size, weight, { leading: LEADING.body }, options);
}

function mono(size: number, weight: FontWeight = 400, options?: TypeOptions): TypeStyle {
  return roleStyle(STYLE_FACES.studio.mono, size, weight, { leading: LEADING.body }, options);
}

export const STUDIO_STYLE_TYPE: StyleType = Object.freeze({
  title: (role: TitleRole) => STUDIO_TYPE[role],
  display: styleTable(DISPLAY_SLOTS, display),
  body,
  mono,
  label: STUDIO_TYPE.label,
  eyebrow: STUDIO_TYPE.eyebrow,
  button: typeStyle('body1', { weight: BUTTON_WEIGHT }),
});
