// The Command Centre in each style (D-ONE-SET, US-016l), pure: what A3's shell (src/cc/shell: the
// top bar, head, tabs and live word) and the Calendar's day strip draw differently under Play and
// HUD, so they stay one set of screens that only reads this. Studio (an installed theme too, D58)
// is the Command Centre as built; everything else A3 draws already goes through the primitives.
// Two more decisions that stopped the dress: the shell's opaque grounds (the tabs and the tab's
// screen), which hid Play's glow and HUD's grid, and A2's composer pill's 21 pt corners, which
// HUD's TYPE sheet draws square (shellGround and roundCorner below).
//
//   Studio  as built (src/cc/shell/chrome.ts, src/cc/calendar/chrome.ts): Title 1, tabs at Body 4
//           500 over the accent rule, the live dot pulsing beside its word, the chosen day in ink
//   Play    the head title in the look's display face at the screen slot (Ember's 'Chats'); tabs
//           40 high with the look's accent as the underline; the chosen day Ember's chosen chip
//   HUD     'AUTOMATOS // COMMAND' in the display face at .18em, '//' in the accent; the live word
//           as glyph + WORD ('● STREAMING LIVE'); tabs in Geist Mono 12 capitals at .14em, 16 in
//           and flush, the chosen one in the accent over a 2 pt inset accent bar ('Automatos
//           Command HUD.dc.html' nav: padding 0 16px, box-shadow inset 0 -2px 0); the chosen day
//           HUD's chosen fill with its 1.5 pt accent line
//
// Under a look Studio's --accent is the consequence colour, never the look's accent (core look-kit
// studio-tokens.ts, D-REVIEW F9); the look's accent is --primary. So a mark (the tab's rule, a day's
// dot) takes the style's accent: --accent in Studio, --primary in Play and HUD. Words of
// consequence (needs you, overdue, a raised priority) keep --accent, as the web paints them.

import type { LiveStatus } from '../../api/live-events';
import type { StripCellPaint } from '../../cc/calendar/chrome';
import { TAB_STRIP, TOP_BAR } from '../../cc/shell/chrome';
import { controlLabel } from '../../ui/dressed';
import type { Layout } from '../registry/style-id';
import type { ResolvedStyle } from '../provider/resolve';
import { HUD_CORE_COPY } from '../strings';
import type { StyleRadii } from '../tokens/radii';
import type { ColourName, Colours } from '../tokens/types';
import type { TypeStyle } from '../type';
import type { Dress } from './dress';
import type { GlyphStatus } from './status-glyphs';

const NONE = 'transparent';

export type TitleRun = { readonly text: string; readonly accent: boolean };

export type ShellTitle = {
  /** The face over the head's Title 1; null: the shell's own. */
  readonly face: TypeStyle | null;
  /** The words drawn, in order; the accent runs in the style's accent. */
  readonly runs: readonly TitleRun[];
  /** What VoiceOver hears: the screen's own name, whatever the style draws. */
  readonly accessibilityLabel: string;
};

export type ShellTabs = {
  /** The tab word's face; null: the shell's own (Body 4 at 500). */
  readonly face: TypeStyle | null;
  readonly active: ColourName;
  readonly rest: ColourName;
  /** The bar under the chosen tab (TAB_STRIP.rule thick, inside the tab's box). */
  readonly rule: ColourName;
  /** Between two tabs, inside each tab, and before the first and after the last. */
  readonly gap: number;
  readonly tabPaddingX: number;
  readonly stripPaddingX: number;
};

export type ShellDress = {
  /** The live word: a dot beside its word, or HUD's glyph + WORD. */
  readonly live: 'dot' | 'glyph';
  readonly tabs: ShellTabs;
  /** The back control's label: the dress's control label at the top bar's level and weight. */
  readonly back: TypeStyle;
};

/** HUD's nav ('Automatos Command HUD.dc.html'): 16 in each tab, the strip 4 in, so the first word sits 20 in (the phone's inset). */
export const HUD_TABS = Object.freeze({ tabPaddingX: 'space7', stripPaddingX: 'space1' } as const);

const MARK: Readonly<Record<Layout, ColourName>> = Object.freeze({
  studio: 'accent',
  play: 'primary',
  hud: 'primary',
});

/** The token a mark (a tab's rule, a day's dot) takes: the style's accent. */
export function markToken(layout: Layout): ColourName {
  return MARK[layout];
}

/** The stream's state as a status HUD has a glyph for: ● live, ○ connecting, — offline. */
const LIVE_GLYPH_STATUS: Readonly<Record<LiveStatus, GlyphStatus>> = Object.freeze({
  live: 'live',
  connecting: 'queued',
  offline: 'offline',
});

