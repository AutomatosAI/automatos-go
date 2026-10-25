import { describe, expect, it } from 'vitest';

import { TYPE_STYLES } from '../../../core/web/lib/looks/catalogue';
import { HUD_LABEL_TRACKING } from '../../tokens/hud-catalogue';
import { parseEm, trackingPt } from '../tracking';

describe('parseEm', () => {
  it("reads the vendored TYPE_STYLES letterSpacing strings ('0', '-.03em', '-.02em')", () => {
    expect(parseEm(TYPE_STYLES.serif.letterSpacing)).toBe(0);
    expect(parseEm(TYPE_STYLES.clean.letterSpacing)).toBe(-0.03);
    expect(parseEm(TYPE_STYLES.bric.letterSpacing)).toBe(-0.02);
    expect(parseEm(TYPE_STYLES.round.letterSpacing)).toBe(0);
  });

  it("reads HUD's panel label tracking and a leading zero", () => {
    expect(parseEm(HUD_LABEL_TRACKING)).toBe(0.2);
    expect(parseEm('0.14em')).toBe(0.14);
    expect(parseEm(' .18em ')).toBe(0.18);
  });

  it('refuses anything that is not em', () => {
    for (const value of ['', 'abc', '2px', '.2', '-.1', 'em', '1.2.3em', 'normal']) {
      expect(() => parseEm(value)).toThrow();
    }
  });
});

describe('trackingPt', () => {
  it('turns em into points at the size, to two decimals', () => {
    expect(trackingPt(0.14, 11)).toBe(1.54);
    expect(trackingPt(0.18, 16)).toBe(2.88);
    expect(trackingPt(0.2, 13)).toBe(2.6);
    expect(trackingPt(-0.03, 47)).toBe(-1.41);
    expect(trackingPt(0.12, 11)).toBe(1.32);
  });

  it('takes a vendored string as well as a number', () => {
    expect(trackingPt('-.03em', 35)).toBe(-1.05);
    expect(trackingPt('-.02em', 58)).toBe(-1.16);
    expect(trackingPt('.2em', 12)).toBe(2.4);
  });

  it('never returns -0', () => {
    expect(Object.is(trackingPt('0', 58), 0)).toBe(true);
    expect(Object.is(trackingPt(-0.0001, 11), 0)).toBe(true);
  });
});
