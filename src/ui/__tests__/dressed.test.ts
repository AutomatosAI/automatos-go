// The primitives under a dress (US-016f): on the Studio layout (Studio Light, Dark and an
// installed theme) every face and paint is exactly what variants.ts gave the foundation's
// primitives; Play's and HUD's titles, eyebrows and labels come from their own type (Play's display
// face only at 19 and above), their controls from the dress (Play Geist 600 14, HUD Geist Mono 12
// capitals), their heights (44, HUD's 46 in a panel) and paints from the dress; nothing is drawn
// below 11 pt in any style.

import { describe, expect, it } from 'vitest';

import { FONT_FAMILIES } from '../../styles/fonts';
import { dressOf } from '../../styles/dress/dress';
import {
  ALL_STYLES,
  HUD,
  HUD_STYLES,
  PLAY,
  PLAY_STYLES,
  STUDIO_STYLES,
} from '../../styles/dress/__tests__/fixtures';
import { MIN_TEXT_SIZE, TYPE_SPECS, type TypeRole } from '../../styles/type';
import { faceFor } from '../../styles/typeface/faces';
import { TITLE_ROLES } from '../../styles/typeface/scale';
import { DISABLED_OPACITY } from '../paint';
import {
  buttonHeight,
  controlLabel,
  dressedButtonPaint,
  dressedPanelPaint,
  dressedPillPaint,
  dressedSegmentPaint,
  dressedTextFace,
  fieldLabelStyle,
  labelStyle,
  panelHeaderStyle,
} from '../dressed';
import {
  BUTTON_PAINTS,
  BUTTON_SIZES,
  buttonPaint,
  cardPaint,
  pillPaint,
  segmentPaint,
  textFace,
  textRole,
  type ButtonVariant,
  type TextLevel,
} from '../variants';

const ROLES = Object.keys(TYPE_SPECS) as TypeRole[];
const LEVELS: readonly TextLevel[] = [1, 2, 3, 4, 5, 6];
const VARIANTS = Object.keys(BUTTON_PAINTS) as ButtonVariant[];
const STATES = [{}, { pressed: true }, { disabled: true }, { pressed: true, disabled: true }];
const OVERRIDES = [{}, { weight: 500 as const }, { weight: 600 as const }, { italic: true }];

describe('Text under a dress', () => {
  it('draws every role on the Studio layout exactly as textFace does', () => {
    for (const style of STUDIO_STYLES) {
      for (const role of ROLES) {
        for (const overrides of OVERRIDES) {
          expect(dressedTextFace(style, role, overrides)).toEqual(
            textFace(style.tokens.type, role, overrides),
          );
        }
      }
    }
  });

  it("gives Play's and HUD's titles, eyebrows and labels their own type", () => {
    for (const style of [...PLAY_STYLES, ...HUD_STYLES]) {
      for (const role of TITLE_ROLES)
        expect(dressedTextFace(style, role)).toBe(style.type.title(role));
      expect(dressedTextFace(style, 'eyebrow')).toBe(style.type.eyebrow);
      expect(dressedTextFace(style, 'label')).toBe(style.type.label);
      expect(dressedTextFace(style, 'body1')).toEqual(textFace(style.tokens.type, 'body1'));
      expect(dressedTextFace(style, 'figure1')).toEqual(textFace(style.tokens.type, 'figure1'));
    }
  });

  it("uses Play's display face for a title only at 19 and above", () => {
    const editorial = faceFor(FONT_FAMILIES.instrumentSerif, 400, 'italic');
    expect(PLAY.playLook?.font).toBe('serif');
    expect(dressedTextFace(PLAY, 'title1').fontFamily).toBe(editorial);
    expect(dressedTextFace(PLAY, 'threadTitle1').fontFamily).toBe(editorial);
    for (const role of ['title4', 'title5', 'title6', 'threadTitle2'] as const) {
      expect(dressedTextFace(PLAY, role).fontFamily, role).not.toBe(editorial);
    }
  });

  it('never draws text below 11 pt in any style', () => {
    for (const style of ALL_STYLES) {
      for (const role of ROLES) {
        expect(dressedTextFace(style, role).fontSize, role).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
      }
    }
  });
});

