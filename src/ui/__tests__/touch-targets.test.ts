// The segmented control's and the text field's touch, read from source (vitest runs in node with no
// React renderer, and the controls load React Native): each segment is at least its style's
// segment.minHeight tall, so with the track's inset as its slop (a slop past the track is lost) it
// takes the 44 pt touch in every style; the text field is drawn its style's field.height and its
// frame's slop grows that to 44, with room for the slop in the field's own box, so nothing moves.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { STYLE_CONTROLS } from '../../styles/tokens/controls';
import { MIN_TOUCH } from '../paint';
import { fieldTouch, segmentSlop } from '../variants';

const control = readFileSync(path.resolve(__dirname, '..', 'SegmentedControl.tsx'), 'utf8');
const textField = readFileSync(path.resolve(__dirname, '..', 'TextField.tsx'), 'utf8');

describe('a segment', () => {
  it('is at least 38 tall, 44 with the track’s 3 pt inset as its slop, in every style', () => {
    for (const { segment } of Object.values(STYLE_CONTROLS)) {
      expect(segment).toEqual({ minHeight: 38, trackInset: 3, paddingY: 5, gap: 2 });
      expect(segment.minHeight + 2 * segment.trackInset).toBe(MIN_TOUCH);
      expect(segmentSlop(segment)).toEqual({ top: 3, bottom: 3 });
    }
  });

  it('sets its style’s least height, and the inset as its slop', () => {
    expect(control).toMatch(/const sizes = style\.controls\.segment;/);
    expect(control).toMatch(/minHeight: sizes\.minHeight,/);
    expect(control).toMatch(/const slop = segmentSlop\(sizes\);/);
    expect(control).toMatch(/hitSlop=\{slop\}/);
    expect(control).toMatch(/padding: sizes\.trackInset,/);
  });
});

describe('the text field', () => {
  it('takes the 44 pt touch in every style, and a multiline area takes no slop', () => {
    for (const { field } of Object.values(STYLE_CONTROLS)) {
      const { slop } = fieldTouch(field, false);
      expect(field.height + slop.top + slop.bottom).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(fieldTouch(field, true).slop).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    }
  });

  it('is 40 drawn with 2 of slop above and below, and makes the same room so nothing moves', () => {
    expect(fieldTouch({ height: 40, multilineMinHeight: 80 }, false)).toEqual({
      slop: { top: 2, bottom: 2, left: 0, right: 0 },
      room: { paddingVertical: 2, marginVertical: -2 },
    });
  });

  it('keeps its drawn height, padding and type', () => {
    expect(textField).toContain(
      '{ minHeight: multiline ? field.multilineMinHeight : field.height }',
    );
    expect(textField).toContain('paddingVertical: tokens.spacing.space3,');
    expect(textField).toContain("const face = textFace(tokens.type, 'body1');");
  });

  it('puts the slop on a frame round the input, whose touch focuses it, with room in its own box', () => {
    expect(textField).toContain('const touch = fieldTouch(field, multiline);');
    expect(textField).toMatch(/<View\s+collapsable=\{false\}\s+hitSlop=\{touch\.slop\}/);
    expect(textField).toContain('onStartShouldSetResponder={takesTouch}');
    expect(textField).toContain('onResponderRelease={focus}');
    expect(textField).toContain('const focus = () => inputRef.current?.focus();');
    expect(textField).toContain('const takesTouch = () => !disabled;');
    expect(textField).toContain(
      '<View style={[styles.field, touch.room, { gap: tokens.spacing.space2 }]}>',
    );
  });
});
