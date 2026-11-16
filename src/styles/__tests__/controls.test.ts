// The control sizes builder (docs/app-standard.md rule 3.5): a style's controls are one list of
// sizes, Studio's by default, and a second list is built beside it without moving Studio's. A list
// that would put a pressable under the 44 pt touch target, or that says something no control can
// be, cannot be built; a built list is a frozen copy.

import { describe, expect, it } from 'vitest';

import { MIN_TOUCH } from '../../ui/paint';
import {
  CONTROL_SPECS,
  STUDIO_CONTROLS,
  buildControlSizes,
  controlSizesOf,
  controlTouchesOf,
  type ControlSizes,
} from '../controls';

/** A consumer app's larger controls: taller buttons and fields, a larger icon button box. */
const LARGER: ControlSizes = Object.freeze<ControlSizes>({
  ...CONTROL_SPECS,
  button: {
    sm: { ...CONTROL_SPECS.button.sm, height: 40 },
    md: { ...CONTROL_SPECS.button.md, height: 52, level: 1 },
  },
  iconButton: { ...CONTROL_SPECS.iconButton, md: { box: 44, icon: 20 } },
  field: { height: 52, multilineMinHeight: 104 },
});

describe("Studio's list", () => {
  it('is what every primitive drew when the sizes were constants (the handoff’s)', () => {
    expect(STUDIO_CONTROLS).toEqual({
      button: {
        sm: { height: 30, paddingX: 'space5', gap: 'space2', level: 5, iconSize: 13 },
        md: { height: 40, paddingX: 'space7', gap: 'space2', level: 1, iconSize: 16 },
      },
      buttonMinHeight: 30,
      panelButtonMinHeight: 30,
      commandCentre: { height: 36, iconSize: 15, level: 5 },
      iconButton: {
        sm: { box: 30, icon: 13 },
        md: { box: 36, icon: 16 },
        lg: { box: 42, icon: 18 },
      },
      field: { height: 40, multilineMinHeight: 80 },
      pillMinHeight: 28,
      segment: { minHeight: 38, trackInset: 3, paddingY: 5, gap: 2 },
    });
  });

  it('is built from its specs unchanged', () => {
    expect(buildControlSizes(CONTROL_SPECS)).toEqual(STUDIO_CONTROLS);
  });

  it('takes the 44 pt touch for every pressable it sizes', () => {
    const touches = controlTouchesOf(STUDIO_CONTROLS);
    expect(touches.map(([name]) => name)).toEqual([
      'button.sm',
      'button.md',
      'commandCentre',
      'iconButton.sm',
      'iconButton.md',
      'iconButton.lg',
      'pill',
      'segment',
    ]);
    touches.forEach(([name, touch]) => expect(touch, name).toBeGreaterThanOrEqual(MIN_TOUCH));
  });
});

describe('buildControlSizes', () => {
  it('builds a second list beside Studio’s, and leaves Studio’s pinned', () => {
    const larger = buildControlSizes(LARGER);
    expect(larger.button.md.height).toBe(52);
    expect(larger.iconButton.md).toEqual({ box: 44, icon: 20 });
    expect(larger.field).toEqual({ height: 52, multilineMinHeight: 104 });
    expect(STUDIO_CONTROLS.button.md.height).toBe(40);
    expect(STUDIO_CONTROLS.field.height).toBe(40);
  });

  it('keeps a frozen copy: a later change to the caller’s list moves nothing', () => {
    const own = { ...LARGER, field: { height: 52, multilineMinHeight: 104 } };
    const built = buildControlSizes(own);
    own.field.height = 20;
    expect(built.field.height).toBe(52);
    expect(Object.isFrozen(built)).toBe(true);
    expect(Object.isFrozen(built.button.sm)).toBe(true);
    expect(Object.isFrozen(built.iconButton.lg)).toBe(true);
    expect(Object.isFrozen(built.segment)).toBe(true);
  });

  it('builds a small control that takes the rest of its 44 pt as slop', () => {
    const small = { ...CONTROL_SPECS, pillMinHeight: 20 };
    expect(buildControlSizes(small).pillMinHeight).toBe(20);
  });

  it('refuses a segment that its track’s inset cannot bring to 44 pt, naming it', () => {
    const short = { ...CONTROL_SPECS, segment: { ...CONTROL_SPECS.segment, minHeight: 30 } };
    expect(() => buildControlSizes(short)).toThrow(/segment takes a 36 pt touch/);
    const flat = { ...CONTROL_SPECS, segment: { ...CONTROL_SPECS.segment, trackInset: 0 } };
    expect(() => buildControlSizes(flat)).toThrow(/segment takes a 38 pt touch: .* under 44 pt/);
  });

  it.each([
    [
      'a negative height',
      { button: { ...CONTROL_SPECS.button, sm: { ...CONTROL_SPECS.button.sm, height: -30 } } },
      /button\.sm\.height is -30/,
    ],
    ['no height at all', { pillMinHeight: 0 }, /pillMinHeight is 0/],
    [
      'a size that is not a number',
      { field: { height: Number.NaN, multilineMinHeight: 80 } },
      /field\.height is NaN/,
    ],
    [
      'an endless size',
      { buttonMinHeight: Number.POSITIVE_INFINITY },
      /buttonMinHeight is Infinity/,
    ],
    ['a negative gap', { segment: { ...CONTROL_SPECS.segment, gap: -2 } }, /segment\.gap is -2/],
    [
      'an icon larger than its box',
      { iconButton: { ...CONTROL_SPECS.iconButton, sm: { box: 30, icon: 32 } } },
      /iconButton\.sm's icon is larger than its 30 pt box/,
    ],
    [
      'a multiline field shorter than a line',
      { field: { height: 40, multilineMinHeight: 30 } },
      /field\.multilineMinHeight 30 is under one line's 40/,
    ],
  ] as const)('refuses %s', (_what, change, message) => {
    expect(() => buildControlSizes({ ...CONTROL_SPECS, ...change } as ControlSizes)).toThrow(
      message,
    );
  });

  it('names every size it checks', () => {
    expect(controlSizesOf(STUDIO_CONTROLS)).toHaveLength(18);
  });
});
