// What each style paints the shared controls with (D-ONE-SET), as colour strings, pure. Studio's
// are the foundation's own (src/ui/variants.ts: buttonPaint, pillPaint, segmentPaint, cardPaint on
// the Studio-keyed tokens), so Studio and every installed theme draw exactly what they drew before
// A5. Play's are Ember's (its style sheet and 04's filter chips): primary the accent with its ink
// (one per screen), secondary the cream fill with the ground's ink (Send / Stop), outline a 1 pt
// line of the text at 24 %, chips cream when chosen and a 20 % line when not, cards the surface
// with the ground's line. HUD's are its README's: primary the accent with its ink, secondary and
// outline the 1 pt accent line, chosen things the accent fill with a 1.5 pt accent border, panels
// the panel fill with the panel border and the brackets, and a selected panel a soft accent glow
// ('Automatos Command Pages.dc.html': 1.5px accent, 0 0 24px -6px at .5).

import { rgba } from '../../core/web/lib/look-kit/css';
import {
  BUTTON_PAINTS,
  buttonPaint,
  cardPaint,
  pillPaint,
  segmentPaint,
  type ButtonVariant,
  type ControlPaint,
} from '../../ui/variants';
import type { HudVars } from '../tokens/hud';
import type { PlayVars } from '../tokens/play';
import type { Colours } from '../tokens/types';

const NONE = 'transparent';

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

/** One layer of React Native's boxShadow with a spread (the glow's negative spread). */
export type GlowLayer = {
  readonly offsetX: 0;
  readonly offsetY: 0;
  readonly blurRadius: number;
  readonly spreadDistance: number;
  readonly color: string;
};

export type PanelPaint = { readonly background: string; readonly border: string };

export type PanelPaints = {
  readonly rest: PanelPaint;
  readonly pressed: PanelPaint;
  readonly selected: PanelPaint;
  readonly borderWidth: number;
  readonly selectedBorderWidth: number;
  /** A selected or live panel's glow; none where the style draws no glow. */
  readonly selectedGlow: readonly GlowLayer[] | null;
  /** The corner brackets' colour (KS12); null where the style draws none. */
  readonly bracket: string | null;
};

export type DressPaints = {
  readonly button: Readonly<Record<ButtonVariant, PaintSet>>;
  readonly pill: PillPaints;
  readonly segment: SegmentPaints;
  readonly panel: PanelPaints;
};

/** Ember's outline button: a 1 pt line of the ground's text at 24 %. */
export const PLAY_OUTLINE_ALPHA = 0.24;
/** Ember 04's filter chips when not chosen: a 1 pt line of the ground's text at 20 %. */
export const PLAY_CHIP_LINE_ALPHA = 0.2;
/** A solid button's pressed opacity (at-btn--default:hover, as the foundation's primary). */
export const SOLID_PRESSED_OPACITY = BUTTON_PAINTS.primary.pressedOpacity;
/** HUD's selected or live line: 1.5 pt (its README 'Panel'). */
export const HUD_SELECTED_BORDER = 1.5;
/** HUD's soft accent glow round a selected panel. */
export const HUD_SELECTED_GLOW = Object.freeze({ blurRadius: 24, spreadDistance: -6, alpha: 0.5 });
export const HAIRLINE = 1;

const paintOf = (control: Pick<ControlPaint, 'backgroundColor' | 'borderColor' | 'color'>) => ({
  background: control.backgroundColor,
  border: control.borderColor,
  foreground: control.color,
});

const solid = (fill: string, ink: string): PaintSet => {
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
      bracket: null,
    },
  };
}

function playButtons(vars: PlayVars): Record<ButtonVariant, PaintSet> {
  const line = rgba(vars.groundText, PLAY_OUTLINE_ALPHA);
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
  const chipLine = rgba(vars.groundText, PLAY_CHIP_LINE_ALPHA);
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
      bracket: null,
    },
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
  const { blurRadius, spreadDistance, alpha } = HUD_SELECTED_GLOW;
  return Object.freeze([
    { offsetX: 0, offsetY: 0, blurRadius, spreadDistance, color: rgba(accent, alpha) },
  ]);
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
      bracket: vars.bracket,
    },
  };
}
