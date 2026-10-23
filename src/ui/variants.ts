// The primitives' logic, pure (PRD-001 §4.11, K5): each variant, size and state names token keys,
// and these functions turn them into the values a component paints with, so src/ui/*.tsx only
// wires. Sizes and paints follow the handoff (README 'Design Tokens' and the design system's
// studio.css: at-btn, cc-filter-pill, cc-seg, at-input, the reason chip, the count badge). Status
// words for the board are the web's own (STATUS_CONFIG); every colour status carries one (§4.6).

import { userMessage, isApiError, type ApiErrorKind } from '../api/errors';
import { STATUS_CONFIG, type BoardStatus } from '../core/web/types/board';
import { TYPE_FAMILIES, fontFace } from '../styles/fonts';
import type { ColourName, Colours, SpaceName } from '../styles/tokens';
import {
  TYPE_SPECS,
  typeStyle,
  type TypeOverrides,
  type TypeRole,
  type TypeScale,
  type TypeStyle,
} from '../styles/type';
import { DISABLED_OPACITY, joinLabel, paint, tint, type ColourKey } from './paint';
import { UI_COPY } from './strings';

// ── Text ────────────────────────────────────────────────────────────────────────────────────

export type TextVariant = 'title' | 'body' | 'mono' | 'eyebrow' | 'thread';
export type TextLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type TextTone =
  'default' | 'muted' | 'subtle' | 'accent' | 'success' | 'info' | 'warning' | 'inverse';

const TITLES = ['title1', 'title2', 'title3', 'title4', 'title5', 'title6'] as const;
const BODIES = ['body1', 'body2', 'body3', 'body4', 'body5', 'body6'] as const;
const FIGURES = ['figure1', 'figure2', 'figure3'] as const;

const at = <T>(list: readonly T[], level: number): T =>
  list[Math.min(Math.max(Math.trunc(level), 1), list.length) - 1];

function threadRole(level: TextLevel | undefined): TypeRole {
  if (level === 1) return 'threadTitle1';
  if (level === 2) return 'threadTitle2';
  return 'thread';
}

/**
 * title and body levels 1–6 are the scale's sizes; mono is the label, or figure 1–3 with a level;
 * thread is the chat thread's 16/24 (D72), its levels 1 and 2 the headings in Auto's answers (19
 * and 17 pt serif) and any other level the words.
 */
export function textRole(variant: TextVariant, level?: TextLevel): TypeRole {
  if (variant === 'eyebrow') return 'eyebrow';
  if (variant === 'thread') return threadRole(level);
  if (variant === 'mono') return level === undefined ? 'label' : at(FIGURES, level);
  return at(variant === 'title' ? TITLES : BODIES, level ?? 1);
}

export const TEXT_TONES: Readonly<Record<TextTone, ColourName>> = Object.freeze({
  default: 'foreground',
  muted: 'mutedForeground',
  subtle: 'fg3',
  accent: 'accent',
  success: 'olive',
  info: 'navy',
  warning: 'warnInk',
  inverse: 'primaryForeground',
});

/** Eyebrows are muted by default ('OPERATIONS · MON 19 OCT'); everything else is ink. */
export function defaultTone(variant: TextVariant): TextTone {
  return variant === 'eyebrow' ? 'muted' : 'default';
}

/**
 * The role's face from the scale, or at another weight or italic when that face is bundled. The
 * override is built from Studio's specs (TYPE_SPECS), the only scale in this wave.
 */
export function textFace(
  type: TypeScale,
  role: TypeRole,
  overrides: TypeOverrides = {},
): TypeStyle {
  if (overrides.weight === undefined && !overrides.italic) return type[role];
  const spec = TYPE_SPECS[role];
  const weight = overrides.weight ?? spec.weight;
  const bundled = fontFace(
    TYPE_FAMILIES[spec.family],
    weight,
    overrides.italic ? 'italic' : 'normal',
  );
  return bundled ? typeStyle(role, overrides) : type[role];
}

// ── Buttons ─────────────────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md';
export type IconButtonSize = 'sm' | 'md' | 'lg';

type Paint = {
  readonly background: ColourKey;
  readonly border: ColourKey;
  readonly foreground: ColourName;
};
type PaintSet = { readonly rest: Paint; readonly pressed: Paint; readonly pressedOpacity: number };

const PRIMARY: Paint = {
  background: 'primary',
  border: 'primary',
  foreground: 'primaryForeground',
};

/** at-btn--default / --outline / --ghost and their :hover, as the pressed state. */
export const BUTTON_PAINTS: Readonly<Record<ButtonVariant, PaintSet>> = Object.freeze({
  primary: { rest: PRIMARY, pressed: PRIMARY, pressedOpacity: 0.9 },
  outline: {
    rest: { background: 'card', border: 'border', foreground: 'foreground' },
    pressed: { background: 'ccHover', border: 'ccHoverBorder', foreground: 'foreground' },
    pressedOpacity: 1,
  },
  ghost: {
    rest: { background: 'transparent', border: 'transparent', foreground: 'mutedForeground' },
    pressed: { background: 'ccHover', border: 'transparent', foreground: 'foreground' },
    pressedOpacity: 1,
  },
});

