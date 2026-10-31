// Candy's paints for the shared controls (D-ONE-SET, CANDY-LAYOUT §7), pure: its design kit's
// (ui.module.css, looks.module.css) on the palette's variables. Every panel a window: the win fill
// with no line (its border is its own fill, so a selected ring in the accent moves nothing) on the
// palette's tinted shadow at the look's glow; primary the accent pill with its ink, secondary the
// kit's quiet pill (the chip with the text), outline the hairline, ghost the quiet text; chips the
// window in the hairline, the chosen chip or segment the accent with its ink; the slider the accent
// on the chip (the design's range inputs: accent-color the accent). Every colour comes from
// tokens/: the palette's variables, the chosen pair and the shadow's colour (dress-colours.ts).

import type { ButtonVariant } from '../../ui/variants';
import { candyShadow, type CandyPaintPicks, type CandyVars } from '../tokens/candy';
import { candySelectedColours, candyShadowColour } from '../tokens/dress-colours';
import { NONE, solid, type DressPaints, type GlowLayer, type Paint, type PaintSet } from './paints';

/** Candy's lines: a chip's hairline, a selected panel's accent ring (the design's 1.5px rules). */
export const CANDY_LINE = 1.5;
/** CSS's blur is twice iOS's shadowRadius (a Gaussian of σ = blur / 2): candyShadow's 20 is the kit's 40 px. */
export const CSS_BLUR_PER_SHADOW_RADIUS = 2;

/** Candy's chosen thing: the accent with its ink, a pair the kit holds at AA. */
function candyPicked(vars: CandyVars): Paint {
  const { fill, ink } = candySelectedColours(vars);
  return { background: fill, border: fill, foreground: ink };
}

function candyButtons(vars: CandyVars): Record<ButtonVariant, PaintSet> {
  return {
    primary: solid(vars.accent, vars.accentInk),
    secondary: solid(vars.chip, vars.text),
    outline: {
      rest: { background: NONE, border: vars.border, foreground: vars.text },
      pressed: { background: vars.chip, border: vars.border, foreground: vars.text },
      pressedOpacity: 1,
    },
    ghost: {
      rest: { background: NONE, border: NONE, foreground: vars.quiet },
      pressed: { background: vars.chip, border: NONE, foreground: vars.text },
      pressedOpacity: 1,
    },
  };
}

/**
 * Candy's tinted shadow (CANDY-LAYOUT §3: offset 0, 14 and radius 20; the kit's --candy-shadow-win)
 * as React Native's boxShadow, the one layer at the look's glow.
 */
export function candyShadowLayers(
  look: Pick<CandyPaintPicks, 'palette' | 'glow'>,
): readonly GlowLayer[] {
  const shadow = candyShadow(look);
  return Object.freeze([
    {
      offsetX: shadow.shadowOffset.width,
      offsetY: shadow.shadowOffset.height,
      blurRadius: shadow.shadowRadius * CSS_BLUR_PER_SHADOW_RADIUS,
      spreadDistance: 0,
      color: candyShadowColour(shadow),
    },
  ]);
}

/** Candy's: the palette's variables (tokens/candy.ts candyVars), the shadow at the look's glow. */
export function candyPaints(
  vars: CandyVars,
  look: Pick<CandyPaintPicks, 'palette' | 'glow'>,
): DressPaints {
  const picked = candyPicked(vars);
  const shadow = candyShadowLayers(look);
  return {
    button: candyButtons(vars),
    pill: {
      rest: { background: vars.win, border: vars.border, foreground: vars.text },
      pressed: { background: vars.chip, border: vars.border, foreground: vars.text },
      selected: picked,
      borderWidth: CANDY_LINE,
      selectedBorderWidth: CANDY_LINE,
    },
    segment: {
      track: vars.chip,
      rest: { background: NONE, foreground: vars.quiet },
      selected: { background: picked.background, foreground: picked.foreground },
      selectedShadow: false,
    },
    panel: {
      rest: { background: vars.win, border: vars.win },
      pressed: { background: vars.chip, border: vars.chip },
      selected: { background: vars.win, border: vars.accent },
      borderWidth: CANDY_LINE,
      selectedBorderWidth: CANDY_LINE,
      selectedGlow: shadow,
      frame: shadow,
      bracket: null,
    },
    slider: { fill: vars.accent, track: vars.chip, past: vars.page },
  };
}
