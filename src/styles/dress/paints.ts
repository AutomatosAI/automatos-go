// What each style paints the shared controls with (D-ONE-SET), as colour strings, pure. Studio's
// are the foundation's own (src/ui/variants.ts: buttonPaint, pillPaint, segmentPaint, cardPaint on
// the Studio-keyed tokens), so Studio and every installed theme draw exactly what they drew before
// A5. Play's are Ember's (its style sheet and 04's filter chips): primary the accent with its ink
// (one per screen), secondary the cream fill with the ground's ink (Send / Stop), outline a 1 pt
// line of the text at 24 %, chips cream when chosen and a 20 % line when not, cards the surface
// with the ground's line. HUD's are its README's: primary the accent with its ink, secondary and
// outline the 1 pt accent line, chosen things the accent fill with a 1.5 pt accent border, panels
// the panel fill with the panel border and the brackets, and a selected panel a soft accent glow
// ('Automatos Command Pages.dc.html': 1.5px accent, 0 0 24px -6px at .5). Arcade's are its design
// kit's (ui.module.css, inventory.module.css): every panel the look's window (Classic's rings and
// bevel, or Thin's line, and the hard drop shadow; arcade-frame.ts) on the window colour, a
// selected one in the accent's lines; primary the accent with its ink, secondary the page inside
// the window's line; chips the window inside the 2 pt chip ring; a chosen or pressed thing the
// palette's highlight with its ink (the menus' current row). Candy's are candy-paints.ts's. Every
// colour comes from the tokens: the look's variables, and the lines and glow
// tokens/dress-colours.ts derives.

import {
  BUTTON_PAINTS,
  buttonPaint,
  cardPaint,
  pillPaint,
  segmentPaint,
  type ButtonVariant,
  type ControlPaint,
} from '../../ui/variants';
import { windowRings } from '../arcade/parts/window-frame';
import { arcadeWindowFrame, type ArcadePaintPicks, type ArcadeVars } from '../tokens/arcade';
import {
  HUD_SELECTED_GLOW,
  arcadeSelectedColours,
  hudSelectedGlowColour,
  playDressLines,
} from '../tokens/dress-colours';
import type { HudVars } from '../tokens/hud';
import type { PlayVars } from '../tokens/play';
import type { Colours } from '../tokens/types';
import { arcadePanelFrame } from './arcade-frame';

export const NONE = 'transparent';

export type Paint = {
  readonly background: string;
  readonly border: string;
  readonly foreground: string;
};

export type PaintSet = {
  readonly rest: Paint;
  readonly pressed: Paint;
  readonly pressedOpacity: number;
};

export type PillPaints = {
  readonly rest: Paint;
  readonly pressed: Paint;
  readonly selected: Paint;
  readonly borderWidth: number;
  readonly selectedBorderWidth: number;
};

export type SegmentPaint = { readonly background: string; readonly foreground: string };

export type SegmentPaints = {
  readonly track: string;
  readonly rest: SegmentPaint;
  readonly selected: SegmentPaint;
  /** The chosen segment lifts on Studio's hairline shadow (cc-seg). */
  readonly selectedShadow: boolean;
};

/**
 * One layer of React Native's boxShadow: HUD's glow (a negative spread, no offset) or a line of
 * Arcade's window (an inset band, the bevel's offset band, the hard drop).
 */
export type GlowLayer = {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blurRadius: number;
  readonly spreadDistance: number;
  readonly color: string;
  readonly inset?: boolean;
};

export type PanelPaint = { readonly background: string; readonly border: string };

export type PanelPaints = {
  readonly rest: PanelPaint;
  readonly pressed: PanelPaint;
  readonly selected: PanelPaint;
  readonly borderWidth: number;
  readonly selectedBorderWidth: number;
  /** A selected or live panel's glow (Arcade: its window in the accent); none where the style draws no glow. */
  readonly selectedGlow: readonly GlowLayer[] | null;
  /** The shadows every other panel wears (Arcade's window); null: the card's own shadow. */
  readonly frame: readonly GlowLayer[] | null;
  /** The corner brackets' colour (KS12); null where the style draws none. */
  readonly bracket: string | null;
};

/** The slider's colours: the filled track and its thumb, the track after it, the part past its cap. */
export type SliderPaints = {
  readonly fill: string;
  readonly track: string;
  readonly past: string;
};

export type DressPaints = {
  readonly button: Readonly<Record<ButtonVariant, PaintSet>>;
  readonly pill: PillPaints;
  readonly segment: SegmentPaints;
  readonly panel: PanelPaints;
  /** The slider's (Candy's accent on its chip); null: the foundation's primary on muted. */
  readonly slider: SliderPaints | null;
};

