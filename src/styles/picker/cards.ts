// The Style and look screen's cards (US-016h, FR-7): US-016a's pickerState as one large card per
// built-in style — the words it shows and says, its look link, Studio's Light / Dark / System and
// installed theme rows — plus the rules the card's frame and live preview follow. Pure: the
// screen (StylePicker.tsx) renders it, each card inside a StyleScope of its own style.
//
// VoiceOver: a card is one button named '<Style> style' whose selected state rides in
// accessibilityState, so it is said once; on screen the chosen card carries a 2 pt ring in its
// style's accent AND the word 'Selected' (never colour alone, D-A11Y). The accent is the style's
// own (selectedPaint): under Play and HUD the Studio-keyed 'accent' is the look's error colour.
// Arcade's ring and word are its palette's accent (ac), which reads at AA on its window ground.

import { toolLineLabel } from '../../core/frozen/components/play/chat/labels';
import { captionFor } from '../../core/frozen/lib/mascot/media';
import type { HostToolCall } from '../../core/frozen/lib/theme-sdk';
import type { CounterValues } from '../arcade/parts/counters';
import { stateWord } from '../arcade/sprite/states';
import { lookScreen, type StyleScreenPath } from '../nav';
import type { ResolvedStyle, StyleMotion } from '../provider/resolve';
import type {
  PickerFollowRow,
  PickerSection,
  PickerState,
  PickerThemeRow,
  SchemeOption,
} from '../registry/picker';
import type { BuiltInStyleId, StyleChoice } from '../registry/style-id';
import { ARCADE_HOME_COPY, PICKER_COPY, PREVIEW_COPY } from '../strings';

export type LookLink = {
  /** On screen: 'Make it yours →', 'Looks →', 'Options →'. */
  readonly label: string;
  /** For VoiceOver: the words without the arrow. */
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string;
  readonly href: StyleScreenPath;
};

/** An installed theme's row under Studio, with its word when it is the one painted. */
export type PickerCardTheme = PickerThemeRow & { readonly selectedWord: string | null };

/** 'Same as Studio' under Studio, with its word when it is the phone's choice. */
export type PickerCardFollow = PickerFollowRow & { readonly selectedWord: string | null };

export type PickerCard = {
  readonly id: BuiltInStyleId;
  readonly name: string;
  readonly tagline: string;
  readonly choice: StyleChoice;
  readonly selected: boolean;
  /** 'Selected' on the chosen card; null on the others. */
  readonly selectedWord: string | null;
  /** 'Studio style': the selected state is accessibilityState's, not the label's. */
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string;
  /** Studio only: Light / Dark / System; empty for Play and HUD. */
  readonly schemes: readonly SchemeOption[];
  readonly schemeGroup: string;
  /** Play's 'Make it yours →', HUD's 'Looks →', Arcade's 'Options →'; null for Studio. */
  readonly lookLink: LookLink | null;
  /** Studio only, when US-016i lists installed themes with a phone look. */
  readonly themes: readonly PickerCardTheme[];
  /** Studio only: 'Same as Studio', the first row under it; null for Play and HUD. */
  readonly follow: PickerCardFollow | null;
};

function lookLinkOf(section: PickerSection): LookLink | null {
  const href = lookScreen(section.lookPage);
  if (href === null || section.lookLink === null) return null;
  return Object.freeze({
    label: `${section.lookLink} ${PICKER_COPY.linkArrow}`,
    accessibilityLabel: section.lookLink,
    accessibilityHint: PICKER_COPY.lookHint(section.name),
    href,
  });
}

function selectedWordOf(selected: boolean): string | null {
  return selected ? PICKER_COPY.selected : null;
}

function themeOf(row: PickerThemeRow): PickerCardTheme {
  return Object.freeze({ ...row, selectedWord: selectedWordOf(row.selected) });
}

function followOf(row: PickerFollowRow | null): PickerCardFollow | null {
  return row ? Object.freeze({ ...row, selectedWord: selectedWordOf(row.selected) }) : null;
}

function card(section: PickerSection): PickerCard {
  return Object.freeze({
    id: section.id,
    name: section.name,
    tagline: section.tagline,
    choice: section.choice,
    selected: section.selected,
    selectedWord: selectedWordOf(section.selected),
    accessibilityLabel: PICKER_COPY.styleLabel(section.name, false),
    accessibilityHint: PICKER_COPY.styleHint(section.name),
    schemes: section.schemes,
    schemeGroup: PICKER_COPY.schemeGroup,
    lookLink: lookLinkOf(section),
    themes: Object.freeze(section.themes.map(themeOf)),
    follow: followOf(section.follow),
  });
}

/** One card per section, in the registry's order (Studio, Play, HUD, Arcade). */
export function pickerCards(state: PickerState): readonly PickerCard[] {
  return Object.freeze(state.sections.map(card));
}

