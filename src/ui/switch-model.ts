// The Switch's logic, pure: its state in a word beside it (§4.6: never only a colour), what
// VoiceOver hears it as, and its paint on the tokens (React Native's own switch: the muted track
// off, the primary track on, a card thumb). SwitchRow's sizes: at least the 44 pt touch target
// tall, its title, detail and note at Title 6 and Body 6, as Settings → Notifications drew them.

import type { Colours } from '../styles/tokens';
import { MIN_TOUCH } from './paint';
import { UI_COPY } from './strings';
import type { TextLevel } from './variants';

/** The row a switch sits in takes no slop: it is a touch target itself. */
export const SWITCH_ROW_MIN_HEIGHT = MIN_TOUCH;
/** The row's title (Title 6), and its detail, note and the switch's word (Body 6). */
export const SWITCH_TITLE_LEVEL: TextLevel = 6;
export const SWITCH_DETAIL_LEVEL: TextLevel = 6;

/** 'On' or 'Off', beside the switch. */
export function switchWord(on: boolean): string {
  return on ? UI_COPY.switchOn : UI_COPY.switchOff;
}

export type SwitchAccessibilityState = { readonly checked: boolean; readonly disabled: boolean };

/** What VoiceOver and TalkBack hear the switch as: checked or not, and whether it can change. */
export function switchAccessibilityState(
  value: boolean,
  disabled: boolean,
): SwitchAccessibilityState {
  return { checked: value, disabled };
}

export type SwitchPaint = {
  readonly trackColor: { readonly false: string; readonly true: string };
  readonly thumbColor: string;
  /** iOS paints the off track from this, not from trackColor.false. */
  readonly iosBackground: string;
};

/** The switch on the tokens: muted off, primary on, the card's colour for the thumb. */
export function switchPaint(colours: Pick<Colours, 'muted' | 'primary' | 'card'>): SwitchPaint {
  return {
    trackColor: { false: colours.muted, true: colours.primary },
    thumbColor: colours.card,
    iosBackground: colours.muted,
  };
}

/** The muted lines under a switch row's title: its detail, then its note; empty ones dropped. */
export function switchRowLines(
  detail: string | undefined,
  note: string | null | undefined,
): readonly string[] {
  return [detail, note].filter((line): line is string => Boolean(line));
}
