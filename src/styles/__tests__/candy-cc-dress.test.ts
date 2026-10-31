// The Command Centre, its sheets and settings in Candy (US-023k, D-ONE-SET, CANDY-LAYOUT §7): the
// same screens, dressed. The head's title Candy's section title (Outfit 600 20); the live word as
// glyph + word; the tabs in Nunito 800, the chosen one in the accent over its bar (TabStrip draws
// no fill, so the kit's accent pill is a foundation gap); the shell's grounds the page; the chosen
// day the accent with its ink; every status a card carries a glyph and a word read at AA on the
// window and the page; the primitives round pills, 44 high at least, the cards Candy's windows on
// its tinted shadow; Settings' rows 52 over 1.5 pt rules; the slider the accent on the chip.

import { describe, expect, it } from 'vitest';

import { BOARD_STATUSES } from '../../cc/board/board';
import { ticketCard } from '../../cc/board/view-model';
import { TAB_STRIP, TOP_BAR } from '../../cc/shell/chrome';
import { SHELL_COPY } from '../../cc/strings';
import { AA_TEXT, contrastRatio } from '../../core/web/lib/look-kit/contrast';
import {
  buttonHeight,
  controlLabel,
  dressedPanelPaint,
  dressedRow,
  dressedSliderPaint,
  labelStyle,
  panelHeaderStyle,
} from '../../ui/dressed';
import { BUTTON_SIZES } from '../../ui/variants';
import { FONT_FAMILIES } from '../fonts';
import {
  dressedStripCell,
  markToken,
  roundCorner,
  shellGround,
  shellTabPaint,
  shellTitle,
} from '../dress/cc-dress';
import { CANDY_LINE } from '../dress/candy-paints';
import { CANDY_ROW_HEIGHT, DRESS_MIN_HEIGHT, dressOf } from '../dress/dress';
import { GLYPHS, GLYPH_ROLE_TOKENS, isGlyphStatus, statusGlyph } from '../dress/status-glyphs';
import { CANDY, CANDY_STYLES } from '../dress/__tests__/fixtures';
import type { ResolvedStyle } from '../provider/resolve';
import { STUDIO_RADII } from '../tokens/studio';
import { faceFor } from '../typeface/faces';
import {
  BARE_DAY,
  BOARD_SERVER_STATUSES,
  CHOSEN_DAY,
  TODAY_WITH_ITEMS,
  shell,
  ticket,
} from './cc-fixtures';

const OUTFIT = faceFor(FONT_FAMILIES.outfit, 600);
const NUNITO_EXTRA_BOLD = faceFor(FONT_FAMILIES.nunito, 800);
const SECTION_SIZE = 20;

function varsOf(style: ResolvedStyle) {
  if (!style.candy) throw new Error('fixture without its variables');
  return style.candy;
}

describe('the head’s title in Candy', () => {
  it('is Candy’s section title, Outfit 600 20, the screen’s own words', () => {
    CANDY_STYLES.forEach((style) => {
      const title = shellTitle(style, SHELL_COPY.title);
      expect(title.face).toEqual(style.type.title('title3'));
      expect(title.face).toMatchObject({ fontFamily: OUTFIT, fontSize: SECTION_SIZE });
      expect(title.runs).toEqual([{ text: SHELL_COPY.title, accent: false }]);
      expect(title.accessibilityLabel).toBe(SHELL_COPY.title);
    });
  });

  it('heads a panel in the same section title', () => {
    CANDY_STYLES.forEach((style) => {
      const face = panelHeaderStyle(style, dressOf(style));
      expect(face).toEqual(style.type.title('title3'));
      expect(face).toMatchObject({ fontFamily: OUTFIT, fontSize: SECTION_SIZE });
    });
  });

  it('writes the title in the text at AA on the page', () => {
    CANDY_STYLES.forEach(({ tokens: { colours } }) =>
      expect(contrastRatio(colours.foreground, colours.background)).toBeGreaterThanOrEqual(AA_TEXT),
    );
  });
});

