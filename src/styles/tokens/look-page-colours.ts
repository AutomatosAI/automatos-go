// What Play's look page draws beyond the look's own variables ('Automatos Play Looks.dc.html'):
// the edge around a Background swatch, a neutral grey at 40 % so each ground's square shows on
// every ground, and the soft light around Auto's light dots (the design's box-shadow 0 0 8px in
// the light's colour). Here, beside the other derived colours, so no colour is written elsewhere
// (D-TOKENS).

/** The design's rgba(128,128,128,.4). */
export const SWATCH_EDGE = 'rgba(128,128,128,0.4)';

/** A dot's glow in its own colour, as React Native's boxShadow takes it. */
export function lightGlow(colour: string, blur: number): string {
  return `0 0 ${blur}px ${colour}`;
}
