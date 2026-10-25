// What HUD's Looks drawer draws beyond hudVars ('Automatos Command HUD.dc.html'): the edge around a
// Background swatch, white at 25 % so each ground's square shows on the drawer, and the glow
// around a look card's accent ring (the drawing's box-shadow 0 0 12px and inset 0 0 8px in the
// accent). Here, beside the other derived colours, so no colour is written elsewhere (D-TOKENS).

/** The drawing's rgba(255,255,255,.25). */
export const HUD_SWATCH_EDGE = 'rgba(255,255,255,0.25)';

/** A ring's glow outside and inside in its own colour, as React Native's boxShadow takes it. */
export function ringGlow(colour: string, outer: number, inner: number): string {
  return `0 0 ${outer}px ${colour}, inset 0 0 ${inner}px ${colour}`;
}
