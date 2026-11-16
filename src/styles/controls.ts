// Studio's control sizes (handoff README 'Design Tokens' and the design system's studio.css:
// at-btn, at-btn--xs, the header's buttons, the composer's round send, at-input, cc-filter-pill,
// cc-seg), as one list a style supplies (docs/app-standard.md rule 3.5). The primitives read the
// list of the style they paint (ResolvedStyle.controls, through useStyle()), so an app whose
// controls are larger builds a second list beside Studio's with buildControlSizes and gives it to
// its style (tokens/controls.ts), and no primitive changes.
//
// The builder refuses a list that would put a pressable under the 44 pt touch target: a control
// drawn smaller than 44 takes the rest as slop (ui/paint.ts hitSlopFor) where the primitive gives
// it one, the text field too (its frame's slop, with room for it in the field's own box:
// ui/variants.ts fieldTouch), and a segment takes only its track's inset (a slop past the track is
// lost). It refuses
// nonsense too: a size that is not a number of points above 0, a negative inset or gap, an icon
// larger than its control, a multiline field shorter than one line.

import type { SpaceName } from './tokens/types';
import { MIN_TOUCH, hitSlopFor } from '../ui/paint';
import type { TextLevel } from '../ui/variants';

export type ButtonSize = 'sm' | 'md';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export type ButtonMetrics = {
  readonly height: number;
  readonly paddingX: SpaceName;
  readonly gap: SpaceName;
  /** The label's Body level: textRole('body', level). */
  readonly level: TextLevel;
  readonly iconSize: number;
};

export type IconButtonMetrics = { readonly box: number; readonly icon: number };

export type CommandCentreMetrics = {
  readonly height: number;
  readonly iconSize: number;
  readonly level: TextLevel;
};

export type FieldMetrics = { readonly height: number; readonly multilineMinHeight: number };

export type SegmentMetrics = {
  /** A segment's least height: with the track's inset as its slop, at least the 44 pt touch. */
  readonly minHeight: number;
  readonly trackInset: number;
  readonly paddingY: number;
  readonly gap: number;
};

export type ControlSizes = {
  readonly button: Readonly<Record<ButtonSize, ButtonMetrics>>;
  /** The least any button is tall; a size taller keeps its own (Studio: its smallest size). */
  readonly buttonMinHeight: number;
  /** The least a button is tall inside a panel (a Card). */
  readonly panelButtonMinHeight: number;
  readonly commandCentre: CommandCentreMetrics;
  readonly iconButton: Readonly<Record<IconButtonSize, IconButtonMetrics>>;
  readonly field: FieldMetrics;
  /** The filter pill's least height. */
  readonly pillMinHeight: number;
  readonly segment: SegmentMetrics;
};

/** at-btn (40 tall, 14 pt) and at-btn--xs / cc-btn (30 tall, 12 pt). */
const BUTTONS: ControlSizes['button'] = Object.freeze({
  sm: { height: 30, paddingX: 'space5', gap: 'space2', level: 5, iconSize: 13 },
  md: { height: 40, paddingX: 'space7', gap: 'space2', level: 1, iconSize: 16 },
});

/** 30 (at-btn--xs icon), 36 (the header's buttons) and 42 (the composer's round send). */
const ICON_BUTTONS: ControlSizes['iconButton'] = Object.freeze({
  sm: { box: 30, icon: 13 },
  md: { box: 36, icon: 16 },
  lg: { box: 42, icon: 18 },
});

/** Studio's sizes, the default list: what every primitive drew before sizes came from a style. */
export const CONTROL_SPECS: ControlSizes = Object.freeze<ControlSizes>({
  button: BUTTONS,
  buttonMinHeight: BUTTONS.sm.height,
  panelButtonMinHeight: BUTTONS.sm.height,
  // the Command Centre button (handoff §1 Header; D73): the header's 36, a 15 pt icon, 12 pt label
  commandCentre: { height: ICON_BUTTONS.md.box, iconSize: 15, level: 5 },
  iconButton: ICON_BUTTONS,
  // at-input: 40 tall, a multiline area from 80
  field: { height: 40, multilineMinHeight: 80 },
  pillMinHeight: 28,
  // cc-seg: a 3 pt inset round the segments, 2 between them, 5 above and below each label
  segment: { minHeight: MIN_TOUCH - 2 * 3, trackInset: 3, paddingY: 5, gap: 2 },
});

type Named = readonly (readonly [string, number])[];

