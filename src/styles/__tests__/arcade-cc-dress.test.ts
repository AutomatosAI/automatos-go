// The Command Centre, its sheets and settings in Arcade (US-022h, D-ONE-SET): the same screens,
// dressed. The head's title in Press Start 2P after the menus' ▶ cursor; the live word as glyph +
// WORD; the tabs flush in Press Start 2P capitals, the chosen one in the palette's highlight over
// its bar; the shell's grounds the page; the chosen day the highlight with its ink; every status a
// card carries a glyph and a word read at AA on the window; and the primitives the screens draw
// with square, 44 high at least, the cards Arcade's windows.

import { describe, expect, it } from 'vitest';

import { BOARD_STATUSES } from '../../cc/board/board';
import { ticketCard } from '../../cc/board/view-model';
import { TAB_STRIP } from '../../cc/shell/chrome';
import { SHELL_COPY } from '../../cc/strings';
import { AA_TEXT, contrastRatio } from '../../core/web/lib/look-kit/contrast';
import { buttonHeight, controlLabel, dressedPanelPaint, labelStyle } from '../../ui/dressed';
import { BUTTON_SIZES } from '../../ui/variants';
import { FONT_FAMILIES } from '../fonts';
import {
  arcadeShellRuns,
  dressedStripCell,
  markToken,
  shellGround,
  shellTabPaint,
  shellTitle,
} from '../dress/cc-dress';
import { DRESS_MIN_HEIGHT, dressOf } from '../dress/dress';
import { ARCADE_CHIP_RING } from '../dress/paints';
import { GLYPHS, GLYPH_ROLE_TOKENS, isGlyphStatus, statusGlyph } from '../dress/status-glyphs';
import { ARCADE, ARCADE_STYLES } from '../dress/__tests__/fixtures';
import type { ResolvedStyle } from '../provider/resolve';
import { ARCADE_DRESS_COPY } from '../strings';
import { faceFor } from '../typeface/faces';
import {
  BARE_DAY,
  BOARD_SERVER_STATUSES,
  CHOSEN_DAY,
  TODAY_WITH_ITEMS,
  shell,
  ticket,
} from './cc-fixtures';

const PIXEL = faceFor(FONT_FAMILIES.pressStart2p, 400);

function varsOf(style: ResolvedStyle) {
  if (!style.arcade) throw new Error('fixture without its variables');
  return style.arcade;
}

describe('the head’s title in Arcade', () => {
  it('is the screen slot in Press Start 2P after the ▶ cursor in the accent', () => {
    ARCADE_STYLES.forEach((style) => {
      const title = shellTitle(style, SHELL_COPY.title);
      expect(title.face).toEqual(style.type.display('screen'));
      expect(title.face?.fontFamily).toBe(PIXEL);
      expect(title.runs).toEqual(arcadeShellRuns(SHELL_COPY.title));
      expect(title.runs.map((run) => run.text).join('')).toBe(`▶ ${SHELL_COPY.title}`);
      expect(title.runs.filter((run) => run.accent).map((run) => run.text)).toEqual(['▶ ']);
      expect(title.accessibilityLabel).toBe(SHELL_COPY.title);
    });
    expect(ARCADE_DRESS_COPY.cursor).toBe('▶');
  });

  it('draws the cursor in the accent, at AA on the page', () => {
    ARCADE_STYLES.forEach(({ tokens: { colours } }) =>
      expect(contrastRatio(colours.primary, colours.background)).toBeGreaterThanOrEqual(AA_TEXT),
    );
  });
});

