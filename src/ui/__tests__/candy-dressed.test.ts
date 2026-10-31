// The primitives under Candy's dress (US-023k, D-ONE-SET, CANDY-LAYOUT §7): its controls in
// Nunito 800 13, its labels Nunito 700 14, its panel heads in its section title (Outfit 600 20) and
// every panel on its tinted shadow; buttons 44 high at least, an edge screen's action 50; rows 52
// over 1.5 pt rules; and the Slider, which takes its colours from the dress: every other style's
// exactly as before (primary on muted), Candy's round thumb and fill in the accent on the chip.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FONT_FAMILIES } from '../../styles/fonts';
import { dressOf } from '../../styles/dress/dress';
import {
  ALL_STYLES,
  ARCADE,
  CANDY,
  CANDY_STYLES,
  HUD,
  PLAY,
  STUDIO_STYLES,
} from '../../styles/dress/__tests__/fixtures';
import { faceFor } from '../../styles/typeface/faces';
import { TITLE_ROLES } from '../../styles/typeface/scale';
import { DISABLED_OPACITY } from '../paint';
import {
  buttonHeight,
  controlLabel,
  dressedButtonPaint,
  dressedPanelPaint,
  dressedPillPaint,
  dressedRow,
  dressedSegmentPaint,
  dressedSliderPaint,
  dressedTextFace,
  edgeActionHeight,
  fieldLabelStyle,
  labelStyle,
  panelHeaderStyle,
} from '../dressed';
import { BUTTON_SIZES, type TextLevel } from '../variants';

const LEVELS: readonly TextLevel[] = [1, 2, 3, 4, 5, 6];

describe('Candy', () => {
  it('writes controls in Nunito 800 13, labels Nunito 700 14, panel heads in the section title', () => {
    const dress = dressOf(CANDY);
    const extraBold = faceFor(FONT_FAMILIES.nunito, 800);
    for (const level of LEVELS) {
      expect(controlLabel(CANDY, dress, level)).toMatchObject({
        fontFamily: extraBold,
        fontSize: 13,
        letterSpacing: 0,
      });
    }
    expect(controlLabel(CANDY, dress, 5).textTransform).toBeUndefined();
    expect(labelStyle(CANDY, dress)).toMatchObject({
      fontFamily: faceFor(FONT_FAMILIES.nunito, 700),
      fontSize: 14,
    });
    expect(fieldLabelStyle(CANDY, dress)).toEqual(labelStyle(CANDY, dress));
    expect(panelHeaderStyle(CANDY, dress)).toBe(CANDY.type.title('title3'));
    expect(panelHeaderStyle(CANDY, dress)).toMatchObject({
      fontFamily: faceFor(FONT_FAMILIES.outfit, 600),
      fontSize: 20,
    });
  });

  it('gives Candy its own titles, eyebrows and labels', () => {
    for (const style of CANDY_STYLES) {
      for (const role of TITLE_ROLES)
        expect(dressedTextFace(style, role)).toBe(style.type.title(role));
      expect(dressedTextFace(style, 'eyebrow')).toBe(style.type.eyebrow);
      expect(dressedTextFace(style, 'label')).toBe(style.type.label);
    }
  });

  it('raises buttons to 44 in and out of a panel, and an edge screen’s action to 50', () => {
    for (const { height } of Object.values(BUTTON_SIZES)) {
      for (const inPanel of [false, true]) {
        expect(buttonHeight(dressOf(CANDY), height, inPanel)).toBe(Math.max(height, 44));
      }
    }
    expect(edgeActionHeight(dressOf(CANDY), 48)).toBe(50);
    expect(edgeActionHeight(dressOf(CANDY), 56)).toBe(56);
    for (const style of [...STUDIO_STYLES, PLAY, HUD, ARCADE]) {
      expect(edgeActionHeight(dressOf(style), 48)).toBe(48);
    }
  });

  it('dresses every panel in its tinted shadow, pressed in the chip, selected in the accent', () => {
    for (const style of CANDY_STYLES) {
      const dress = dressOf(style);
      const { panel } = dress.paints;
      expect(panel.frame).not.toBeNull();
      expect(dressedPanelPaint(dress).glow).toBe(panel.frame);
      expect(dressedPanelPaint(dress, { pressed: true })).toMatchObject({
        background: style.candy?.chip,
        glow: panel.frame,
      });
      expect(dressedPanelPaint(dress, { selected: true })).toMatchObject({
        border: style.candy?.accent,
        borderWidth: 1.5,
        glow: panel.selectedGlow,
      });
    }
  });

  it('presses solid buttons to 0.9 and dims disabled ones; chips and segments chosen in the accent', () => {
    const dress = dressOf(CANDY);
    const accent = CANDY.candy?.accent;
    expect(dressedButtonPaint(dress, 'primary', { pressed: true }).opacity).toBe(0.9);
    expect(dressedButtonPaint(dress, 'primary', { disabled: true }).opacity).toBe(DISABLED_OPACITY);
    expect(dressedButtonPaint(dress, 'ghost', { pressed: true })).toMatchObject({
      backgroundColor: CANDY.candy?.chip,
      opacity: 1,
    });
    expect(dressedPillPaint(dress, true)).toMatchObject({
      backgroundColor: accent,
      borderWidth: 1.5,
    });
    expect(dressedSegmentPaint(dress, true).background).toBe(accent);
  });
});

describe('rows and rules', () => {
  it('gives the foundation 44 pt rows and 1 pt rules in --border, Candy 52 and 1.5', () => {
    for (const style of ALL_STYLES) {
      const row = dressedRow(dressOf(style), style.tokens.colours);
      const candy = style.layout === 'candy';
      expect(row).toEqual({
        minHeight: candy ? 52 : 44,
        separatorWidth: candy ? 1.5 : 1,
        separatorColour: style.tokens.colours.border,
      });
    }
  });
});

describe('the Slider’s colours', () => {
  const source = readFileSync(path.resolve(__dirname, '../Slider.tsx'), 'utf8');

  it('paints every style but Candy as before: primary on muted, the page past the cap', () => {
    for (const style of ALL_STYLES.filter((each) => each.layout !== 'candy')) {
      const { colours } = style.tokens;
      expect(dressedSliderPaint(dressOf(style), colours)).toEqual({
        fill: colours.primary,
        track: colours.muted,
        past: colours.background,
      });
    }
  });

  it("paints Candy's round thumb and fill in the accent on the chip", () => {
    for (const style of CANDY_STYLES) {
      expect(dressedSliderPaint(dressOf(style), style.tokens.colours)).toEqual({
        fill: style.candy?.accent,
        track: style.candy?.chip,
        past: style.candy?.page,
      });
    }
  });

  it('takes its colours from the dress: the fill and the thumb, the track and the part past the cap', () => {
    expect(source).toContain('const paint = dressedSliderPaint(useDress(), colours);');
    expect(source).toContain('{ backgroundColor: paint.track }');
    expect(source).toContain('backgroundColor: paint.past');
    expect(source).toContain('{ backgroundColor: paint.fill }, fill]');
    expect(source).toContain('{ borderRadius: shape.thumbRadius, backgroundColor: paint.fill }');
    expect(source).not.toMatch(/colours\.(primary|muted|background)/);
  });
});
