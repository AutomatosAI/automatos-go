// The Switch's logic, pure: its state in a word beside it (§4.6: never only a colour), what a press
// does, what VoiceOver and TalkBack hear, its touch, and its paint on the tokens. React Native's own
// switch is only drawn: the control round it takes the press and is the one element a screen reader
// meets. In a settings row that control is the whole row, at least the 44 pt touch target tall; on
// its own it is the switch and its word, grown to 44 by the slop every small control takes. Its
// paint is looked up per palette, as the accent is (accent.ts, rule 10.4): each track is the first
// token in its list that reads at 3 to 1 on the page and on a card (so the primary track on, as
// before, wherever it reads), and the thumb is the card, which therefore reads on both tracks. The
// row's title, detail and note are Title 6 and Body 6, as Settings → Notifications drew them.

import type { ColourName, Colours } from '../styles/tokens';
import { blendOver } from '../styles/tokens/colour-read';
import { firstMark, firstMarkColour } from './accent';
import { MIN_TOUCH, hitSlopFor, type HitSlop } from './paint';
import { UI_COPY } from './strings';
import type { TextLevel } from './variants';

/** The row a switch sits in takes no slop: the whole row is the touch target, at least 44 tall. */
export const SWITCH_ROW_MIN_HEIGHT = MIN_TOUCH;
/** The row's title (Title 6), and its detail, note and the switch's word (Body 6). */
export const SWITCH_TITLE_LEVEL: TextLevel = 6;
export const SWITCH_DETAIL_LEVEL: TextLevel = 6;

/** The native switch's size as iOS draws it (UISwitch), in points. */
export const NATIVE_SWITCH_SIZE = Object.freeze({ width: 51, height: 31 });

/** A switch on its own (no row): the slop that grows it to the 44 pt touch target. */
export const SWITCH_SLOP: HitSlop = Object.freeze(
  hitSlopFor(NATIVE_SWITCH_SIZE.height, NATIVE_SWITCH_SIZE.width),
);

/** 'On' or 'Off', beside the switch. */
export function switchWord(on: boolean): string {
  return on ? UI_COPY.switchOn : UI_COPY.switchOff;
}

/** What a press does: the value the switch turns to, or null where it cannot change (disabled). */
export function switchPress(value: boolean, disabled: boolean): boolean | null {
  return disabled ? null : !value;
}

/** A press on the switch or its row: `onChange` hears the new value; a disabled one does nothing. */
export function pressSwitch(
  value: boolean,
  disabled: boolean,
  onChange: (next: boolean) => void,
): void {
  const next = switchPress(value, disabled);
  if (next !== null) onChange(next);
}

export type SwitchAccessibilityState = { readonly checked: boolean; readonly disabled: boolean };

/** What VoiceOver and TalkBack hear the switch as: checked or not, and whether it can change. */
export function switchAccessibilityState(
  value: boolean,
  disabled: boolean,
): SwitchAccessibilityState {
  return { checked: value, disabled };
}

/** The muted lines under a switch row's title: its detail, then its note; blank ones dropped. */
export function switchRowLines(
  detail: string | undefined,
  note: string | null | undefined,
): readonly string[] {
  return [detail, note]
    .map((line) => (typeof line === 'string' ? line.trim() : ''))
    .filter((line) => line !== '');
}

/** A line that already ends in punctuation (a stop, a colon, a comma, a closing quote or bracket). */
const ENDS_PUNCTUATED = /[.!?…:;,)\]}"'”’»]$/;

/**
 * What a screen reader says after a switch row's name: its detail and its note, each ending in a
 * stop unless it already ends in punctuation, so the note (who may change it, why it cannot change
 * yet) is heard though the row is one element. Nothing when both are blank.
 */
export function switchRowHint(
  detail: string | undefined,
  note: string | null | undefined,
): string | undefined {
  const lines = switchRowLines(detail, note);
  if (lines.length === 0) return undefined;
  return lines.map((line) => (ENDS_PUNCTUATED.test(line) ? line : `${line}.`)).join(' ');
}

