// The chat thread's paint (D72, Gerard 23 Oct: "be like web ui ... light grey box around us both").
// The web draws the user's words in bg-primary/10 with border-primary/10 and Auto's in a card; the
// phone resolves those to opaque colours over the page with the vendored look-kit mix, as the
// browser composites them. Every value is derived from the look's colours, never retuned: a change
// starts in the source tokens. Auto's box is a Studio card (the web's card/40 is 1.03:1 on a phone
// and disappears), and the avatar is the accent disc with the web's white mark.

import { mixHex } from '../../core/web/lib/look-kit/contrast';
import type { Colours, ThreadPaint } from './types';

/** The web's /10 on --primary (bg-primary/10, border-primary/10). */
export const USER_TINT = 0.1;

/** Resolved opaque over the page, as the web composites them; Auto's box is a Studio card. */
export function threadPaint(colours: Colours, sail: string): ThreadPaint {
  const userFill = mixHex(colours.background, colours.primary, USER_TINT);
  return Object.freeze({
    autoFill: colours.card,
    autoBorder: colours.border,
    userFill,
    userBorder: mixHex(userFill, colours.primary, USER_TINT),
    avatar: colours.accent,
    sail,
  });
}
