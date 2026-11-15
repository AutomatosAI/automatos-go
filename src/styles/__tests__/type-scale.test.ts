// The scale builder (docs/app-standard.md rule 2.3): a second type scale is a list of specs built
// beside Studio's, whose pins do not move. A role drawn at another weight keeps its size in its own
// scale (specsOf), and a scale with a role under 11 pt (D38, rule 2.4) cannot be built.

import { describe, expect, it } from 'vitest';

import { textFace } from '../../ui/variants';
import {
  MIN_TEXT_SIZE,
  STUDIO_TYPE,
  TYPE_SPECS,
  buildTypeScale,
  specsOf,
  type TypeScale,
  type TypeSpecs,
} from '../type';

const LARGE_BODY = 16;
const LARGE_LEADING = 1.5;
const MEDIUM = 500;

/** Studio's specs with the first body role at a phone's reading size. */
const LARGER: TypeSpecs = Object.freeze({
  ...TYPE_SPECS,
  body1: { ...TYPE_SPECS.body1, size: LARGE_BODY, leading: LARGE_LEADING },
});

describe('buildTypeScale', () => {
  it("builds Studio's scale from Studio's specs, unchanged", () => {
    expect(buildTypeScale(TYPE_SPECS)).toEqual(STUDIO_TYPE);
  });

  it('builds a second scale beside it, and leaves Studio pinned', () => {
    const studioBody = { ...STUDIO_TYPE.body1 };
    const larger = buildTypeScale(LARGER);
    expect(larger.body1).toMatchObject({
      fontSize: LARGE_BODY,
      lineHeight: LARGE_BODY * LARGE_LEADING,
    });
    expect(larger.body1.fontFamily).toBe(STUDIO_TYPE.body1.fontFamily);
    expect(larger.title1).toEqual(STUDIO_TYPE.title1);
    expect(STUDIO_TYPE.body1).toEqual(studioBody);
  });

  it('freezes the scale it builds', () => {
    expect(Object.isFrozen(buildTypeScale(LARGER))).toBe(true);
  });

  it('refuses a role under the smallest text size, naming it', () => {
    const tooSmall: TypeSpecs = {
      ...TYPE_SPECS,
      body6: { ...TYPE_SPECS.body6, size: MIN_TEXT_SIZE - 1 },
    };
    expect(() => buildTypeScale(tooSmall)).toThrow(/body6 is 10 pt/);
  });

  it('accepts a role at exactly the smallest text size', () => {
    const atFloor: TypeSpecs = {
      ...TYPE_SPECS,
      body6: { ...TYPE_SPECS.body6, size: MIN_TEXT_SIZE },
    };
    expect(buildTypeScale(atFloor).body6.fontSize).toBe(MIN_TEXT_SIZE);
  });
});

describe('specsOf', () => {
  it('returns the specs a scale was built from', () => {
    expect(specsOf(STUDIO_TYPE)).toBe(TYPE_SPECS);
    expect(specsOf(buildTypeScale(LARGER))).toBe(LARGER);
  });

  it("returns Studio's for a scale built some other way", () => {
    const copied: TypeScale = { ...STUDIO_TYPE };
    expect(specsOf(copied)).toBe(TYPE_SPECS);
  });
});

describe('a role at another weight keeps its size in its own scale', () => {
  it('in a second scale', () => {
    const larger = buildTypeScale(LARGER);
    const face = textFace(larger, 'body1', { weight: MEDIUM });
    expect(face.fontSize).toBe(LARGE_BODY);
    expect(face.fontFamily).not.toBe(larger.body1.fontFamily);
  });

  it("and in Studio's, as before", () => {
    const face = textFace(STUDIO_TYPE, 'body1', { weight: MEDIUM });
    expect(face.fontSize).toBe(TYPE_SPECS.body1.size);
    expect(face.fontFamily).not.toBe(STUDIO_TYPE.body1.fontFamily);
  });

  it("with no override it is the scale's own style, not a copy", () => {
    const larger = buildTypeScale(LARGER);
    expect(textFace(larger, 'body1')).toBe(larger.body1);
  });
});