describe('labels and control labels', () => {
  it("draws Studio's controls at their own Body level and weight, as the foundation did", () => {
    for (const style of STUDIO_STYLES) {
      const dress = dressOf(style);
      for (const level of LEVELS) {
        expect(controlLabel(style, dress, level)).toEqual(
          textFace(style.tokens.type, textRole('body', level), { weight: 500 }),
        );
      }
      expect(labelStyle(style, dress)).toBe(style.tokens.type.label);
      expect(fieldLabelStyle(style, dress)).toEqual(
        textFace(style.tokens.type, 'body3', { weight: 500 }),
      );
      expect(panelHeaderStyle(style, dress)).toBe(style.tokens.type.eyebrow);
    }
  });

  it("matches Play's and HUD's own button and label type from the dress", () => {
    for (const style of [...PLAY_STYLES, ...HUD_STYLES]) {
      const dress = dressOf(style);
      for (const level of LEVELS)
        expect(controlLabel(style, dress, level)).toEqual(style.type.button);
      expect(labelStyle(style, dress)).toEqual(style.type.label);
      expect(fieldLabelStyle(style, dress)).toEqual(style.type.label);
    }
  });

  it('writes HUD controls in Geist Mono 12 capitals at .14em, its labels 11 at .1em', () => {
    const dress = dressOf(HUD);
    const button = controlLabel(HUD, dress, 1);
    expect(button).toMatchObject({ fontSize: 12, letterSpacing: 1.68, textTransform: 'uppercase' });
    expect(button.fontFamily).toBe(faceFor(FONT_FAMILIES.geistMono, 500));
    expect(labelStyle(HUD, dress)).toMatchObject({ fontSize: 11, letterSpacing: 1.1 });
    expect(panelHeaderStyle(HUD, dress)).toBe(HUD.type.display('panel'));
    expect(panelHeaderStyle(HUD, dress).textTransform).toBe('uppercase');
  });

  it("writes Play's chips Geist 500, and 600 when chosen; its panel heads its label", () => {
    const dress = dressOf(PLAY);
    expect(controlLabel(PLAY, dress, 5, 500).fontFamily).toBe(faceFor(FONT_FAMILIES.geist, 500));
    expect(controlLabel(PLAY, dress, 5, 600).fontFamily).toBe(faceFor(FONT_FAMILIES.geist, 600));
    expect(controlLabel(PLAY, dress, 5).fontSize).toBe(14);
    expect(panelHeaderStyle(PLAY, dress)).toEqual(PLAY.type.label);
  });

  it('sizes every label at or over 11 pt in every style', () => {
    for (const style of ALL_STYLES) {
      const dress = dressOf(style);
      const sizes = [
        ...LEVELS.map((level) => controlLabel(style, dress, level).fontSize),
        labelStyle(style, dress).fontSize,
        fieldLabelStyle(style, dress).fontSize,
        panelHeaderStyle(style, dress).fontSize,
      ];
      for (const size of sizes) expect(size).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
    }
  });
});

describe('heights', () => {
  it("keeps Studio's button sizes in and out of a panel", () => {
    for (const style of STUDIO_STYLES) {
      const dress = dressOf(style);
      for (const { height } of Object.values(BUTTON_SIZES)) {
        expect(buttonHeight(dress, height, false)).toBe(height);
        expect(buttonHeight(dress, height, true)).toBe(height);
      }
    }
  });

  it('raises Play to 44, HUD to 44 and to 46 inside a panel', () => {
    for (const { height } of Object.values(BUTTON_SIZES)) {
      expect(buttonHeight(dressOf(PLAY), height, false)).toBe(44);
      expect(buttonHeight(dressOf(PLAY), height, true)).toBe(44);
      expect(buttonHeight(dressOf(HUD), height, false)).toBe(44);
      expect(buttonHeight(dressOf(HUD), height, true)).toBe(46);
    }
  });
});

describe('paints', () => {
  it("paints Studio's buttons, pills and segments exactly as variants.ts", () => {
    for (const style of STUDIO_STYLES) {
      const dress = dressOf(style);
      const { colours } = style.tokens;
      for (const state of STATES) {
        for (const variant of VARIANTS) {
          expect(dressedButtonPaint(dress, variant, state)).toEqual(
            buttonPaint(colours, variant, state),
          );
        }
        for (const selected of [false, true]) {
          expect(dressedPillPaint(dress, selected, state)).toEqual({
            ...pillPaint(colours, selected, state),
            borderWidth: 1,
          });
        }
      }
      for (const selected of [false, true]) {
        const { backgroundColor, color } = segmentPaint(colours, selected);
        expect(dressedSegmentPaint(dress, selected)).toEqual({
          background: backgroundColor,
          foreground: color,
        });
      }
    }
  });

  it("paints Studio's cards as cardPaint, a selected one as any card", () => {
    for (const style of STUDIO_STYLES) {
      const dress = dressOf(style);
      for (const pressed of [false, true]) {
        const card = cardPaint(style.tokens.colours, pressed);
        expect(dressedPanelPaint(dress, { pressed })).toEqual({
          background: card.backgroundColor,
          border: card.borderColor,
          borderWidth: 1,
          glow: null,
        });
      }
      expect(dressedPanelPaint(dress, { selected: true })).toMatchObject({ glow: null });
    }
  });

  it("dims Play's and HUD's disabled controls and presses solid buttons to 0.9", () => {
    for (const style of [PLAY, HUD]) {
      const dress = dressOf(style);
      expect(dressedButtonPaint(dress, 'primary', { disabled: true }).opacity).toBe(
        DISABLED_OPACITY,
      );
      expect(dressedButtonPaint(dress, 'primary', { pressed: true }).opacity).toBe(0.9);
      expect(dressedButtonPaint(dress, 'outline', { pressed: true }).opacity).toBe(1);
      expect(dressedPillPaint(dress, true, { disabled: true }).opacity).toBe(DISABLED_OPACITY);
    }
  });

  it("draws HUD's selected panel and chosen chip with the 1.5 pt accent line, the panel glowing", () => {
    for (const style of HUD_STYLES) {
      const dress = dressOf(style);
      const accent = style.hud?.accent;
      const selected = dressedPanelPaint(dress, { selected: true, pressed: true });
      expect(selected).toMatchObject({ border: accent, borderWidth: 1.5 });
      expect(selected.glow).not.toBeNull();
      expect(dressedPanelPaint(dress)).toMatchObject({ borderWidth: 1, glow: null });
      expect(dressedPillPaint(dress, true)).toMatchObject({
        borderColor: accent,
        borderWidth: 1.5,
      });
      expect(dressedPillPaint(dress, false).borderWidth).toBe(1);
    }
  });
});