export type ControlState = { readonly pressed?: boolean; readonly disabled?: boolean };

export type ControlPaint = {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly color: string;
  readonly opacity: number;
};

export function buttonPaint(
  colours: Colours,
  variant: ButtonVariant,
  state: ControlState = {},
): ControlPaint {
  const set = BUTTON_PAINTS[variant];
  const pressed = Boolean(state.pressed) && !state.disabled;
  const chosen = pressed ? set.pressed : set.rest;
  return {
    backgroundColor: paint(colours, chosen.background),
    borderColor: paint(colours, chosen.border),
    color: colours[chosen.foreground],
    opacity: state.disabled ? DISABLED_OPACITY : pressed ? set.pressedOpacity : 1,
  };
}

export type ButtonMetrics = {
  readonly height: number;
  readonly paddingX: SpaceName;
  readonly gap: SpaceName;
  /** The label's Body level: textRole('body', level). */
  readonly level: TextLevel;
  readonly iconSize: number;
};

/** at-btn (40 tall, 14 pt) and at-btn--xs / cc-btn (30 tall, 12 pt); labels at Geist 500. */
export const BUTTON_SIZES: Readonly<Record<ButtonSize, ButtonMetrics>> = Object.freeze({
  sm: { height: 30, paddingX: 'space5', gap: 'space2', level: 5, iconSize: 13 },
  md: { height: 40, paddingX: 'space7', gap: 'space2', level: 1, iconSize: 16 },
});

export const BUTTON_LABEL_WEIGHT = 500;

/** 30 (at-btn--xs icon), 36 (the header's buttons) and 42 (the composer's round send). */
export const ICON_BUTTON_SIZES: Readonly<
  Record<IconButtonSize, { readonly box: number; readonly icon: number }>
> = Object.freeze({
  sm: { box: 30, icon: 13 },
  md: { box: 36, icon: 16 },
  lg: { box: 42, icon: 18 },
});

/** at-card at rest; pressed takes the handoff's hover: --cc-hover ground, --cc-hover-border. */
export function cardPaint(
  colours: Colours,
  pressed: boolean,
): Pick<ControlPaint, 'backgroundColor' | 'borderColor'> {
  return pressed
    ? { backgroundColor: colours.ccHover, borderColor: colours.ccHoverBorder }
    : { backgroundColor: colours.card, borderColor: colours.border };
}

// ── Pills, chips, segments ──────────────────────────────────────────────────────────────────

/** The filter pill (the prototype's board filters): ink when on, card when off. */
export function pillPaint(
  colours: Colours,
  selected: boolean,
  state: ControlState = {},
): ControlPaint {
  const pressed = Boolean(state.pressed) && !selected;
  return {
    backgroundColor: selected ? colours.foreground : pressed ? colours.ccHover : colours.card,
    borderColor: selected ? colours.foreground : pressed ? colours.ccHoverBorder : colours.border,
    color: selected ? colours.card : colours.foreground,
    opacity: state.disabled ? DISABLED_OPACITY : 1,
  };
}

export const PILL_HEIGHT = 28;
export const DOT_SIZE = 7;
export const PILL_COUNT_OPACITY = 0.75;

/** cc-seg: muted track, the chosen segment on card with the hairline shadow. */
export function segmentPaint(
  colours: Colours,
  selected: boolean,
): Pick<ControlPaint, 'backgroundColor' | 'color'> {
  return {
    backgroundColor: selected ? colours.card : 'transparent',
    color: selected ? colours.foreground : colours.mutedForeground,
  };
}

export const SEGMENT_TRACK_INSET = 3;
export const SEGMENT_GAP = 2;
export const SEGMENT_PADDING_Y = 5;

export type Tone = 'accent' | 'success' | 'warning' | 'info' | 'muted';

/** The reason chip (accent at 10 %) and cc-status-pill's ok / warn / info at 15 %. */
export const TONES: Readonly<
  Record<Tone, { readonly ink: ColourName; readonly fill: ColourName; readonly alpha: number }>
> = Object.freeze({
  accent: { ink: 'accent', fill: 'accent', alpha: 0.1 },
  success: { ink: 'olive', fill: 'olive', alpha: 0.15 },
  warning: { ink: 'warnInk', fill: 'warnInk', alpha: 0.15 },
  info: { ink: 'info', fill: 'info', alpha: 0.15 },
  muted: { ink: 'mutedForeground', fill: 'muted', alpha: 1 },
});

export function tonePaint(
  colours: Colours,
  tone: Tone,
): Pick<ControlPaint, 'backgroundColor' | 'color'> {
  const spec = TONES[tone];
  return { backgroundColor: tint(colours[spec.fill], spec.alpha), color: colours[spec.ink] };
}

export const CHIP_PADDING_Y = 2;

// ── Status pips and counts ──────────────────────────────────────────────────────────────────

export type PipStatus = BoardStatus | 'live';

