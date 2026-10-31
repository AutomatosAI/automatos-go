// The Command Centre, its sheets and settings in each style (US-016l, D-ONE-SET): one set of
// screens, dressed (Arcade's shell, statuses and primitives: arcade-cc-dress.test.ts; Candy's:
// candy-cc-dress.test.ts). Every status A3's board puts on a card (read from A3's own modules) has HUD's
// glyph and a word; the shell is Studio's as built, Play's display title and accent underline, and
// HUD's 'AUTOMATOS // COMMAND', glyph + WORD live word and Geist Mono tabs over a 2 pt inset bar;
// the calendar's kind colours stay the vendored data (K14); and the primitives those screens draw
// with wear each style's dress (Studio exactly the foundation's).

import { describe, expect, it } from 'vitest';

import type { LiveStatus } from '../../api/live-events';
import { BOARD_STATUSES } from '../../cc/board/board';
import { filterPills, ticketCard } from '../../cc/board/view-model';
import { DAY_STRIP, kindTone, stripCellPaint } from '../../cc/calendar/chrome';
import { kindWord } from '../../cc/calendar/day-model';
import { TAB_STRIP, TOP_BAR, liveWord, tabPaint } from '../../cc/shell/chrome';
import { SHELL_COPY } from '../../cc/strings';
import { pillMetrics } from '../../chat/composer/composer-state';
import { KIND_META, KIND_ORDER } from '../../core/web/components/command-center/calendar-kinds';
import {
  buttonHeight,
  controlLabel,
  dressedButtonPaint,
  dressedPanelPaint,
  dressedTextFace,
  labelStyle,
} from '../../ui/dressed';
import {
  BUTTON_SIZES,
  buttonPaint,
  cardPaint,
  textRole,
  type ButtonVariant,
} from '../../ui/variants';
import {
  HUD_SHELL_RUNS,
  dressedStripCell,
  liveGlyphStatus,
  markToken,
  roundCorner,
  shellGround,
  shellTabPaint,
  shellTitle,
} from '../dress/cc-dress';
import { DRESS_MIN_HEIGHT, dressOf } from '../dress/dress';
import { HUD_SELECTED_BORDER } from '../dress/paints';
import {
  GLYPHS,
  GLYPH_ROLE_TOKENS,
  glyphLine,
  isGlyphStatus,
  statusGlyph,
} from '../dress/status-glyphs';
import {
  ALL_STYLES,
  HUD,
  HUD_STYLES,
  PLAY,
  PLAY_STYLES,
  STUDIO_STYLES,
} from '../dress/__tests__/fixtures';
import { HUD_CORE_COPY } from '../strings';
import { MIN_TEXT_SIZE } from '../type';
import { trackingPt } from '../typeface/tracking';
import {
  BARE_DAY,
  BOARD_SERVER_STATUSES,
  CHOSEN_DAY,
  LIVE_STATUSES,
  STRIP_CELLS,
  TODAY_WITH_ITEMS,
  shell,
  ticket,
} from './cc-fixtures';

const GLYPH_SET: readonly string[] = Object.values(GLYPHS);

describe('every status A3’s board uses has a HUD glyph and a word', () => {
  it.each(BOARD_SERVER_STATUSES)('a card for a ‘%s’ ticket', (status) => {
    const card = ticketCard(ticket({ status }));
    expect(isGlyphStatus(card.status.pip)).toBe(true);
    const glyph = statusGlyph(card.status.pip);
    expect(GLYPH_SET).toContain(glyph.glyph);
    expect(glyph.word.trim()).not.toBe('');
    expect(card.status.word.trim()).not.toBe('');
  });

  it('an unknown status says itself under —; a failed Deliverable says Failed under ✕', () => {
    const card = ticketCard(ticket({ status: 'waiting_on_host' }));
    expect(card.status.word).toBe('Waiting on host');
    expect(statusGlyph(card.status.pip).glyph).toBe(GLYPHS.stopped);
    expect(statusGlyph('failed')).toMatchObject({ glyph: GLYPHS.failed, role: 'error' });
  });

  it('every filter pill names a status HUD has a glyph for', () => {
    const pills = filterPills([ticket({ status: 'blocked' })], 'all').filter(
      (pill) => pill.filter !== 'all',
    );
    expect(pills.map((pill) => pill.filter)).toEqual([...BOARD_STATUSES]);
    pills.forEach((pill) => expect(isGlyphStatus(pill.filter)).toBe(true));
  });

  it('paints each glyph in a token every HUD look has and writes the WORD beside it', () => {
    HUD_STYLES.forEach((style) => {
      BOARD_SERVER_STATUSES.forEach((status) => {
        const { pip, word } = ticketCard(ticket({ status })).status;
        const glyph = statusGlyph(pip);
        expect(style.tokens.colours[GLYPH_ROLE_TOKENS[glyph.role]]).toMatch(/\S/);
        expect(glyphLine(pip, word)).toBe(`${glyph.glyph} ${word.toUpperCase()}`);
      });
    });
  });
});

