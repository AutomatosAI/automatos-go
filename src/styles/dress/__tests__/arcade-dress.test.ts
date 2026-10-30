// Arcade's dress (US-022h, D-ONE-SET): every panel a square window in the look's window style on
// the window colour, a selected one in the accent's lines; glyph plus WORD statuses; buttons and
// chips square, 44 high at least, in Press Start 2P capitals at the button step, labels at the
// label step; primary the accent with its ink, secondary the page inside the window's line, a chip
// the window inside its 2 pt ring, a chosen or pressed thing the highlight with its ink; the page
// as the ground. Every word the paints put on a ground reads at AA in every palette.

import { describe, expect, it } from 'vitest';

import { AA_TEXT, contrastRatio } from '../../../core/web/lib/look-kit/contrast';
import { BUTTON_PAINTS, type ButtonVariant } from '../../../ui/variants';
import { windowRings } from '../../arcade/parts/window-frame';
import type { ResolvedStyle } from '../../provider/resolve';
import { arcadeWindowFrame, type ArcadeVars } from '../../tokens/arcade';
import { ARCADE_STEPS } from '../../typeface/arcade-type';
import { arcadePanelFrame } from '../arcade-frame';
import { DRESS_MIN_HEIGHT, dressOf } from '../dress';
import { ARCADE_CHIP_RING, type Paint } from '../paints';
import { ARCADE, ARCADE_STYLES } from './fixtures';

const VARIANTS = Object.keys(BUTTON_PAINTS) as ButtonVariant[];

function varsOf(style: ResolvedStyle): ArcadeVars {
  if (!style.arcade) throw new Error('fixture without its variables');
  return style.arcade;
}

function frameOf(style: ResolvedStyle, line: string) {
  const vars = varsOf(style);
  if (!style.arcadeLook) throw new Error('fixture without its look');
  return arcadePanelFrame(windowRings(arcadeWindowFrame(style.arcadeLook)), {
    line,
    gap: vars.win,
    bevelLight: vars.bevl,
    bevelDark: vars.bevd,
    shadow: vars.sh,
  });
}

describe('dressOf under Arcade: the kinds', () => {
  it('gives every look windows, glyph statuses, the display face over a panel and the page', () => {
    for (const style of ARCADE_STYLES) {
      expect(dressOf(style)).toMatchObject({
        layout: 'arcade',
        panel: 'window',
        panelHeader: 'display',
        status: 'glyph',
        ground: 'arcade-page',
      });
    }
  });

  it('is square everywhere (README: hard edges only)', () => {
    for (const style of ARCADE_STYLES) {
      const dress = dressOf(style);
      for (const [name, radius] of Object.entries(dress.radii)) expect(radius, name).toBe(0);
      const corners = [dress.button.radius, dress.pill.radius, dress.sheetRadius];
      expect([...corners, dress.grabberRadius]).toEqual([0, 0, 0, 0]);
    }
  });

  it('refuses an Arcade style without its variables or its look, and freezes the dress', () => {
    const { arcade: _vars, ...noVars } = ARCADE;
    expect(() => dressOf(noVars as ResolvedStyle)).toThrow(/arcade/);
    const { arcadeLook: _look, ...noLook } = ARCADE;
    expect(() => dressOf(noLook as ResolvedStyle)).toThrow(/arcade/);
    expect(Object.isFrozen(dressOf(ARCADE))).toBe(true);
  });
});

describe('dressOf under Arcade: type and sizes', () => {
  it('sets buttons at least 44 in and out of a panel, in the pixel face at the button step', () => {
    expect(dressOf(ARCADE).button).toEqual({
      radius: 0,
      minHeight: DRESS_MIN_HEIGHT,
      panelMinHeight: DRESS_MIN_HEIGHT,
      labelFace: { role: 'pixel', weight: 400 },
      labelSize: ARCADE_STEPS.button,
      labelCase: 'capitals',
      trackingEm: 0,
    });
  });

  it('sets labels in the pixel face at the label step, capitals at .1em', () => {
    expect(dressOf(ARCADE).label).toEqual({
      face: { role: 'pixel', weight: 400 },
      size: ARCADE_STEPS.label,
      case: 'capitals',
      trackingEm: 0.1,
    });
    expect(ARCADE_STEPS.label).toBe(11);
  });

  it('makes chips the Inventory’s tabs: 44 high, 16 in, one weight', () => {
    expect(dressOf(ARCADE).pill).toEqual({
      radius: 0,
      minHeight: 44,
      paddingX: 'space7',
      restWeight: 400,
      selectedWeight: 400,
    });
  });
});

