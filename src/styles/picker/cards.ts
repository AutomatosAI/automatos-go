// The Style and look screen's cards (US-016h, FR-7): US-016a's pickerState as one large card per
// built-in style — the words it shows and says, its look link, Studio's Light / Dark / System and
// installed theme rows — plus the rules the card's frame and live preview follow. Pure: the
// screen (StylePicker.tsx) renders it, each card inside a StyleScope of its own style.
//
// VoiceOver: a card is one button named '<Style> style' whose selected state rides in
// accessibilityState, so it is said once; on screen the chosen card carries a 2 pt ring in its
// style's accent AND the word 'Selected' (never colour alone, D-A11Y).

import { toolLineLabel } from '../../core/web/components/play/chat/labels';
import { captionFor } from '../../core/web/lib/mascot/media';
import type { HostToolCall } from '../../core/web/lib/theme-sdk';
import { lookScreen, type StyleScreenPath } from '../nav';
import type { StyleMotion } from '../provider/resolve';
import type { PickerSection, PickerState, PickerThemeRow, SchemeOption } from '../registry/picker';
import type { BuiltInStyleId, StyleChoice } from '../registry/style-id';
import { PICKER_COPY, PREVIEW_COPY } from '../strings';

export type LookLink = {
  /** On screen: 'Make it yours →', 'Looks →'. */
  readonly label: string;
  /** For VoiceOver: the words without the arrow. */
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string;
  readonly href: StyleScreenPath;
};

/** An installed theme's row under Studio, with its word when it is the one painted. */
export type PickerCardTheme = PickerThemeRow & { readonly selectedWord: string | null };

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
  /** Play's 'Make it yours →', HUD's 'Looks →'; null for Studio. */
  readonly lookLink: LookLink | null;
  /** Studio only, when US-016i lists installed themes with a phone look. */
  readonly themes: readonly PickerCardTheme[];
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
  });
}

/** One card per section, in the registry's order (Studio, Play, HUD). */
export function pickerCards(state: PickerState): readonly PickerCard[] {
  return Object.freeze(state.sections.map(card));
}

/** The frame's ring: 2 pt in the style's accent when chosen, else its 1 pt border. */
export const CARD_RING = Object.freeze({ selected: 2, idle: 1 });

export type CardFrame = {
  readonly borderWidth: number;
  /** Makes up the thinner border, so choosing a card never moves anything. */
  readonly margin: number;
  /** The token the ring is painted in: the card's style's accent, or its border. */
  readonly colour: 'accent' | 'border';
};

export function cardFrame(selected: boolean): CardFrame {
  if (selected) return { borderWidth: CARD_RING.selected, margin: 0, colour: 'accent' };
  return {
    borderWidth: CARD_RING.idle,
    margin: CARD_RING.selected - CARD_RING.idle,
    colour: 'border',
  };
}

/**
 * A preview moves only while the screen is focused and its style's loops may run: never under
 * Reduce Motion, and never in HUD while its look's motion is off (resolve.ts motionOf).
 */
export function previewAnimates(focused: boolean, motion: StyleMotion): boolean {
  return focused && motion.loops;
}

/** The previews' numbers: Auto at 84 (Play's Auto row), HUD's ring core at 120. */
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