describe('the live word: ‘● STREAMING LIVE’ in HUD', () => {
  it('reads live as ●, connecting as ○ and offline as —, and an unknown state as offline', () => {
    LIVE_STATUSES.forEach((state) => {
      expect(isGlyphStatus(liveGlyphStatus(state))).toBe(true);
      expect(liveWord(state, false).word.trim()).not.toBe('');
    });
    expect(statusGlyph(liveGlyphStatus('live')).glyph).toBe(GLYPHS.working);
    expect(statusGlyph(liveGlyphStatus('connecting')).glyph).toBe(GLYPHS.waiting);
    expect(statusGlyph(liveGlyphStatus('offline')).glyph).toBe(GLYPHS.stopped);
    expect(liveGlyphStatus('reconnecting' as LiveStatus)).toBe('offline');
    expect(glyphLine(liveGlyphStatus('live'), liveWord('live', false).word)).toBe(
      '● STREAMING LIVE',
    );
  });

  it('is the glyph and WORD in HUD; the pulsing dot and its word in Studio and Play', () => {
    HUD_STYLES.forEach((style) => expect(shell(style).live).toBe('glyph'));
    [...STUDIO_STYLES, ...PLAY_STYLES].forEach((style) => expect(shell(style).live).toBe('dot'));
  });
});

describe('the head’s title per style', () => {
  it('is Studio’s as built: the shell’s own face and the screen’s name', () => {
    STUDIO_STYLES.forEach((style) => {
      expect(shellTitle(style, SHELL_COPY.title)).toEqual({
        face: null,
        runs: [{ text: SHELL_COPY.title, accent: false }],
        accessibilityLabel: SHELL_COPY.title,
      });
    });
  });

  it('is Play’s screen slot in the look’s display face', () => {
    PLAY_STYLES.forEach((style) => {
      const title = shellTitle(style, SHELL_COPY.title);
      expect(title.face).toEqual(style.type.display('screen'));
      expect(title.runs.map((run) => run.text).join('')).toBe(SHELL_COPY.title);
    });
  });

  it('is HUD’s brand line ‘AUTOMATOS // COMMAND’ at .18em, the mark alone in the accent', () => {
    HUD_STYLES.forEach((style) => {
      const title = shellTitle(style, SHELL_COPY.title);
      const face = title.face ?? style.type.body(MIN_TEXT_SIZE);
      expect(title.face).toEqual(style.type.display('brand'));
      expect(face.letterSpacing).toBe(trackingPt(0.18, face.fontSize));
      expect(title.runs).toBe(HUD_SHELL_RUNS);
      expect(title.runs.map((run) => run.text).join('')).toBe('AUTOMATOS // COMMAND');
      expect(title.runs.filter((run) => run.accent).map((run) => run.text)).toEqual([
        HUD_CORE_COPY.brandMark,
      ]);
      expect(title.accessibilityLabel).toBe(SHELL_COPY.title);
    });
  });
});

describe('the tabs per style', () => {
  it('are Studio’s as built: Body 4 at 500, 18 apart and in, the accent rule (tabPaint)', () => {
    STUDIO_STYLES.forEach((style) => {
      const { tabs } = shell(style);
      const { colours, spacing } = style.tokens;
      expect(tabs).toMatchObject({ face: null, gap: spacing[TAB_STRIP.gap], tabPaddingX: 0 });
      expect(tabs.stripPaddingX).toBe(spacing[TAB_STRIP.paddingX]);
      [true, false].forEach((selected) =>
        expect(shellTabPaint(colours, tabs, selected)).toEqual(tabPaint(colours, selected)),
      );
    });
  });

  it('are 40 high in Play with the look’s accent as the underline', () => {
    expect(TAB_STRIP.height).toBe(40);
    PLAY_STYLES.forEach((style) => {
      const { tabs } = shell(style);
      const { colours } = style.tokens;
      expect(tabs.face).toBeNull();
      expect(shellTabPaint(colours, tabs, true)).toEqual({
        color: colours.foreground,
        rule: colours.primary,
      });
      expect(shellTabPaint(colours, tabs, false).rule).toBe('transparent');
    });
  });

  it('are Geist Mono 12 capitals at .14em in HUD, 16 in, the chosen one in the accent over a 2 pt bar', () => {
    expect(TAB_STRIP.rule).toBe(2);
    HUD_STYLES.forEach((style) => {
      const { tabs } = shell(style);
      const { colours } = style.tokens;
      const face = tabs.face ?? style.type.body(MIN_TEXT_SIZE);
      expect(face.fontFamily).toMatch(/^GeistMono-/);
      expect(face).toMatchObject({ fontSize: 12, textTransform: 'uppercase' });
      expect(face.letterSpacing).toBe(trackingPt(0.14, 12));
      expect(tabs).toMatchObject({ gap: 0, tabPaddingX: 16 });
      const paint = (selected: boolean) => shellTabPaint(colours, tabs, selected);
      expect(paint(true)).toEqual({ color: colours.primary, rule: colours.primary });
      expect(paint(false)).toEqual({ color: colours.mutedForeground, rule: 'transparent' });
    });
  });

  it('mark with the style’s accent: Studio’s --accent, the look’s in Play and HUD, Arcade’s hl, Candy’s accent text', () => {
    const marks = (['studio', 'play', 'hud', 'arcade', 'candy'] as const).map(markToken);
    expect(marks).toEqual(['accent', 'primary', 'primary', 'accent', 'primary']);
  });
});