/** The glyph status for the stream's state; a state this version does not know reads as offline. */
export function liveGlyphStatus(status: LiveStatus): GlyphStatus {
  return LIVE_GLYPH_STATUS[status] ?? LIVE_GLYPH_STATUS.offline;
}

/** HUD's brand line, 'AUTOMATOS // COMMAND', the mark in the accent. */
export const HUD_SHELL_RUNS: readonly TitleRun[] = Object.freeze([
  { text: `${HUD_CORE_COPY.brand} `, accent: false },
  { text: HUD_CORE_COPY.brandMark, accent: true },
  { text: ` ${HUD_CORE_COPY.command}`, accent: false },
]);

/** The head's title: as built in Studio, the screen slot in Play, the brand line in HUD. */
export function shellTitle(style: ResolvedStyle, title: string): ShellTitle {
  const plain = Object.freeze([{ text: title, accent: false }]);
  if (style.layout === 'hud') {
    const face = style.type.display('brand');
    return Object.freeze({ face, runs: HUD_SHELL_RUNS, accessibilityLabel: title });
  }
  const face = style.layout === 'play' ? style.type.display('screen') : null;
  return Object.freeze({ face, runs: plain, accessibilityLabel: title });
}

function shellTabs(style: ResolvedStyle, dress: Dress): ShellTabs {
  const { spacing } = style.tokens;
  const rule = markToken(style.layout);
  if (style.layout === 'hud') {
    return {
      face: controlLabel(style, dress, TAB_STRIP.level, TAB_STRIP.weight),
      active: 'primary',
      rest: 'mutedForeground',
      rule,
      gap: 0,
      tabPaddingX: spacing[HUD_TABS.tabPaddingX],
      stripPaddingX: spacing[HUD_TABS.stripPaddingX],
    };
  }
  return {
    face: null,
    active: 'foreground',
    rest: 'mutedForeground',
    rule,
    gap: spacing[TAB_STRIP.gap],
    tabPaddingX: 0,
    stripPaddingX: spacing[TAB_STRIP.paddingX],
  };
}

/** The shell's dress for the style a subtree paints. */
export function shellDress(style: ResolvedStyle, dress: Dress): ShellDress {
  return Object.freeze({
    live: dress.status === 'glyph' ? 'glyph' : 'dot',
    tabs: Object.freeze(shellTabs(style, dress)),
    back: controlLabel(style, dress, TOP_BAR.backLevel, TOP_BAR.backWeight),
  });
}

/**
 * A shell surface's ground (the tabs, the tab's screen): its own colour on Studio's plain ground;
 * clear over Play's glow and HUD's grid, so the style's ground runs under the head, the tabs and
 * the tab's screen as it does on every other screen (the Screen primitive draws it).
 */
export function shellGround(dress: Dress, own: string): string {
  return dress.ground === 'plain' ? own : NONE;
}

/**
 * A corner that rounds fully where the style rounds things (Studio and Play: the radius given)
 * and squares where it rounds nothing (HUD's full radius is 0).
 */
export function roundCorner(radius: number, radii: Pick<StyleRadii, 'full'>): number {
  return Math.min(radius, radii.full);
}

export type ShellTabPaint = { readonly color: string; readonly rule: string };

/** A tab's word and bar: the chosen one in its ink over the rule; the others muted, no bar. */
export function shellTabPaint(colours: Colours, tabs: ShellTabs, selected: boolean): ShellTabPaint {
  return selected
    ? { color: colours[tabs.active], rule: colours[tabs.rule] }
    : { color: colours[tabs.rest], rule: NONE };
}

export type StripCell = {
  readonly selected: boolean;
  readonly today: boolean;
  readonly hasItems: boolean;
};

export type DressedStripCell = StripCellPaint & { readonly borderWidth: number };

/**
 * A day in the strip: the chosen one wears the dress's chosen chip (Studio's solid ink, exactly
 * stripCellPaint's), today the resting chip's ground and line, any other day bare; the words in ink
 * and the dot, on a day with items, in the style's accent (the chosen chip's ink on the chosen day).
 */
export function dressedStripCell(
  dress: Dress,
  colours: Colours,
  cell: StripCell,
): DressedStripCell {
  const { pill } = dress.paints;
  if (cell.selected) {
    const { background, border, foreground } = pill.selected;
    return {
      backgroundColor: background,
      borderColor: border,
      color: foreground,
      dot: cell.hasItems ? foreground : NONE,
      borderWidth: pill.selectedBorderWidth,
    };
  }
  return {
    backgroundColor: cell.today ? pill.rest.background : NONE,
    borderColor: cell.today ? pill.rest.border : NONE,
    color: colours.foreground,
    dot: cell.hasItems ? colours[markToken(dress.layout)] : NONE,
    borderWidth: pill.borderWidth,
  };
}