describe('Arcade’s paints: the palette’s variables', () => {
  it('paints primary the accent with its ink, the others lit by the highlight when pressed', () => {
    for (const style of ARCADE_STYLES) {
      const v = varsOf(style);
      const { button } = dressOf(style).paints;
      const lit: Paint = { background: v.hl, border: v.hl, foreground: v.hlt };
      expect(button.primary.rest).toEqual({ background: v.ac, border: v.ac, foreground: v.aci });
      expect(button.secondary.rest).toEqual({ background: v.page, border: v.bd, foreground: v.tx });
      expect(button.outline.rest).toEqual({
        background: 'transparent',
        border: v.bd,
        foreground: v.tx,
      });
      expect(button.ghost.rest).toEqual({
        background: 'transparent',
        border: 'transparent',
        foreground: v.tx2,
      });
      for (const variant of ['secondary', 'outline', 'ghost'] as const) {
        expect(button[variant]).toMatchObject({ pressed: lit, pressedOpacity: 1 });
      }
    }
  });

  it('paints chips the window in a 2 pt ring, the chosen one the highlight with its ink', () => {
    for (const style of ARCADE_STYLES) {
      const v = varsOf(style);
      const { pill, segment } = dressOf(style).paints;
      expect(pill).toEqual({
        rest: { background: v.win, border: v.bd, foreground: v.tx },
        pressed: { background: v.page, border: v.bd, foreground: v.tx },
        selected: { background: v.hl, border: v.hl, foreground: v.hlt },
        borderWidth: ARCADE_CHIP_RING,
        selectedBorderWidth: ARCADE_CHIP_RING,
      });
      expect(segment).toEqual({
        track: v.win,
        rest: { background: 'transparent', foreground: v.tx2 },
        selected: { background: v.hl, foreground: v.hlt },
        selectedShadow: false,
      });
    }
  });

  it('paints every panel the look’s window, a selected one in the accent’s lines', () => {
    for (const style of ARCADE_STYLES) {
      const v = varsOf(style);
      const { panel } = dressOf(style).paints;
      const rest = frameOf(style, v.bd);
      expect(panel.rest).toEqual({ background: v.win, border: v.bd });
      expect(panel.pressed).toEqual({ background: v.page, border: v.bd });
      expect(panel.selected).toEqual({ background: v.win, border: v.ac });
      expect(panel.frame).toEqual(rest.layers);
      expect(panel.selectedGlow).toEqual(frameOf(style, v.ac).layers);
      expect([panel.borderWidth, panel.selectedBorderWidth]).toEqual([2, 2]);
      expect(panel.bracket).toBeNull();
    }
  });

  it('draws Classic’s inner line and Thin’s single line from the look’s window style', () => {
    const [classic, thin] = ARCADE_STYLES.slice(-2);
    expect(classic.arcadeLook?.windowStyle).toBe('classic');
    expect(thin.arcadeLook?.windowStyle).toBe('thin');
    expect(dressOf(classic).paints.panel.frame).toHaveLength(5);
    expect(dressOf(thin).paints.panel.frame).toHaveLength(1);
  });
});

describe('Arcade’s words on their grounds at AA, in every palette', () => {
  function low(style: ResolvedStyle): string[] {
    const v = varsOf(style);
    const { button, pill, segment, panel } = dressOf(style).paints;
    const ground = (paint: Paint, under: string) =>
      paint.background === 'transparent' ? under : paint.background;
    const pairs: (readonly [string, string, string])[] = [];
    for (const variant of VARIANTS) {
      for (const under of [v.page, v.win]) {
        const { rest, pressed } = button[variant];
        pairs.push([`${variant} rest`, rest.foreground, ground(rest, under)]);
        pairs.push([`${variant} pressed`, pressed.foreground, ground(pressed, under)]);
      }
    }
    for (const state of ['rest', 'pressed', 'selected'] as const) {
      pairs.push([`pill ${state}`, pill[state].foreground, pill[state].background]);
    }
    pairs.push(['segment rest', segment.rest.foreground, segment.track]);
    pairs.push(['segment selected', segment.selected.foreground, segment.selected.background]);
    for (const state of ['rest', 'pressed', 'selected'] as const) {
      for (const text of [v.tx, v.tx2, v.ac]) {
        pairs.push([`panel ${state}`, text, panel[state].background]);
      }
    }
    return pairs
      .filter(([, fg, bg]) => contrastRatio(fg, bg) < AA_TEXT)
      .map(([name, fg, bg]) => `${style.arcadeLook?.palette} ${name} ${fg} on ${bg}`);
  }

  it('keeps every button, chip, segment and panel word readable', () => {
    expect(ARCADE_STYLES.flatMap(low)).toEqual([]);
  });
});
