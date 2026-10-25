// The dress per style (US-016f, D-ONE-SET): Studio and an installed theme wear exactly what the
// foundation draws (its paints, radii and button sizes); Play wears Ember (cards 14, buttons 10 and
// 44 in Geist 600 14, chips round and 40, labels Geist 500 11 capitals .14em, its accent, cream and
// line); HUD wears its README (square everywhere, brackets, glyph statuses, Geist Mono 12 capitals
// buttons at least 44 and 46 in a panel, labels Geist Mono 500 11 .1em, the accent line). No dress
// size is below 11 pt; the brackets are four L-shapes, one at each corner.

import { describe, expect, it } from 'vitest';

import { AA_TEXT, contrastRatio } from '../../../core/web/lib/look-kit/contrast';
import { rgba } from '../../../core/web/lib/look-kit/css';
import {
  BUTTON_PAINTS,
  BUTTON_SIZES,
  PILL_HEIGHT,
  buttonPaint,
  cardPaint,
  pillPaint,
  segmentPaint,
  type ButtonVariant,
} from '../../../ui/variants';
import { GRABBER } from '../../../ui/overlay';
import type { ResolvedStyle } from '../../provider/resolve';
import { AI_LABEL_TONE } from '../../ai-label-state';
import { PLAY_CHIP_LINE_ALPHA, PLAY_OUTLINE_ALPHA } from '../../tokens/dress-colours';
import { HUD_BRACKET } from '../../tokens/hud';
import { STYLE_RADII } from '../../tokens/radii';
import { MIN_TEXT_SIZE, TYPE_SPECS } from '../../type';
import {
  DRESS_MIN_HEIGHT,
  HUD_PANEL_BUTTON_HEIGHT,
  PLAY_PILL_HEIGHT,
  bracketBars,
  dressOf,
  type Dress,
} from '../dress';
import { HUD_SELECTED_BORDER } from '../paints';
import {
  ALL_STYLES,
  HUD,
  HUD_STYLES,
  PLAY,
  PLAY_STYLES,
  STUDIO_LIGHT,
  STUDIO_STYLES,
} from './fixtures';

const VARIANTS = Object.keys(BUTTON_PAINTS) as ButtonVariant[];

const vars = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('fixture without its variables');
  return value;
};

function paintAsControl(dress: Dress, variant: ButtonVariant, pressed: boolean) {
  const set = dress.paints.button[variant];
  const chosen = pressed ? set.pressed : set.rest;
  return {
    backgroundColor: chosen.background,
    borderColor: chosen.border,
    color: chosen.foreground,
  };
}

describe('dressOf: the kinds per style', () => {
  it('gives Studio and a theme cards, pips and a plain ground', () => {
    for (const style of STUDIO_STYLES) {
      const dress = dressOf(style);
      expect(dress).toMatchObject({ layout: 'studio', panel: 'card', status: 'pip' });
      expect(dress.ground).toBe('plain');
      expect(dress.panelHeader).toBe('eyebrow');
    }
  });

  it('gives Play cards, pips and its glow, and HUD brackets, glyphs and its grid', () => {
    for (const style of PLAY_STYLES) {
      expect(dressOf(style)).toMatchObject({ panel: 'card', status: 'pip', ground: 'play-glow' });
    }
    for (const style of HUD_STYLES) {
      expect(dressOf(style)).toMatchObject({
        panel: 'bracket',
        status: 'glyph',
        ground: 'hud-grid',
      });
    }
  });

  it('freezes the dress', () => {
    expect(Object.isFrozen(dressOf(PLAY))).toBe(true);
  });

  it('refuses a Play or HUD style without its variables', () => {
    const { play: _play, ...bare } = PLAY;
    expect(() => dressOf(bare as ResolvedStyle)).toThrow(/play/);
    const { hud: _hud, ...bareHud } = HUD;
    expect(() => dressOf(bareHud as ResolvedStyle)).toThrow(/hud/);
  });
});