describe('the top bar’s way back per style', () => {
  it('is Studio’s Body 1 at 500 and the ghost paint, unchanged', () => {
    STUDIO_STYLES.forEach((style) => {
      const role = textRole('body', TOP_BAR.backLevel);
      expect(shell(style).back).toEqual(
        dressedTextFace(style, role, { weight: TOP_BAR.backWeight }),
      );
      [true, false].forEach((pressed) =>
        expect(dressedButtonPaint(dressOf(style), 'ghost', { pressed }).backgroundColor).toBe(
          buttonPaint(style.tokens.colours, 'ghost', { pressed }).backgroundColor,
        ),
      );
    });
  });

  it('is HUD’s control label: Geist Mono capitals', () => {
    expect(shell(HUD).back).toMatchObject({ fontSize: 12, textTransform: 'uppercase' });
    expect(shell(HUD).back.fontFamily).toMatch(/^GeistMono-/);
  });
});

describe('the grounds under the shell', () => {
  it('stay the shell’s own colour in Studio and clear over Play’s glow and HUD’s grid', () => {
    STUDIO_STYLES.forEach((style) => {
      const { background } = style.tokens.colours;
      expect(shellGround(dressOf(style), background)).toBe(background);
    });
    [...PLAY_STYLES, ...HUD_STYLES].forEach((style) =>
      expect(shellGround(dressOf(style), style.tokens.colours.background)).toBe('transparent'),
    );
  });
});

describe('the day strip per style', () => {
  it('is Studio’s as built: stripCellPaint at a 1 pt line', () => {
    STUDIO_STYLES.forEach((style) => {
      const { colours } = style.tokens;
      STRIP_CELLS.forEach((cell) =>
        expect(dressedStripCell(dressOf(style), colours, cell)).toEqual({
          ...stripCellPaint(colours, cell),
          borderWidth: DAY_STRIP.borderWidth,
        }),
      );
    });
  });

  it('wears the dress’s chosen chip in Play and HUD, the dot in the look’s accent', () => {
    [...PLAY_STYLES, ...HUD_STYLES].forEach((style) => {
      const dress = dressOf(style);
      const { colours } = style.tokens;
      const chosen = dressedStripCell(dress, colours, CHOSEN_DAY);
      expect(chosen).toMatchObject({
        backgroundColor: dress.paints.pill.selected.background,
        borderColor: dress.paints.pill.selected.border,
        color: dress.paints.pill.selected.foreground,
        borderWidth: dress.paints.pill.selectedBorderWidth,
      });
      const today = dressedStripCell(dress, colours, TODAY_WITH_ITEMS);
      expect(today.backgroundColor).toBe(dress.paints.pill.rest.background);
      expect(today.dot).toBe(colours.primary);
      const bare = dressedStripCell(dress, colours, BARE_DAY);
      expect([bare.backgroundColor, bare.borderColor, bare.dot]).toEqual(
        Array(3).fill('transparent'),
      );
    });
    expect(dressedStripCell(dressOf(HUD), HUD.tokens.colours, CHOSEN_DAY).borderWidth).toBe(
      HUD_SELECTED_BORDER,
    );
  });
});

describe('the calendar kinds in every style (K14)', () => {
  it('keep the vendored calendar-kinds colour and word', () => {
    ALL_STYLES.forEach((style) => {
      KIND_ORDER.forEach((type) => {
        const kind = kindWord(type);
        expect(kind.label).toBe(KIND_META[type].label);
        expect(kindTone(style.tokens.colours, kind)).toBe(KIND_META[type].tone);
      });
    });
  });

  it('draw a kind this version does not know in the style’s muted ink, with its own word', () => {
    ALL_STYLES.forEach((style) => {
      const kind = kindWord('standup_digest');
      expect(kind.label).toBe('Standup digest');
      expect(kindTone(style.tokens.colours, kind)).toBe(style.tokens.colours.mutedForeground);
    });
  });
});