/** A solid button's pressed opacity (at-btn--default:hover, as the foundation's primary). */
export const SOLID_PRESSED_OPACITY = BUTTON_PAINTS.primary.pressedOpacity;
/** HUD's selected or live line: 1.5 pt (its README 'Panel'). */
export const HUD_SELECTED_BORDER = 1.5;
export const HAIRLINE = 1;
/** Arcade's chip ring (theme.css --arcade-chip-ring: inset 0 0 0 2px the window border). */
export const ARCADE_CHIP_RING = 2;


const paintOf = (control: Pick<ControlPaint, 'backgroundColor' | 'borderColor' | 'color'>) => ({
  background: control.backgroundColor,
  border: control.borderColor,
  foreground: control.color,
});

/** A filled control: the fill, its ink on it, pressed at the solid opacity. */
export const solid = (fill: string, ink: string): PaintSet => {
  const rest = { background: fill, border: fill, foreground: ink };
  return { rest, pressed: rest, pressedOpacity: SOLID_PRESSED_OPACITY };
};

const variants = Object.keys(BUTTON_PAINTS) as ButtonVariant[];

function studioButtons(colours: Colours): Record<ButtonVariant, PaintSet> {
  const entries = variants.map((variant) => {
    const set: PaintSet = {
      rest: paintOf(buttonPaint(colours, variant)),
      pressed: paintOf(buttonPaint(colours, variant, { pressed: true })),
      pressedOpacity: BUTTON_PAINTS[variant].pressedOpacity,
    };
    return [variant, set] as const;
  });
  return Object.fromEntries(entries) as Record<ButtonVariant, PaintSet>;
}

/** Studio's (and an installed theme's): the foundation's paints on the Studio-keyed tokens. */
export function studioPaints(colours: Colours): DressPaints {
  const rest = cardPaint(colours, false);
  const card = { background: rest.backgroundColor, border: rest.borderColor };
  const pressed = cardPaint(colours, true);
  const segment = (selected: boolean) => {
    const { backgroundColor, color } = segmentPaint(colours, selected);
    return { background: backgroundColor, foreground: color };
  };
  return {
    button: studioButtons(colours),
    pill: {
      rest: paintOf(pillPaint(colours, false)),
      pressed: paintOf(pillPaint(colours, false, { pressed: true })),
      selected: paintOf(pillPaint(colours, true)),
      borderWidth: HAIRLINE,
      selectedBorderWidth: HAIRLINE,
    },
    segment: {
      track: colours.muted,
      rest: segment(false),
      selected: segment(true),
      selectedShadow: true,
    },
    panel: {
      rest: card,
      pressed: { background: pressed.backgroundColor, border: pressed.borderColor },
      selected: card,
      borderWidth: HAIRLINE,
      selectedBorderWidth: HAIRLINE,
      selectedGlow: null,
      frame: null,
      bracket: null,
    },
    slider: null,
  };
}

function playButtons(vars: PlayVars): Record<ButtonVariant, PaintSet> {
  const line = playDressLines(vars).outline;
  return {
    primary: solid(vars.accent, vars.accentInk),
    secondary: solid(vars.groundText, vars.groundBg),
    outline: {
      rest: { background: NONE, border: line, foreground: vars.groundText },
      pressed: { background: vars.groundChip, border: line, foreground: vars.groundText },
      pressedOpacity: 1,
    },
    ghost: {
      rest: { background: NONE, border: NONE, foreground: vars.groundText2 },
      pressed: { background: vars.groundChip, border: NONE, foreground: vars.groundText },
      pressedOpacity: 1,
    },
  };
}

/** Play's: the look's --pl-* variables; pressed cards take the Studio-keyed hover the look sets. */
export function playPaints(vars: PlayVars, colours: Colours): DressPaints {
  const chipLine = playDressLines(vars).chip;
  const card = { background: vars.groundSurface, border: vars.groundLine };
  return {
    button: playButtons(vars),
    pill: {
      rest: { background: NONE, border: chipLine, foreground: vars.groundText },
      pressed: { background: vars.groundChip, border: chipLine, foreground: vars.groundText },
      selected: { background: vars.groundText, border: vars.groundText, foreground: vars.groundBg },
      borderWidth: HAIRLINE,
      selectedBorderWidth: HAIRLINE,
    },
    segment: {
      track: colours.muted,
      rest: { background: NONE, foreground: vars.groundText2 },
      selected: { background: vars.groundText, foreground: vars.groundBg },
      selectedShadow: false,
    },
    panel: {
      rest: card,
      pressed: { background: colours.ccHover, border: colours.ccHoverBorder },
      selected: card,
      borderWidth: HAIRLINE,
      selectedBorderWidth: HAIRLINE,
      selectedGlow: null,
      frame: null,
      bracket: null,
    },
    slider: null,
  };
}