/** The tokens a switch is painted in, in one palette. */
export type SwitchTokens = Readonly<{
  onTrack: ColourName;
  thumb: ColourName;
  offTrack: ColourName;
}>;

/**
 * What each track is measured against: the page and a card, which a switch sits on, and the card
 * is also the thumb, so a track that reads on a card reads under the thumb too.
 */
const GROUNDS: readonly ColourName[] = ['background', 'card'];
const THUMB: ColourName = 'card';
/** On: the palette's strong ink, else its main ink. */
const ON_TRACKS: readonly ColourName[] = ['primary', 'foreground'];
/** Off, from the quietest: the muted ground, the strong border, the quietest ink, the muted ink. */
const OFF_TRACKS: readonly ColourName[] = ['muted', 'border2', 'fg3', 'mutedForeground'];
/** The main ink reads on the page and on a card in every palette (the contrast test holds it). */
const LAST_RESORT: ColourName = 'foreground';

const found = new WeakMap<Colours, SwitchTokens>();

/** A colour as it shows on the page, so two ways of writing one colour count as one. */
const drawn = (colour: string, page: string) => blendOver(colour, page) ?? colour;

/**
 * The switch's tokens in this palette, decided once per palette object: the first on track that
 * reads at 3 to 1 on the page and on a card (and so under the card's thumb), then the first off
 * track that reads and is not the on track's colour. Past each list, every token of the palette in
 * the shape's order, so the two tracks differ wherever the palette has two colours that read.
 */
export function switchTokens(colours: Colours): SwitchTokens {
  const known = found.get(colours);
  if (known !== undefined) return known;
  const page = colours.background;
  const every = Object.keys(colours) as ColourName[];
  const onTrack = firstMark(colours, [...ON_TRACKS, ...every], GROUNDS, LAST_RESORT);
  const on = drawn(colours[onTrack], page);
  const left = [...OFF_TRACKS, LAST_RESORT, ...every].filter(
    (each) => drawn(colours[each], page) !== on,
  );
  const offTrack = firstMark(colours, left, GROUNDS, LAST_RESORT);
  const tokens: SwitchTokens = Object.freeze({ onTrack, thumb: THUMB, offTrack });
  found.set(colours, tokens);
  return tokens;
}

export type SwitchPaint = {
  readonly trackColor: { readonly false: string; readonly true: string };
  readonly thumbColor: string;
  /** iOS paints the off track from this, not from trackColor.false. */
  readonly iosBackground: string;
};

/** The switch on the tokens switchTokens chose for this palette. */
export function switchPaint(colours: Colours): SwitchPaint {
  const { onTrack, thumb, offTrack } = switchTokens(colours);
  return {
    trackColor: { false: colours[offTrack], true: colours[onTrack] },
    thumbColor: colours[thumb],
    iosBackground: colours[offTrack],
  };
}

/**
 * A style that draws React Native's switch in its own paint (Candy's Motion): its own colours for
 * each track in order, its thumb, the grounds the switch sits on, and an ink that always reads.
 */
export type OwnSwitchColours = Readonly<{
  on: readonly string[];
  off: readonly string[];
  thumb: string;
  grounds: readonly string[];
  fallback: string;
}>;

/**
 * The same rule as switchTokens on a style's own colours: each track the first of its colours that
 * reads at 3 to 1 on every ground (the first of them the page) and under the thumb, the off track
 * never the on track's colour where another reads; else the fallback.
 */
export function ownSwitchPaint(own: OwnSwitchColours): SwitchPaint {
  const under = [...own.grounds, own.thumb];
  const page = own.grounds[0] ?? own.fallback;
  const on = firstMarkColour([...own.on, own.fallback], under, own.fallback);
  const left = [...own.off, own.fallback, ...own.on].filter(
    (each) => drawn(each, page) !== drawn(on, page),
  );
  const off = firstMarkColour(left, under, own.fallback);
  return { trackColor: { false: off, true: on }, thumbColor: own.thumb, iosBackground: off };
}