/** The handoff's column dots on tokens: ink, navy, warn-ink, warning, orange, olive. */
export const PIP_TOKENS: Readonly<Record<PipStatus, ColourName>> = Object.freeze({
  inbox: 'foreground',
  assigned: 'info',
  in_progress: 'warnInk',
  review: 'warning',
  blocked: 'accent',
  done: 'success',
  failed: 'destructive',
  cancelled: 'mutedForeground',
  closed: 'mutedForeground',
  live: 'ccLiveDot',
});

export type StatusPipSpec = { readonly tokenKey: ColourName; readonly word: string };

export function isPipStatus(status: string): status is PipStatus {
  return Object.prototype.hasOwnProperty.call(PIP_TOKENS, status);
}

/** The dot's token and its word; a status this version doesn't know is muted and says itself. */
export function statusPip(status: string): StatusPipSpec {
  if (!isPipStatus(status)) {
    return { tokenKey: 'mutedForeground', word: status.replace(/_/g, ' ').trim() };
  }
  const word = status === 'live' ? UI_COPY.live : STATUS_CONFIG[status].label;
  return { tokenKey: PIP_TOKENS[status], word };
}

export const BADGE_MAX = 99;
export const BADGE_MIN_SIZE = 16;

/** The count badge's text: nothing at 0 (the badge hides), '99+' past the cap. */
export function badgeText(count: number, max: number = BADGE_MAX): string | null {
  if (!Number.isFinite(count) || count < 1) return null;
  const whole = Math.floor(count);
  return whole > max ? `${max}+` : String(whole);
}

export type PluralForms = { readonly one: string; readonly other: string };

/** 'question' for 1, 'questions' otherwise (the copy is English in v1). */
export function pluralForm(count: number, forms: PluralForms): string {
  return count === 1 ? forms.one : forms.other;
}

/** '1 agent', '6 agents'. */
export function countPhrase(count: number, forms: PluralForms): string {
  return `${count} ${pluralForm(count, forms)}`;
}

/** The header's Command Centre button (handoff §1 Header): 36 pt high, a 15 pt icon, 12 pt label. */
export const COMMAND_CENTRE_BUTTON = Object.freeze({
  height: ICON_BUTTON_SIZES.md.box,
  iconSize: 15,
  level: 5 as TextLevel,
});

/** 'Command Centre', or 'Command Centre, 6 need you': the badge inside says nothing on its own. */
export function commandCentreLabel(total: number): string {
  const count = badgeText(total) === null ? null : countPhrase(Math.floor(total), UI_COPY.needYou);
  return joinLabel(UI_COPY.commandCentre, count);
}

// ── Fields and errors ───────────────────────────────────────────────────────────────────────

export const FIELD_HEIGHT = 40;
export const FIELD_MULTILINE_MIN_HEIGHT = 80;
/** The handoff's focus ring: olive (--ring), 3 pt at 18 %. */
export const FOCUS_RING = Object.freeze({ width: 3, alpha: 0.18 });

export type FieldState = {
  readonly focused?: boolean;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
};

/** The focus ring as a boxShadow layer: spread, no blur (CSS box-shadow 0 0 0 3px). */
export type RingLayer = {
  readonly offsetX: 0;
  readonly offsetY: 0;
  readonly spreadDistance: number;
  readonly color: string;
};

export type FieldPaint = ControlPaint & {
  readonly placeholder: string;
  /** The focus ring, or none when the field is not focused. */
  readonly boxShadow: readonly RingLayer[] | undefined;
};

/** at-input: card ground, border; ring on focus; orange border when invalid; half opacity off. */
export function fieldPaint(colours: Colours, state: FieldState = {}): FieldPaint {
  const focused = Boolean(state.focused) && !state.disabled;
  const borderColor = state.invalid ? colours.accent : focused ? colours.ring : colours.border;
  const ring = { offsetX: 0, offsetY: 0, spreadDistance: FOCUS_RING.width } as const;
  return {
    backgroundColor: colours.card,
    borderColor,
    color: colours.foreground,
    opacity: state.disabled ? DISABLED_OPACITY : 1,
    placeholder: colours.mutedForeground,
    boxShadow: focused ? [{ ...ring, color: tint(colours.ring, FOCUS_RING.alpha) }] : undefined,
  };
}

/** The line under a field: the error in the accent, else the helper muted, else nothing. */
export function fieldNote(
  error: string | undefined,
  helper: string | undefined,
): { readonly text: string; readonly tone: 'accent' | 'muted' } | null {
  if (error !== undefined) return { text: error, tone: 'accent' };
  if (helper !== undefined) return { text: helper, tone: 'muted' };
  return null;
}

/** Kinds a retry cannot fix: sign in again, ask for access, or the thing is gone. */
const NO_RETRY: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>([
  'auth',
  'forbidden',
  'not_found',
]);

export type ErrorCopy = {
  readonly title: string;
  readonly message: string;
  readonly canRetry: boolean;
};

/** What ErrorState shows: the taxonomy's own words (src/api/strings.ts), never internals. */
export function errorCopy(error: unknown): ErrorCopy {
  return {
    title: UI_COPY.errorTitle,
    message: userMessage(error),
    canRetry: !isApiError(error) || !NO_RETRY.has(error.kind),
  };
}
