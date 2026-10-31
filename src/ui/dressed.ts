// The primitives' logic under a dress (src/styles/dress, D-ONE-SET), pure: the faces, heights and
// paints each primitive takes from the style it paints. On the Studio layout (Studio, and an
// installed theme) every function returns exactly what variants.ts gives the foundation's
// primitives on useTokens(); Play, HUD and Arcade take their own type (styleType) and the dress's
// paints. Arcade's controls and labels are its pixel face at its type's own steps (the button's
// 12, the label's 11), and every panel but a selected one wears its window (the dress's frame).
// Candy's panels wear its tinted shadow (the frame) and head in its section title; its rows and
// rules (52 pt, 1.5 pt) and its slider (the accent on the chip) are the dress's too.

import type { FontWeight } from '../styles/fonts';
import type { Dress, DressFace, LabelCase } from '../styles/dress/dress';
import type { PanelPaint, Paint, SegmentPaint, SliderPaints } from '../styles/dress/paints';
import type { ResolvedStyle } from '../styles/provider/resolve';
import type { Colours } from '../styles/tokens/types';
import { LEADING, type TypeOverrides, type TypeRole, type TypeStyle } from '../styles/type';
import { TITLE_ROLES, type StyleType, type TitleRole } from '../styles/typeface/scale';
import { DISABLED_OPACITY } from './paint';
import {
  textFace,
  textRole,
  type ButtonVariant,
  type ControlPaint,
  type ControlState,
  type TextLevel,
} from './variants';

// ── Text ────────────────────────────────────────────────────────────────────────────────────

const TITLES: ReadonlySet<TypeRole> = new Set<TypeRole>(TITLE_ROLES);

function isTitleRole(role: TypeRole): role is TitleRole {
  return TITLES.has(role);
}

/**
 * Text's face: the foundation's scale on the Studio layout; under Play and HUD their titles (Play:
 * the display face only at 19 and above), eyebrows and labels from styleType, the rest (body,
 * figures, the thread) the scale's, as every style writes text in Geist and Geist Mono.
 */
export function dressedTextFace(
  style: ResolvedStyle,
  role: TypeRole,
  overrides: TypeOverrides = {},
): TypeStyle {
  if (style.layout !== 'studio') {
    if (isTitleRole(role)) return style.type.title(role);
    if (role === 'eyebrow') return style.type.eyebrow;
    if (role === 'label') return style.type.label;
  }
  return textFace(style.tokens.type, role, overrides);
}

/**
 * Arcade's pixel face comes only at its type's own steps (typeface/arcade-type.ts), each with its
 * own case and tracking: the label's, or the button's for anything larger.
 */
function pixelFaceStyle(type: StyleType, size: number): TypeStyle {
  return size > type.label.fontSize ? type.button : type.label;
}

/** A dress face at a size, case and tracking, in the style's own sans or mono (or Arcade's pixel step). */
export function dressFaceStyle(
  type: StyleType,
  face: DressFace,
  size: number,
  letterCase: LabelCase,
  trackingEm: number,
): TypeStyle {
  if (face.role === 'pixel') return pixelFaceStyle(type, size);
  const build = face.role === 'mono' ? type.mono : type.body;
  return build(size, face.weight, {
    leading: LEADING.heading,
    trackingEm,
    uppercase: letterCase === 'capitals',
  });
}

/** The small label (a chip, a status's word, a field's label under Play and HUD). */
export function labelStyle(style: ResolvedStyle, dress: Dress): TypeStyle {
  if (style.layout === 'studio') return style.tokens.type.label;
  const { face, size, trackingEm } = dress.label;
  return dressFaceStyle(style.type, face, size, dress.label.case, trackingEm);
}

/**
 * A control's label (a button, a pill, a segment, the Command Centre button): Studio's at the
 * control's own Body level and weight; Play's and HUD's the dress's face, size, case and tracking.
 */
export function controlLabel(
  style: ResolvedStyle,
  dress: Dress,
  level: TextLevel,
  weight: FontWeight = dress.button.labelFace.weight,
): TypeStyle {
  const { labelFace, labelSize, labelCase, trackingEm } = dress.button;
  if (style.layout === 'studio' || labelSize === null) {
    return textFace(style.tokens.type, textRole('body', level), { weight });
  }
  return dressFaceStyle(style.type, { ...labelFace, weight }, labelSize, labelCase, trackingEm);
}

const FIELD_LABEL_LEVEL: TextLevel = 3;
const FIELD_LABEL_WEIGHT: FontWeight = 500;

/** A field's label: Studio's Body 3 at 500; Play's and HUD's small label in capitals. */
export function fieldLabelStyle(style: ResolvedStyle, dress: Dress): TypeStyle {
  if (style.layout === 'studio') {
    return textFace(style.tokens.type, textRole('body', FIELD_LABEL_LEVEL), {
      weight: FIELD_LABEL_WEIGHT,
    });
  }
  return labelStyle(style, dress);
}