/** Every size in the list, by its name ('button.sm.height'): each a number of points above 0. */
export function controlSizesOf(specs: ControlSizes): Named {
  const { button, commandCentre, field, iconButton, segment } = specs;
  return [
    ...Object.entries(button).flatMap(([size, metrics]): Named => [
      [`button.${size}.height`, metrics.height],
      [`button.${size}.iconSize`, metrics.iconSize],
    ]),
    ['buttonMinHeight', specs.buttonMinHeight],
    ['panelButtonMinHeight', specs.panelButtonMinHeight],
    ['commandCentre.height', commandCentre.height],
    ['commandCentre.iconSize', commandCentre.iconSize],
    ...Object.entries(iconButton).flatMap(([size, metrics]): Named => [
      [`iconButton.${size}.box`, metrics.box],
      [`iconButton.${size}.icon`, metrics.icon],
    ]),
    ['field.height', field.height],
    ['field.multilineMinHeight', field.multilineMinHeight],
    ['pillMinHeight', specs.pillMinHeight],
    ['segment.minHeight', segment.minHeight],
  ];
}

/** The insets and gaps in the list: each 0 or more. */
function controlRoomOf({ segment }: ControlSizes): Named {
  return [
    ['segment.trackInset', segment.trackInset],
    ['segment.paddingY', segment.paddingY],
    ['segment.gap', segment.gap],
  ];
}

/** The touch a control drawn this tall takes: its height and the slop the primitive gives it. */
function slopTouch(height: number): number {
  const slop = hitSlopFor(height);
  return height + slop.top + slop.bottom;
}

/** Each pressable's touch in points, by its name: none may be under MIN_TOUCH. */
export function controlTouchesOf(specs: ControlSizes): Named {
  const { button, commandCentre, field, iconButton, segment } = specs;
  return [
    ...Object.entries(button).map(
      ([size, { height }]) => [`button.${size}`, slopTouch(height)] as const,
    ),
    ['commandCentre', slopTouch(commandCentre.height)],
    ...Object.entries(iconButton).map(
      ([size, { box }]) => [`iconButton.${size}`, slopTouch(box)] as const,
    ),
    ['pill', slopTouch(specs.pillMinHeight)],
    ['field', slopTouch(field.height)],
    ['field.multiline', slopTouch(field.multilineMinHeight)],
    ['segment', segment.minHeight + 2 * segment.trackInset],
  ];
}

/** What the list says that cannot be drawn, or null when every control can be. */
function nonsenseIn(specs: ControlSizes): string | null {
  const size = controlSizesOf(specs).find(([, value]) => !(Number.isFinite(value) && value > 0));
  if (size) return `${size[0]} is ${size[1]}: a size is a number of points above 0`;
  const room = controlRoomOf(specs).find(([, value]) => !(Number.isFinite(value) && value >= 0));
  if (room) return `${room[0]} is ${room[1]}: an inset or a gap is 0 or more points`;
  const icon = Object.entries(specs.iconButton).find(([, { box, icon: glyph }]) => glyph > box);
  if (icon) return `iconButton.${icon[0]}'s icon is larger than its ${icon[1].box} pt box`;
  const { height, multilineMinHeight } = specs.field;
  if (multilineMinHeight < height) {
    return `field.multilineMinHeight ${multilineMinHeight} is under one line's ${height}`;
  }
  return null;
}

function frozenEach<Key extends string, Value extends object>(
  record: Readonly<Record<Key, Value>>,
): Readonly<Record<Key, Value>> {
  const entries = Object.entries<Value>(record).map(([key, value]) => [
    key,
    Object.freeze({ ...value }),
  ]);
  return Object.freeze(Object.fromEntries(entries)) as Readonly<Record<Key, Value>>;
}

/**
 * A style's control sizes from a list of them (rule 3.5), as buildTypeScale builds a type scale:
 * an app adds a second list beside Studio's, which stays pinned to its handoff. Throws for a list
 * that would put a pressable under the 44 pt touch target, or that says something no control can
 * be, naming the part, so such a list never reaches a screen. The list is copied and frozen, so a
 * later change to the caller's object cannot move a control.
 */
export function buildControlSizes(specs: ControlSizes): ControlSizes {
  const nonsense = nonsenseIn(specs);
  if (nonsense) throw new RangeError(nonsense);
  const short = controlTouchesOf(specs).find(([, touch]) => touch < MIN_TOUCH);
  if (short) {
    throw new RangeError(
      `${short[0]} takes a ${short[1]} pt touch: no pressable is under ${MIN_TOUCH} pt`,
    );
  }
  return Object.freeze({
    ...specs,
    button: frozenEach(specs.button),
    commandCentre: Object.freeze({ ...specs.commandCentre }),
    iconButton: frozenEach(specs.iconButton),
    field: Object.freeze({ ...specs.field }),
    segment: Object.freeze({ ...specs.segment }),
  });
}

/** Studio's sizes, built: the list every style starts from. */
export const STUDIO_CONTROLS: ControlSizes = buildControlSizes(CONTROL_SPECS);
