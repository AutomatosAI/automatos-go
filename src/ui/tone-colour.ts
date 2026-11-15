// The token a tone's text is drawn in under a style, pure (docs/app-standard.md rule 10.4): the
// tone's own (variants.ts TEXT_TONES), unless that token is not a text colour in the style.

import type { ColourName, StyleId } from '../styles/tokens';
import { TEXT_TONES, type TextTone } from './variants';

/**
 * Where a style's token of a tone's name is not a colour text can be read in. Candy fills the
 * shared `accent` with its chip, a quiet ground (tokens/candy.ts CANDY_ROLES, as the web's hover
 * fill), so text in the accent tone would be its chip on its page, about 1.05:1. Its accent that
 * reads is `primary`, the palette's accent text colour, which its kit holds at AA on the page,
 * the window and the chip.
 */
const STYLE_TEXT_TONES: Readonly<
  Partial<Record<StyleId, Readonly<Partial<Record<TextTone, ColourName>>>>>
> = Object.freeze({
  candy: Object.freeze({ accent: 'primary' }),
});

/** The token a tone's text is drawn in under a style: TEXT_TONES, unless the style says another. */
export function toneColour(style: StyleId, tone: TextTone): ColourName {
  return STYLE_TEXT_TONES[style]?.[tone] ?? TEXT_TONES[tone];
}
