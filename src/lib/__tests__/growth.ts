// How a function's work grows with its input, for the tests of the single passes that replaced
// patterns which started again at every character of a long run (test-only). The time at a size and
// at GROWTH_FACTOR times it, each the least of several runs so one slow run on a busy machine does
// not count, compared with each other, never with a clock: a single pass grows about GROWTH_FACTOR
// times, a pattern that reads the run again from each of its characters about its square. A run so
// slow at the first size that the larger one would take minutes fails at once instead.
// Also a seeded source of short random texts, to hold a single pass to the pattern it replaced.

/** The larger size is this many times the first. */
export const GROWTH_FACTOR = 8;
/** Growth under this is a single pass (about GROWTH_FACTOR); a quadratic one is near its square. */
export const LINEAR_GROWTH_LIMIT = 20;
/** The first size taking longer than this already shows a pattern that is not a single pass. */
const TOO_SLOW_MS = 250;
const RUNS = 5;

function leastMs(run: () => void): number {
  run(); // the first run compiles the code; it is not counted
  const times = Array.from({ length: RUNS }, () => {
    const started = performance.now();
    run();
    return performance.now() - started;
  });
  return Math.min(...times);
}

/** How many times longer `build(size * GROWTH_FACTOR)` takes than `build(size)`. */
export function growth(build: (size: number) => () => unknown, size: number): number {
  const small = leastMs(build(size));
  if (small > TOO_SLOW_MS) return Number.POSITIVE_INFINITY;
  const large = leastMs(build(size * GROWTH_FACTOR));
  return large / Math.max(small, 0.01);
}

/** Texts of up to `longest` characters drawn from `alphabet`, the same ones on every run. */
export function randomTexts(alphabet: string, count: number, longest: number): readonly string[] {
  let seed = 0x9e3779b9;
  const next = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let mixed = Math.imul(seed ^ (seed >>> 15), seed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const length = Math.floor(next() * (longest + 1));
    return Array.from({ length }, () => alphabet.charAt(Math.floor(next() * alphabet.length))).join(
      '',
    );
  });
}