describe('the shell in Arcade', () => {
  it('says the live word as glyph + WORD and the way back in the button face', () => {
    ARCADE_STYLES.forEach((style) => {
      const { live, back } = shell(style);
      expect(live).toBe('glyph');
      expect(back).toEqual(style.type.button);
      expect(back).toMatchObject({ fontFamily: PIXEL, textTransform: 'uppercase' });
    });
  });

  it('sets the tabs flush, 16 in, in Press Start 2P capitals at the button step', () => {
    ARCADE_STYLES.forEach((style) => {
      const { tabs } = shell(style);
      const dress = dressOf(style);
      expect(tabs.face).toEqual(controlLabel(style, dress, TAB_STRIP.level, TAB_STRIP.weight));
      expect(tabs.face).toEqual(style.type.button);
      expect(tabs).toMatchObject({ gap: 0, tabPaddingX: 16, stripPaddingX: 4 });
    });
  });

  it('marks the chosen tab in the highlight over its bar, the others muted with none', () => {
    ARCADE_STYLES.forEach((style) => {
      const { tabs } = shell(style);
      const { colours } = style.tokens;
      expect(markToken('arcade')).toBe('accent');
      expect(colours.accent).toBe(varsOf(style).hl);
      expect(shellTabPaint(colours, tabs, true)).toEqual({
        color: colours.accent,
        rule: colours.accent,
      });
      expect(shellTabPaint(colours, tabs, false)).toEqual({
        color: colours.mutedForeground,
        rule: 'transparent',
      });
      const strip = colours[TAB_STRIP.ground];
      for (const word of [colours.accent, colours.mutedForeground]) {
        expect(contrastRatio(word, strip)).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });
  });

  it('keeps the shell’s grounds their own colour: the page, opaque', () => {
    ARCADE_STYLES.forEach((style) => {
      const { background } = style.tokens.colours;
      expect(background).toBe(varsOf(style).page);
      expect(shellGround(dressOf(style), background)).toBe(background);
    });
  });
});

describe('the day strip in Arcade', () => {
  it('chooses the day in the highlight with its ink, today in the chip, the dot in the mark', () => {
    ARCADE_STYLES.forEach((style) => {
      const v = varsOf(style);
      const dress = dressOf(style);
      const { colours } = style.tokens;
      expect(dressedStripCell(dress, colours, CHOSEN_DAY)).toEqual({
        backgroundColor: v.hl,
        borderColor: v.hl,
        color: v.hlt,
        dot: v.hlt,
        borderWidth: ARCADE_CHIP_RING,
      });
      expect(dressedStripCell(dress, colours, TODAY_WITH_ITEMS)).toMatchObject({
        backgroundColor: v.win,
        borderColor: v.bd,
        dot: colours.accent,
      });
      const bare = dressedStripCell(dress, colours, BARE_DAY);
      expect([bare.backgroundColor, bare.borderColor, bare.dot]).toEqual(
        Array(3).fill('transparent'),
      );
    });
  });
});

describe('every status a card carries, in Arcade', () => {
  it('has a glyph and a word, the glyph at AA on the window', () => {
    ARCADE_STYLES.forEach((style) => {
      const { colours } = style.tokens;
      BOARD_SERVER_STATUSES.forEach((status) => {
        const { pip, word } = ticketCard(ticket({ status })).status;
        expect(isGlyphStatus(pip)).toBe(true);
        const glyph = statusGlyph(pip);
        expect(Object.values(GLYPHS)).toContain(glyph.glyph);
        expect(word.trim()).not.toBe('');
        const ink = colours[GLYPH_ROLE_TOKENS[glyph.role]];
        expect(contrastRatio(ink, colours.card)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    });
    expect(BOARD_STATUSES.every((status) => isGlyphStatus(status))).toBe(true);
  });
});

describe('the primitives in Arcade', () => {
  it('Card: Arcade’s window round every panel, the accent’s lines round a selected one', () => {
    ARCADE_STYLES.forEach((style) => {
      const dress = dressOf(style);
      const v = varsOf(style);
      expect(dress.panel).toBe('window');
      expect(dressedPanelPaint(dress)).toMatchObject({
        background: v.win,
        border: v.bd,
        borderWidth: 2,
      });
      expect(dressedPanelPaint(dress).glow).toBe(dress.paints.panel.frame);
      expect(dressedPanelPaint(dress, { pressed: true }).glow).toBe(dress.paints.panel.frame);
      const selected = dressedPanelPaint(dress, { selected: true });
      expect(selected).toMatchObject({ border: v.ac, borderWidth: 2 });
      expect(selected.glow).toBe(dress.paints.panel.selectedGlow);
    });
  });

  it('StatusPip: glyph + WORD, the word in the label face', () => {
    ARCADE_STYLES.forEach((style) => {
      const dress = dressOf(style);
      expect(dress.status).toBe('glyph');
      expect(labelStyle(style, dress)).toEqual(style.type.label);
    });
  });

  it('Button, Sheet, TextField, Pill and Chip: square, and 44 high at least in and out of a panel', () => {
    ARCADE_STYLES.forEach((style) => {
      const dress = dressOf(style);
      const corners = [
        dress.sheetRadius,
        dress.grabberRadius,
        dress.radii.input,
        dress.pill.radius,
      ];
      expect([...corners, dress.radii.chip, dress.button.radius]).toEqual([0, 0, 0, 0, 0, 0]);
      expect(dress.pill.minHeight).toBeGreaterThanOrEqual(DRESS_MIN_HEIGHT);
      for (const inPanel of [false, true]) {
        expect(buttonHeight(dress, BUTTON_SIZES.sm.height, inPanel)).toBe(DRESS_MIN_HEIGHT);
      }
    });
    expect(controlLabel(ARCADE, dressOf(ARCADE), BUTTON_SIZES.md.level)).toEqual(
      ARCADE.type.button,
    );
  });
});