describe('Studio: exactly what the foundation draws', () => {
  it("paints every button variant and state with variants.ts's buttonPaint", () => {
    for (const style of STUDIO_STYLES) {
      const dress = dressOf(style);
      const { colours } = style.tokens;
      for (const variant of VARIANTS) {
        const rest = buttonPaint(colours, variant);
        expect(paintAsControl(dress, variant, false)).toEqual({
          backgroundColor: rest.backgroundColor,
          borderColor: rest.borderColor,
          color: rest.color,
        });
        const pressed = buttonPaint(colours, variant, { pressed: true });
        expect(paintAsControl(dress, variant, true)).toEqual({
          backgroundColor: pressed.backgroundColor,
          borderColor: pressed.borderColor,
          color: pressed.color,
        });
        expect(dress.paints.button[variant].pressedOpacity).toBe(pressed.opacity);
      }
    }
  });

  it('paints pills, segments and cards with the foundation’s functions', () => {
    for (const style of STUDIO_STYLES) {
      const { paints } = dressOf(style);
      const { colours } = style.tokens;
      expect(paints.pill.selected.background).toBe(pillPaint(colours, true).backgroundColor);
      expect(paints.pill.selected.foreground).toBe(pillPaint(colours, true).color);
      expect(paints.pill.rest.border).toBe(pillPaint(colours, false).borderColor);
      expect(paints.pill.pressed.background).toBe(
        pillPaint(colours, false, { pressed: true }).backgroundColor,
      );
      expect(paints.segment.track).toBe(colours.muted);
      expect(paints.segment.selected.background).toBe(segmentPaint(colours, true).backgroundColor);
      expect(paints.segment.rest.foreground).toBe(segmentPaint(colours, false).color);
      expect(paints.segment.selectedShadow).toBe(true);
      expect(paints.panel.rest.background).toBe(cardPaint(colours, false).backgroundColor);
      expect(paints.panel.pressed.border).toBe(cardPaint(colours, true).borderColor);
      expect(paints.panel.selected).toEqual(paints.panel.rest);
      expect(paints.panel).toMatchObject({ bracket: null, selectedGlow: null, borderWidth: 1 });
    }
  });

  it("keeps Studio's radii, button sizes and pills", () => {
    const dress = dressOf(STUDIO_LIGHT);
    expect(dress.radii).toEqual(STYLE_RADII.studio);
    expect(dress.button.radius).toBe(STYLE_RADII.studio.control);
    expect(dress.sheetRadius).toBe(14);
    expect(dress.grabberRadius).toBe(GRABBER.radius);
    for (const metrics of Object.values(BUTTON_SIZES)) {
      expect(Math.max(metrics.height, dress.button.minHeight)).toBe(metrics.height);
      expect(Math.max(metrics.height, dress.button.panelMinHeight)).toBe(metrics.height);
    }
    expect(dress.button.labelSize).toBeNull();
    expect(dress.pill).toMatchObject({ radius: STYLE_RADII.studio.pill, minHeight: PILL_HEIGHT });
    expect(dress.pill.paddingX).toBe('space4');
  });

  it("describes Studio's label as the scale's label role", () => {
    const { label } = dressOf(STUDIO_LIGHT);
    const spec = TYPE_SPECS.label;
    expect(label.size).toBe(spec.size);
    expect(label.trackingEm).toBe(spec.tracking);
    expect(label.face).toEqual({ role: 'mono', weight: spec.weight });
    expect(label.case).toBe('capitals');
  });
});

describe('Play: Ember', () => {
  it('rounds cards 14, buttons 10, chips fully, the sheet 14', () => {
    for (const style of PLAY_STYLES) {
      const dress = dressOf(style);
      expect(dress.radii.card).toBe(14);
      expect(dress.radii.panel).toBe(14);
      expect(dress.button.radius).toBe(10);
      expect(dress.pill.radius).toBeGreaterThanOrEqual(999);
      expect(dress.sheetRadius).toBe(14);
    }
  });

  it('makes buttons 44 high in Geist 600 14, chips 40 high, labels Geist 500 11 capitals .14em', () => {
    const dress = dressOf(PLAY);
    expect(dress.button).toMatchObject({
      minHeight: DRESS_MIN_HEIGHT,
      panelMinHeight: DRESS_MIN_HEIGHT,
      labelFace: { role: 'sans', weight: 600 },
      labelSize: 14,
      labelCase: 'as-written',
    });
    expect(dress.pill).toMatchObject({ minHeight: PLAY_PILL_HEIGHT, restWeight: 500 });
    expect(dress.pill.selectedWeight).toBe(600);
    expect(dress.label).toEqual({
      face: { role: 'sans', weight: 500 },
      size: 11,
      case: 'capitals',
      trackingEm: 0.14,
    });
  });

  it('paints primary the accent, secondary cream on the ground, outline the text at 24 %', () => {
    for (const style of PLAY_STYLES) {
      const v = vars(style.play);
      const { button, pill, panel } = dressOf(style).paints;
      expect(button.primary.rest).toEqual({
        background: v.accent,
        border: v.accent,
        foreground: v.accentInk,
      });
      expect(button.secondary.rest).toMatchObject({
        background: v.groundText,
        foreground: v.groundBg,
      });
      expect(button.outline.rest).toEqual({
        background: 'transparent',
        border: rgba(v.groundText, PLAY_OUTLINE_ALPHA),
        foreground: v.groundText,
      });
      expect(pill.selected).toMatchObject({ background: v.groundText, foreground: v.groundBg });
      expect(pill.rest.border).toBe(rgba(v.groundText, PLAY_CHIP_LINE_ALPHA));
      expect(panel.rest).toEqual({ background: v.groundSurface, border: v.groundLine });
      expect(panel.bracket).toBeNull();
    }
  });
});

