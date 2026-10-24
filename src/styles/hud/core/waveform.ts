// HUD's waveform (D54, D-ONE-VOICE), pure: wave() in 'Automatos Command HUD.dc.html', 44 bars 36 high
// with 3 pt gaps on the phone (72 bars 44 high on the desktop). Bar i stands at
// v = 0.25 + 0.75 x |sin(1.7 i) x cos(0.37 i)|: round(36 v) high, at opacity 0.35 + 0.65 v, and while
// loops run it breathes from its centre, scaleY 0.25 ↔ 1 (hudWave, ease-in-out, alternate), over
// 0.6 + (i mod 5) x 0.12 s after a (i mod 7) x 0.07 s delay. With motion off every bar stands still
// at its full height. A6's live mic hands Waveform.tsx its levels instead (README: 'Live mic level
// while held'): each bar then stands at the level nearest it, never under the loop's least scale.

export const WAVE = Object.freeze({
  phone: Object.freeze({ bars: 44, height: 36 }),
  desktop: Object.freeze({ bars: 72, height: 44 }),
  gap: 3,
  base: 0.25,
  swing: 0.75,
  sinStep: 1.7,
  cosStep: 0.37,
  opacityBase: 0.35,
  opacitySwing: 0.65,
  scale: Object.freeze([0.25, 1] as const),
  durationS: 0.6,
  durationStepS: 0.12,
  durationCycle: 5,
  delayStepS: 0.07,
  delayCycle: 7,
});

const MS = 1000;

export type WaveBar = {
  readonly index: number;
  /** The bar's level, 0.25 to 1. */
  readonly value: number;
  readonly height: number;
  readonly opacity: number;
  /** One way of the alternating breath (0.25 → 1, then back over the same time). */
  readonly durationMs: number;
  readonly delayMs: number;
};

/** The level of bar i. */
export function waveValue(index: number): number {
  const { base, swing, sinStep, cosStep } = WAVE;
  return base + swing * Math.abs(Math.sin(index * sinStep) * Math.cos(index * cosStep));
}

/** Milliseconds, to a whole one (0.6 + 4 x 0.12 s is 1080 ms, not 1079.9999). */
const toMs = (seconds: number) => Math.round(seconds * MS);

export function waveBar(index: number, height: number = WAVE.phone.height): WaveBar {
  const value = waveValue(index);
  return Object.freeze({
    index,
    value,
    height: Math.round(height * value),
    opacity: WAVE.opacityBase + value * WAVE.opacitySwing,
    durationMs: toMs(WAVE.durationS + (index % WAVE.durationCycle) * WAVE.durationStepS),
    delayMs: toMs((index % WAVE.delayCycle) * WAVE.delayStepS),
  });
}

export function waveBars(
  count: number = WAVE.phone.bars,
  height: number = WAVE.phone.height,
): readonly WaveBar[] {
  return Object.freeze(Array.from({ length: count }, (_, index) => waveBar(index, height)));
}

/** Each bar's width when count bars share width with WAVE.gap between them (flex: 1). */
export function barWidth(width: number, count: number = WAVE.phone.bars, gap: number = WAVE.gap) {
  if (count < 1) return 0;
  return Math.max(0, (width - gap * (count - 1)) / count);
}

const clampScale = (level: number) => {
  const [least, most] = WAVE.scale;
  const finite = Number.isFinite(level) ? level : least;
  return Math.min(Math.max(finite, least), most);
};

/**
 * The live mic's levels (0 to 1, oldest first) as each bar's scaleY: bar i takes the level at the
 * same place along the run, held to 0.25-1. Null when there are none: the bars do as motion says.
 */
export function levelScales(
  levels: readonly number[] | null | undefined,
  count: number = WAVE.phone.bars,
): readonly number[] | null {
  if (!levels || levels.length === 0) return null;
  return Object.freeze(
    Array.from({ length: count }, (_, index) =>
      clampScale(levels[Math.floor((index * levels.length) / count)] ?? WAVE.scale[0]),
    ),
  );
}
