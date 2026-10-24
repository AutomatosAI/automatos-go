// Tracking: the designs give letter-spacing in CSS em ('.14em', the vendored TYPE_STYLES' '0',
// '-.03em' and '-.02em'); React Native's letterSpacing is in points, so each is em times the
// size, rounded to two decimals as type.ts rounds Studio's.

const EM = /^(-?)(\d*\.?\d+)(em)?$/;
const DECIMALS_SCALE = 100;

/** A CSS letter-spacing in em ('0', '-.03em', '.2em') as a number; anything else throws. */
export function parseEm(value: string): number {
  const match = EM.exec(value.trim());
  if (!match) throw new Error(`'${value}' is not a letter-spacing in em`);
  const [, sign, digits, unit] = match;
  const amount = Number(digits);
  if (amount !== 0 && unit === undefined) throw new Error(`'${value}' has no em unit`);
  return sign === '-' ? -amount : amount;
}

/** CSS em (a number, or a vendored string) at a size → React Native letterSpacing in points. */
export function trackingPt(em: number | string, size: number): number {
  const amount = typeof em === 'string' ? parseEm(em) : em;
  const points = Math.round(amount * size * DECIMALS_SCALE) / DECIMALS_SCALE;
  return points === 0 ? 0 : points; // never -0
}