describe('HUD: its README', () => {
  it('has radius 0 everywhere', () => {
    for (const style of HUD_STYLES) {
      const dress = dressOf(style);
      for (const [name, radius] of Object.entries(dress.radii)) expect(radius, name).toBe(0);
      expect(dress.button.radius).toBe(0);
      expect(dress.pill.radius).toBe(0);
      expect(dress.sheetRadius).toBe(0);
      expect(dress.grabberRadius).toBe(0);
    }
  });

  it('makes buttons at least 44 (46 in a panel) in Geist Mono 12 capitals at .14em', () => {
    const dress = dressOf(HUD);
    expect(dress.button).toMatchObject({
      minHeight: DRESS_MIN_HEIGHT,
      panelMinHeight: HUD_PANEL_BUTTON_HEIGHT,
      labelFace: { role: 'mono', weight: 500 },
      labelSize: 12,
      labelCase: 'capitals',
      trackingEm: 0.14,
    });
    expect(HUD_PANEL_BUTTON_HEIGHT).toBe(46);
    expect(dress.label).toEqual({
      face: { role: 'mono', weight: 500 },
      size: 11,
      case: 'capitals',
      trackingEm: 0.1,
    });
    expect(dress.panelHeader).toBe('display');
  });

  it('paints panels with the panel fill, border and brackets; selected the accent with a glow', () => {
    for (const style of HUD_STYLES) {
      const v = vars(style.hud);
      const { panel, button, pill } = dressOf(style).paints;
      expect(panel.rest).toEqual({ background: v.panelFill, border: v.panelBorder });
      expect(panel.bracket).toBe(v.bracket);
      expect(panel.selected.border).toBe(v.accent);
      expect(panel.selectedBorderWidth).toBe(HUD_SELECTED_BORDER);
      expect(panel.selectedGlow?.[0]?.color).toBe(rgba(v.accent, 0.5));
      expect(button.primary.rest).toEqual({
        background: v.accent,
        border: v.accent,
        foreground: v.accentInk,
      });
      expect(button.secondary.rest).toMatchObject({
        background: 'transparent',
        border: v.accentLine,
      });
      expect(button.outline).toEqual(button.secondary);
      expect(pill.selected).toMatchObject({ background: v.accentFill, border: v.accent });
      expect(pill.selectedBorderWidth).toBe(1.5);
    }
  });
});

describe('the 11 pt floor (D38)', () => {
  it('sizes no dress label below 11', () => {
    for (const style of ALL_STYLES) {
      const dress = dressOf(style);
      expect(dress.label.size).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
      expect(dress.button.labelSize ?? MIN_TEXT_SIZE).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
    }
  });

  it('keeps every Studio-sized button label at or over 11', () => {
    for (const metrics of Object.values(BUTTON_SIZES)) {
      const role = `body${metrics.level}` as keyof typeof TYPE_SPECS;
      expect(TYPE_SPECS[role].size).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
    }
  });
});

describe('the brackets (KS12)', () => {
  const bars = bracketBars(HUD_BRACKET.length, HUD_BRACKET.thickness);

  it('draws 14 x 1.5 L-shapes, one at each of the four corners', () => {
    expect(HUD_BRACKET).toEqual({ length: 14, thickness: 1.5 });
    expect(bars).toHaveLength(8);
    const corners = new Set(
      bars.map((bar) => `${'top' in bar ? 'top' : 'bottom'}-${'left' in bar ? 'left' : 'right'}`),
    );
    expect([...corners].sort()).toEqual(['bottom-left', 'bottom-right', 'top-left', 'top-right']);
    for (const corner of corners) {
      const pair = bars.filter(
        (bar) =>
          `${'top' in bar ? 'top' : 'bottom'}-${'left' in bar ? 'left' : 'right'}` === corner,
      );
      expect(pair.map((bar) => [bar.width, bar.height])).toEqual([
        [14, 1.5],
        [1.5, 14],
      ]);
    }
  });
});

describe('the AI label under every dress (FR-8, D73)', () => {
  it('reads its muted token at AA on the background in every style and look', () => {
    for (const style of ALL_STYLES) {
      const { colours } = style.tokens;
      expect(AI_LABEL_TONE).toBe('mutedForeground');
      expect(contrastRatio(colours[AI_LABEL_TONE], colours.background)).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    }
  });
});