describe('the primitives the Command Centre, its sheets and settings draw with, per style', () => {
  const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'outline', 'ghost'];

  it('Card: Studio’s and Play’s cards, HUD’s bracketed panels with the 1.5 pt selected line', () => {
    STUDIO_STYLES.forEach((style) => {
      const dress = dressOf(style);
      const { colours } = style.tokens;
      expect(dress.panel).toBe('card');
      expect(dress.paints.panel.bracket).toBeNull();
      [true, false].forEach((pressed) => {
        const { background, border } = dressedPanelPaint(dress, { pressed });
        const card = cardPaint(colours, pressed);
        expect([background, border]).toEqual([card.backgroundColor, card.borderColor]);
      });
    });
    PLAY_STYLES.forEach((style) => expect(dressOf(style).panel).toBe('card'));
    HUD_STYLES.forEach((style) => {
      const dress = dressOf(style);
      expect(dress.panel).toBe('bracket');
      expect(dress.paints.panel.bracket).toMatch(/\S/);
      expect(dressedPanelPaint(dress, { selected: true }).borderWidth).toBe(HUD_SELECTED_BORDER);
    });
  });

  it('StatusPip: a dot and a word in Studio and Play, glyph + WORD in HUD', () => {
    [...STUDIO_STYLES, ...PLAY_STYLES].forEach((style) =>
      expect(dressOf(style).status).toBe('pip'),
    );
    HUD_STYLES.forEach((style) => {
      expect(dressOf(style).status).toBe('glyph');
      expect(labelStyle(style, dressOf(style)).textTransform).toBe('uppercase');
    });
  });

  it('Button: Studio’s paints unchanged; 44 high at least in Play and HUD, 46 in a HUD panel', () => {
    STUDIO_STYLES.forEach((style) => {
      VARIANTS.forEach((variant) =>
        expect(dressedButtonPaint(dressOf(style), variant)).toEqual(
          buttonPaint(style.tokens.colours, variant),
        ),
      );
    });
    [PLAY, HUD].forEach((style) => {
      expect(buttonHeight(dressOf(style), BUTTON_SIZES.sm.height, false)).toBe(DRESS_MIN_HEIGHT);
    });
    expect(buttonHeight(dressOf(HUD), BUTTON_SIZES.md.height, true)).toBe(46);
    expect(controlLabel(HUD, dressOf(HUD), BUTTON_SIZES.md.level).textTransform).toBe('uppercase');
  });

  it('Sheet, TextField, Pill and Chip: Studio’s corners, Play’s round, HUD’s square', () => {
    STUDIO_STYLES.forEach((style) => {
      const dress = dressOf(style);
      expect([dress.sheetRadius, dress.radii.input, dress.pill.radius, dress.radii.chip]).toEqual([
        14, 6, 12, 3,
      ]);
    });
    PLAY_STYLES.forEach((style) => {
      const dress = dressOf(style);
      expect([dress.sheetRadius, dress.radii.input, dress.pill.minHeight]).toEqual([14, 12, 40]);
      expect(dress.pill.radius).toBeGreaterThanOrEqual(dress.pill.minHeight / 2);
    });
    HUD_STYLES.forEach((style) => {
      const dress = dressOf(style);
      expect([
        dress.sheetRadius,
        dress.grabberRadius,
        dress.radii.input,
        dress.pill.radius,
      ]).toEqual([0, 0, 0, 0]);
      expect(dress.pill.minHeight).toBeGreaterThanOrEqual(DRESS_MIN_HEIGHT);
    });
  });

  it('A2’s composer pill in a TYPE sheet: 21 pt corners in Studio and Play, square in HUD and Arcade', () => {
    ALL_STYLES.forEach((style) => {
      const { radius } = pillMetrics(style.tokens.type.thread.lineHeight);
      const corner = roundCorner(radius, style.tokens.radii);
      expect(corner).toBe(style.layout === 'hud' || style.layout === 'arcade' ? 0 : 21);
    });
  });

  it('labels, statuses and controls stay at 11 pt or more in every style (D-A11Y)', () => {
    ALL_STYLES.forEach((style) => {
      const dress = dressOf(style);
      const { tabs, back } = shell(style);
      const faces = [labelStyle(style, dress), back, ...(tabs.face ? [tabs.face] : [])];
      faces.forEach((face) => expect(face.fontSize).toBeGreaterThanOrEqual(MIN_TEXT_SIZE));
    });
  });
});
