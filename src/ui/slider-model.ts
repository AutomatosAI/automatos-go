// The Slider's logic (KS7), pure: a value and the thumb's place on the track, both ways. The track
// spans min to max; maxAllowed (max when not given) is where the thumb stops — the glow's AA cap
// (KS9) stops Play's and HUD's glow sliders below max — so the track past it is drawn but never
// reached. Values are whole steps from min. The functions the gesture calls on the UI thread are
// worklets (the directive is a plain string to node, so vitest runs them as they are).

/** The slider's sizes: a 4 pt track, a 28 pt thumb, in a row as tall as a touch target. */
export const SLIDER = Object.freeze({ trackHeight: 4, thumbSize: 28, rowHeight: 44 });

export type SliderRange = {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** The highest value the thumb reaches: a whole step from min, at most maxAllowed. */
  readonly highest: number;
};

export type SliderLimits = {
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly maxAllowed?: number;
};

/**
 * How far short of a whole step a count of steps may fall and still be that step: a fractional
 * step's float error (0.4 / 0.05 is 7.999999999999998) never loses the last step.
 */
const STEP_TOLERANCE = 1e-9;

/** The range for these limits; maxAllowed outside [min, max] is brought inside it. */
export function sliderRange({ min, max, step = 1, maxAllowed = max }: SliderLimits): SliderRange {
  if (!(max > min)) throw new RangeError(`a slider needs max above min (${min}..${max})`);
  if (!(step > 0)) throw new RangeError(`a slider's step must be above 0 (${step})`);
  const cap = Math.min(Math.max(maxAllowed, min), max);
  const highest = min + Math.floor((cap - min) / step + STEP_TOLERANCE) * step;
  return Object.freeze({ min, max, step, highest });
}

/** The nearest whole step to value, within [min, highest]. */
export function clampValue(value: number, range: SliderRange): number {
  'worklet';
  const stepped = range.min + Math.round((value - range.min) / range.step) * range.step;
  return Math.min(Math.max(stepped, range.min), range.highest);
}

/** The thumb's offset along a track trackLength long (0 at min, trackLength at max). */
export function valueToOffset(value: number, range: SliderRange, trackLength: number): number {
  'worklet';
  if (trackLength <= 0) return 0;
  return ((clampValue(value, range) - range.min) / (range.max - range.min)) * trackLength;
}

/** The value at an offset along the track, in whole steps, never past highest. */
export function offsetToValue(offset: number, range: SliderRange, trackLength: number): number {
  'worklet';
  if (trackLength <= 0) return range.min;
  return clampValue(range.min + (offset / trackLength) * (range.max - range.min), range);
}

/** How far the thumb's centre travels in a slider this wide (half a thumb in at each end). */
export function trackLength(width: number): number {
  'worklet';
  return Math.max(width - SLIDER.thumbSize, 0);
}

/** The value under a touch x points from the slider's left edge. */
export function touchToValue(x: number, range: SliderRange, width: number): number {
  'worklet';
  return offsetToValue(x - SLIDER.thumbSize / 2, range, trackLength(width));
}

export type AdjustAction = 'increment' | 'decrement';

/** VoiceOver's and TalkBack's swipe: one step up or down, within the range. */
export function adjustValue(value: number, range: SliderRange, action: AdjustAction): number {
  const direction = action === 'increment' ? 1 : -1;
  return clampValue(clampValue(value, range) + direction * range.step, range);
}

export function isAdjustAction(name: string): name is AdjustAction {
  return name === 'increment' || name === 'decrement';
}

export type SliderAccessibilityValue = {
  readonly min: number;
  readonly max: number;
  readonly now: number;
  readonly text: string;
};

/** What a screen reader hears: max is the highest the thumb reaches; text the value in words. */
export function sliderAccessibilityValue(
  value: number,
  range: SliderRange,
  text?: string,
): SliderAccessibilityValue {
  const now = clampValue(value, range);
  return Object.freeze({ min: range.min, max: range.highest, now, text: text ?? String(now) });
}

export type SliderShape = { readonly thumbRadius: number; readonly trackRadius: number };

/** HUD's thumb and track are square (radius 0 everywhere); round elsewhere. */
export function sliderShape(square: boolean): SliderShape {
  if (square) return Object.freeze({ thumbRadius: 0, trackRadius: 0 });
  return Object.freeze({
    thumbRadius: SLIDER.thumbSize / 2,
    trackRadius: SLIDER.trackHeight / 2,
  });
}