function hudButtons(vars: HudVars): Record<ButtonVariant, PaintSet> {
  const outline: PaintSet = {
    rest: { background: NONE, border: vars.accentLine, foreground: vars.accent },
    pressed: { background: vars.accentFill, border: vars.accentLine, foreground: vars.accent },
    pressedOpacity: 1,
  };
  return {
    primary: solid(vars.accent, vars.accentInk),
    secondary: outline,
    outline,
    ghost: {
      rest: { background: NONE, border: NONE, foreground: vars.text2 },
      pressed: { background: vars.accentFill, border: NONE, foreground: vars.text },
      pressedOpacity: 1,
    },
  };
}

/** HUD's soft glow round a selected or live panel, in the look's accent. */
export function hudGlowLayers(accent: string): readonly GlowLayer[] {
  const { blurRadius, spreadDistance } = HUD_SELECTED_GLOW;
  const color = hudSelectedGlowColour(accent);
  return Object.freeze([{ offsetX: 0, offsetY: 0, blurRadius, spreadDistance, color }]);
}

/** HUD's: its README's derived variables (tokens/hud.ts hudVars); the segment track its token. */
export function hudPaints(vars: HudVars, colours: Colours): DressPaints {
  const chosen = { background: vars.accentFill, border: vars.accent, foreground: vars.accent };
  return {
    button: hudButtons(vars),
    pill: {
      rest: { background: NONE, border: vars.line, foreground: vars.text2 },
      pressed: { background: vars.accentFill, border: vars.line, foreground: vars.text },
      selected: chosen,
      borderWidth: HAIRLINE,
      selectedBorderWidth: HUD_SELECTED_BORDER,
    },
    segment: {
      track: colours.muted,
      rest: { background: NONE, foreground: vars.text2 },
      selected: { background: vars.accentFill, foreground: vars.accent },
      selectedShadow: false,
    },
    panel: {
      rest: { background: vars.panelFill, border: vars.panelBorder },
      pressed: { background: vars.accentFill, border: vars.accentLine },
      selected: { background: vars.accentFill, border: vars.accent },
      borderWidth: HAIRLINE,
      selectedBorderWidth: HUD_SELECTED_BORDER,
      selectedGlow: hudGlowLayers(vars.accent),
      frame: null,
      bracket: vars.bracket,
    },
    slider: null,
  };
}

/** Arcade's chosen thing, and a press: the palette's highlight with its ink, a pair at AA. */
function arcadePicked(vars: ArcadeVars): Paint {
  const { fill, ink } = arcadeSelectedColours(vars);
  return { background: fill, border: fill, foreground: ink };
}

function arcadeButtons(vars: ArcadeVars): Record<ButtonVariant, PaintSet> {
  const pressed = arcadePicked(vars);
  const lit = (rest: Paint): PaintSet => ({ rest, pressed, pressedOpacity: 1 });
  return {
    primary: solid(vars.ac, vars.aci),
    secondary: lit({ background: vars.page, border: vars.bd, foreground: vars.tx }),
    outline: lit({ background: NONE, border: vars.bd, foreground: vars.tx }),
    ghost: lit({ background: NONE, border: NONE, foreground: vars.tx2 }),
  };
}

/** Arcade's: the palette's variables (tokens/arcade.ts arcadeVars), the window in the look's style. */
export function arcadePaints(vars: ArcadeVars, look: ArcadePaintPicks): DressPaints {
  const picked = arcadePicked(vars);
  const rings = windowRings(arcadeWindowFrame(look));
  const window = (line: string) =>
    arcadePanelFrame(rings, {
      line,
      gap: vars.win,
      bevelLight: vars.bevl,
      bevelDark: vars.bevd,
      shadow: vars.sh,
    });
  const rest = window(vars.bd);
  return {
    button: arcadeButtons(vars),
    pill: {
      rest: { background: vars.win, border: vars.bd, foreground: vars.tx },
      pressed: { background: vars.page, border: vars.bd, foreground: vars.tx },
      selected: picked,
      borderWidth: ARCADE_CHIP_RING,
      selectedBorderWidth: ARCADE_CHIP_RING,
    },
    segment: {
      track: vars.win,
      rest: { background: NONE, foreground: vars.tx2 },
      selected: { background: picked.background, foreground: picked.foreground },
      selectedShadow: false,
    },
    panel: {
      rest: { background: vars.win, border: vars.bd },
      pressed: { background: vars.page, border: vars.bd },
      selected: { background: vars.win, border: vars.ac },
      borderWidth: rest.borderWidth,
      selectedBorderWidth: rest.borderWidth,
      selectedGlow: window(vars.ac).layers,
      frame: rest.layers,
      bracket: null,
    },
    slider: null,
  };
}