/** The frame's ring: 2 pt in the style's accent when chosen, else its 1 pt border. */
export const CARD_RING = Object.freeze({ selected: 2, idle: 1 });

/** What a style's chosen card is painted with. */
export type SelectedPaint = {
  /** The 2 pt ring: the style's accent. */
  readonly ring: string;
  /** The check and 'Selected': that accent as text that reads on the card. */
  readonly word: string;
};

type SelectedSource = Pick<ResolvedStyle, 'layout' | 'tokens' | 'play' | 'hud' | 'arcade'>;

/**
 * The Studio-keyed 'accent' is the look's consequence (error) colour under Play and HUD (the
 * vendored studio-tokens.ts), so the chosen card reads its style's own: Play's look accent with its
 * accentText, HUD's accent (AA on its ground already), Arcade's palette accent (tuned to read on
 * its window, the card's ground), Studio's accent (there the two are one).
 */
export function selectedPaint(style: SelectedSource): SelectedPaint {
  const { play, hud, arcade } = style;
  if (style.layout === 'play' && play) return { ring: play.accent, word: play.accentText };
  if (style.layout === 'hud' && hud) return { ring: hud.accent, word: hud.accent };
  if (style.layout === 'arcade' && arcade) return { ring: arcade.ac, word: arcade.ac };
  const { accent } = style.tokens.colours;
  return { ring: accent, word: accent };
}

export type CardFrame = {
  readonly borderWidth: number;
  /** Makes up the thinner border, so choosing a card never moves anything. */
  readonly margin: number;
  /** The ring's colour: the card's style's accent, or its border. */
  readonly colour: string;
};

export function cardFrame(selected: boolean, style: SelectedSource): CardFrame {
  if (selected) {
    return { borderWidth: CARD_RING.selected, margin: 0, colour: selectedPaint(style).ring };
  }
  return {
    borderWidth: CARD_RING.idle,
    margin: CARD_RING.selected - CARD_RING.idle,
    colour: style.tokens.colours.border,
  };
}

/**
 * A preview moves only while the screen is focused and its style's loops may run: never under
 * Reduce Motion, and never in HUD while its look's motion is off (resolve.ts motionOf).
 */
export function previewAnimates(focused: boolean, motion: StyleMotion): boolean {
  return focused && motion.loops;
}

/** Arcade's preview: today's counters as a home shows them (no XP: no completion times, D-ARC-6). */
const ARCADE_PREVIEW_COUNTERS: CounterValues = Object.freeze({ xp: null, needs: 2, quest: 3 });

/**
 * The previews' numbers: Auto at 84 (Play's Auto row), HUD's ring core at 120, Arcade's handheld
 * (its sprite at the default look's pixel scale, a D-pad of 24 pt cells beside the dialogue).
 */
export const PREVIEW = Object.freeze({
  minHeight: 196,
  autoSize: 84,
  ringCore: 120,
  /** Ember's ring pulse and HUD's pulse disc share one 2.4 s loop. */
  pulseMs: 2400,
  playPulse: Object.freeze({ from: 1, to: 1.06 }),
  hudPulse: Object.freeze({ from: 0.96, to: 1.04 }),
  /** Ember's tool line: Geist Mono 12. */
  toolLineSize: 12,
  /** HUD's state chip: a 1 pt accentLine border, 5 x 12 pad, Geist Mono 500 11 at .16em. */
  chip: Object.freeze({ size: 11, weight: 500, trackingEm: 0.16, padX: 12, padY: 5, border: 1 }),
  /** Arcade's handheld: the console's 12 pt pad, 8 pt gaps, the portrait's box, the mini D-pad. */
  arcade: Object.freeze({
    pad: 12,
    gap: 8,
    windowPad: 8,
    portraitPad: 4,
    ring: 2,
    padCell: 24,
    lineSize: 15,
    counters: ARCADE_PREVIEW_COUNTERS,
  }),
});

/** Play's tool chip: the vendored words for a finished web search ('✓ Searched the web · …'). */
export function playToolLine(): string {
  const call: HostToolCall = {
    toolCallId: 'preview',
    toolName: PREVIEW_COPY.play.toolName,
    state: 'completed',
    summary: PREVIEW_COPY.play.toolSummary,
    skipped: false,
    waiting: false,
  };
  const line = toolLineLabel(call, false);
  return line.mark ? `${line.mark} ${line.text}` : line.text;
}

/** HUD's chip: Auto at rest, in capitals as the state chip says every state. */
export function hudChipWords(): string {
  return captionFor('idle').toUpperCase();
}

/** Arcade's dialogue: Auto at rest, his state word as the window says it, and the home's line. */
export function arcadePreviewWords(): { readonly state: string; readonly line: string } {
  return Object.freeze({ state: stateWord('idle'), line: ARCADE_HOME_COPY.yourMove });
}