describe('the shell in Candy', () => {
  it('says the live word as glyph + word, still, and the way back in Nunito', () => {
    CANDY_STYLES.forEach((style) => {
      const { live, back } = shell(style);
      const dress = dressOf(style);
      expect(live).toBe('glyph');
      expect(back).toEqual(controlLabel(style, dress, TOP_BAR.backLevel, TOP_BAR.backWeight));
      expect(back.fontFamily).toMatch(/^Nunito-/);
      expect(back.fontSize).toBe(13);
    });
  });

  it('sets the tabs in Nunito 800 at the button step, spaced as Studio’s', () => {
    CANDY_STYLES.forEach((style) => {
      const { tabs } = shell(style);
      const dress = dressOf(style);
      expect(tabs.face).toEqual(controlLabel(style, dress, TAB_STRIP.level));
      expect(tabs.face).toMatchObject({ fontFamily: NUNITO_EXTRA_BOLD, fontSize: 13 });
      const { spacing } = style.tokens;
      expect(tabs).toMatchObject({
        gap: spacing[TAB_STRIP.gap],
        tabPaddingX: 0,
        stripPaddingX: spacing[TAB_STRIP.paddingX],
      });
    });
  });

  it('marks the chosen tab in the accent’s text colour over its bar, the others muted with none', () => {
    CANDY_STYLES.forEach((style) => {
      const { tabs } = shell(style);
      const { colours } = style.tokens;
      expect(markToken('candy')).toBe('primary');
      expect(colours.primary).toBe(varsOf(style).accentText);
      expect(shellTabPaint(colours, tabs, true)).toEqual({
        color: colours.primary,
        rule: colours.primary,
      });
      expect(shellTabPaint(colours, tabs, false)).toEqual({
        color: colours.mutedForeground,
        rule: 'transparent',
      });
      const strip = colours[TAB_STRIP.ground];
      for (const word of [colours.primary, colours.mutedForeground]) {
        expect(contrastRatio(word, strip)).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });
  });

  it('keeps the shell’s grounds their own colour: the page, opaque', () => {
    CANDY_STYLES.forEach((style) => {
      const { background } = style.tokens.colours;
      expect(background).toBe(varsOf(style).page);
      expect(shellGround(dressOf(style), background)).toBe(background);
    });
  });

  it('rounds A2’s composer pill fully', () => {
    CANDY_STYLES.forEach((style) => {
      expect(roundCorner(21, style.tokens.radii)).toBe(21);
    });
  });
});

describe('the day strip in Candy', () => {
  it('chooses the day in the accent with its ink, today in the chip, the dot in the mark', () => {
    CANDY_STYLES.forEach((style) => {
      const v = varsOf(style);
      const dress = dressOf(style);
      const { colours } = style.tokens;
      expect(dressedStripCell(dress, colours, CHOSEN_DAY)).toEqual({
        backgroundColor: v.accent,
        borderColor: v.accent,
        color: v.accentInk,
        dot: v.accentInk,
        borderWidth: CANDY_LINE,
      });
      expect(dressedStripCell(dress, colours, TODAY_WITH_ITEMS)).toMatchObject({
        backgroundColor: v.win,
        borderColor: v.border,
        dot: colours.primary,
      });
      const bare = dressedStripCell(dress, colours, BARE_DAY);
      expect([bare.backgroundColor, bare.borderColor, bare.dot]).toEqual(
        Array(3).fill('transparent'),
      );
    });
  });
});

describe('every status a card carries, in Candy', () => {
  it('has a glyph and a word, the glyph at AA on the window and on the page', () => {
    CANDY_STYLES.forEach((style) => {
      const { colours } = style.tokens;
      BOARD_SERVER_STATUSES.forEach((status) => {
        const { pip, word } = ticketCard(ticket({ status })).status;
        expect(isGlyphStatus(pip)).toBe(true);
        const glyph = statusGlyph(pip);
        expect(Object.values(GLYPHS)).toContain(glyph.glyph);
        expect(word.trim()).not.toBe('');
        const ink = colours[GLYPH_ROLE_TOKENS[glyph.role]];
        for (const ground of [colours.card, colours.background]) {
          expect(contrastRatio(ink, ground)).toBeGreaterThanOrEqual(AA_TEXT);
        }
      });
    });
    expect(BOARD_STATUSES.every((status) => isGlyphStatus(status))).toBe(true);
  });
});

describe('the primitives in Candy', () => {
  it('Card: a window with rs corners on the tinted shadow, the accent ringing a selected one', () => {
    CANDY_STYLES.forEach((style) => {
      const dress = dressOf(style);
      const v = varsOf(style);
      expect(style.tokens.radii.card).toBe(dress.radii.card);
      expect(dressedPanelPaint(dress)).toMatchObject({
        background: v.win,
        border: v.win,
        borderWidth: CANDY_LINE,
      });
      expect(dressedPanelPaint(dress).glow).toBe(dress.paints.panel.frame);
      expect(dressedPanelPaint(dress, { pressed: true })).toMatchObject({ background: v.chip });
      const selected = dressedPanelPaint(dress, { selected: true });
      expect(selected).toMatchObject({ border: v.accent, borderWidth: CANDY_LINE });
      expect(selected.glow).toBe(dress.paints.panel.selectedGlow);
    });
  });

  it('StatusPip: a glyph and a word; a field’s label Nunito 700 14', () => {
    CANDY_STYLES.forEach((style) => {
      const dress = dressOf(style);
      expect(dress.status).toBe('glyph');
      expect(labelStyle(style, dress)).toMatchObject({
        fontFamily: faceFor(FONT_FAMILIES.nunito, 700),
        fontSize: 14,
      });
    });
  });

  it('Button, Pill, Chip and SegmentedControl: round pills, 44 high at least in and out of a panel', () => {
    CANDY_STYLES.forEach((style) => {
      const dress = dressOf(style);
      const round = STUDIO_RADII.full;
      expect([
        dress.button.radius,
        dress.pill.radius,
        dress.radii.chip,
        dress.radii.segment,
      ]).toEqual(Array(4).fill(round));
      expect(dress.pill.minHeight).toBeGreaterThanOrEqual(DRESS_MIN_HEIGHT);
      for (const inPanel of [false, true]) {
        expect(buttonHeight(dress, BUTTON_SIZES.sm.height, inPanel)).toBe(DRESS_MIN_HEIGHT);
      }
    });
    expect(controlLabel(CANDY, dressOf(CANDY), BUTTON_SIZES.md.level)).toMatchObject({
      fontFamily: NUNITO_EXTRA_BOLD,
      fontSize: 13,
    });
  });

  it('Sheet and TextField: rs corners and a round grabber', () => {
    CANDY_STYLES.forEach((style) => {
      const dress = dressOf(style);
      expect(dress.sheetRadius).toBe(dress.radii.card);
      expect(dress.radii.input).toBe(dress.radii.card);
      expect(dress.grabberRadius).toBeGreaterThan(0);
    });
  });
});

describe('Settings and the slider in Candy', () => {
  it('rows 52 tall over 1.5 pt rules in the window’s line (the opaque hairline)', () => {
    CANDY_STYLES.forEach((style) => {
      const row = dressedRow(dressOf(style), style.tokens.colours);
      expect(row).toEqual({
        minHeight: CANDY_ROW_HEIGHT,
        separatorWidth: CANDY_LINE,
        separatorColour: varsOf(style).border,
      });
    });
  });

  it('draws the slider’s thumb and fill in the accent on the chip', () => {
    CANDY_STYLES.forEach((style) => {
      const v = varsOf(style);
      expect(dressedSliderPaint(dressOf(style), style.tokens.colours)).toEqual({
        fill: v.accent,
        track: v.chip,
        past: v.page,
      });
    });
  });
});