/** A section's title in the scale: Title 3 (Candy's Outfit 600 20). */
const SECTION_TITLE: TitleRole = 'title3';

/**
 * A panel's header row: Studio's eyebrow, Play's label, HUD's display face at its label size,
 * Candy's section title.
 */
export function panelHeaderStyle(style: ResolvedStyle, dress: Dress): TypeStyle {
  if (dress.panelHeader === 'section') return style.type.title(SECTION_TITLE);
  if (dress.panelHeader === 'display') return style.type.display('panel');
  if (dress.panelHeader === 'label') return labelStyle(style, dress);
  return style.tokens.type.eyebrow;
}

// ── Heights ─────────────────────────────────────────────────────────────────────────────────

/** A button's height: its size's, raised to the dress's least (HUD's 46 inside a panel). */
export function buttonHeight(dress: Dress, sizeHeight: number, inPanel: boolean): number {
  const least = inPanel ? dress.button.panelMinHeight : dress.button.minHeight;
  return Math.max(sizeHeight, least);
}

/** An edge screen's one action: the edges' own height, raised to the dress's least (Candy's 50). */
export function edgeActionHeight(dress: Dress, edgeHeight: number): number {
  return Math.max(edgeHeight, dress.edgeActionMinHeight ?? edgeHeight);
}

export type DressedRow = {
  readonly minHeight: number;
  readonly separatorWidth: number;
  readonly separatorColour: string;
};

/** A list's row and its rule: the foundation's 44 and 1 pt in --border; Candy's 52 and 1.5 pt. */
export function dressedRow(dress: Dress, colours: Pick<Colours, 'border'>): DressedRow {
  return { ...dress.row, separatorColour: colours.border };
}

// ── Paints ──────────────────────────────────────────────────────────────────────────────────

function control(chosen: Paint, opacity: number): ControlPaint {
  return {
    backgroundColor: chosen.background,
    borderColor: chosen.border,
    color: chosen.foreground,
    opacity,
  };
}

/** A button's paint in the dress (Studio: variants.ts buttonPaint, unchanged). */
export function dressedButtonPaint(
  dress: Dress,
  variant: ButtonVariant,
  state: ControlState = {},
): ControlPaint {
  const set = dress.paints.button[variant];
  const pressed = Boolean(state.pressed) && !state.disabled;
  const opacity = state.disabled ? DISABLED_OPACITY : pressed ? set.pressedOpacity : 1;
  return control(pressed ? set.pressed : set.rest, opacity);
}

export type PillPaint = ControlPaint & { readonly borderWidth: number };

/** A filter pill's paint (Studio: variants.ts pillPaint, unchanged), with its border's width. */
export function dressedPillPaint(
  dress: Dress,
  selected: boolean,
  state: ControlState = {},
): PillPaint {
  const { pill } = dress.paints;
  const pressed = Boolean(state.pressed) && !selected;
  const chosen = selected ? pill.selected : pressed ? pill.pressed : pill.rest;
  const opacity = state.disabled ? DISABLED_OPACITY : 1;
  return {
    ...control(chosen, opacity),
    borderWidth: selected ? pill.selectedBorderWidth : pill.borderWidth,
  };
}

/** The slider's colours: the dress's (Candy's accent on its chip), else primary on muted, the page past its cap. */
export function dressedSliderPaint(
  dress: Dress,
  colours: Pick<Colours, 'primary' | 'muted' | 'background'>,
): SliderPaints {
  return (
    dress.paints.slider ?? {
      fill: colours.primary,
      track: colours.muted,
      past: colours.background,
    }
  );
}

/** A segment's paint (Studio: variants.ts segmentPaint, unchanged). */
export function dressedSegmentPaint(dress: Dress, selected: boolean): SegmentPaint {
  const { segment } = dress.paints;
  return selected ? segment.selected : segment.rest;
}

export type PanelState = { readonly pressed?: boolean; readonly selected?: boolean };

export type DressedPanel = PanelPaint & {
  readonly borderWidth: number;
  /** HUD's glow round a selected panel, Arcade's window round any; null: the card's own shadow. */
  readonly glow: PanelGlow;
};

type PanelGlow = Dress['paints']['panel']['selectedGlow'];

/**
 * A card's or a panel's paint: pressed takes the hover, selected HUD's accent line and glow (Arcade:
 * its window in the accent); the rest wear the dress's frame (Arcade's window; none elsewhere).
 */
export function dressedPanelPaint(dress: Dress, state: PanelState = {}): DressedPanel {
  const { panel } = dress.paints;
  if (state.selected) {
    return {
      ...panel.selected,
      borderWidth: panel.selectedBorderWidth,
      glow: panel.selectedGlow,
    };
  }
  return {
    ...(state.pressed ? panel.pressed : panel.rest),
    borderWidth: panel.borderWidth,
    glow: panel.frame,
  };
}
