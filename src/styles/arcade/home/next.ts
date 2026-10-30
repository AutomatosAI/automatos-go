// Auto's suggestions on Arcade's handheld (PRD-268 §6.12.5, US-G01; D-ARC-7), pure: what sits under
// the status bar. The 'IDEAS · N' chip is the header count every layout shows (use-ideas.tsx's
// button: nothing where discovery does not list `suggestions` or none is open), its words the
// count's and VoiceOver's label the count's own ("Auto's ideas: 3 open. Opens them all"). The NEXT
// line is HUD's NEXT ▸ in Arcade's dress (HudNext's rules): nothing where the feature is not
// offered; 'Started. Auto is on it.' for the 4 s after a Start; else the newest open suggestion, or
// nothing when none is open. A refused Start is one line under it, and VoiceOver hears it with the
// line. Pure: no React, React Native, Expo or Skia.

import { suggestionView, type SuggestionView } from '../../../suggestions/model';
import type { Suggestion } from '../../../suggestions/schema';
import { ARCADE_DRESS_COPY, ARCADE_HOME_COPY } from '../../strings';

/** useIdeas().button, as the chip reads it. */
export type IdeasButton = {
  readonly text: string;
  readonly label: string;
  readonly onPress: () => void;
} | null;

export type IdeasChip = {
  /** 'Ideas · 3' (the button face sets it in capitals). */
  readonly text: string;
  /** VoiceOver's label: the count's own. */
  readonly label: string;
  readonly onPress: () => void;
};

/** The chip under the status bar; null when the header count shows nothing. */
export function ideasChip(button: IdeasButton): IdeasChip | null {
  if (button === null) return null;
  return Object.freeze({ text: button.text, label: button.label, onPress: button.onPress });
}

export type NextFacts = {
  /** Discovery lists `suggestions`. */
  readonly offered: boolean;
  /** The open ones, newest first (useOpenSuggestions). */
  readonly open: readonly Suggestion[];
  /** A Start went through in the last 4 s (useSuggestionActions' started). */
  readonly started: boolean;
};

export type NextShown =
  | { readonly kind: 'none' }
  | { readonly kind: 'started' }
  | { readonly kind: 'next'; readonly view: SuggestionView };

const NONE: NextShown = Object.freeze({ kind: 'none' });
const STARTED: NextShown = Object.freeze({ kind: 'started' });

/** What the NEXT line shows, in HudNext's order. */
export function arcadeNext({ offered, open, started }: NextFacts): NextShown {
  if (!offered) return NONE;
  if (started) return STARTED;
  const newest = open[0];
  return newest ? Object.freeze({ kind: 'next', view: suggestionView(newest) }) : NONE;
}

/** '▶ Next' (the label face sets it in capitals). */
export function nextWord(): string {
  return `${ARCADE_DRESS_COPY.cursor} ${ARCADE_HOME_COPY.next.word}`;
}

/** What VoiceOver hears of the line: 'Next: <title>', and a refused Start's line after it. */
export function nextLabel(view: Pick<SuggestionView, 'title'>, refused: string | null): string {
  const label = ARCADE_HOME_COPY.next.label(view.title);
  return refused ? `${label}. ${refused}` : label;
}

/** The refusal under this suggestion, if its Start was refused. */
export function refusalFor(
  refusal: { readonly id: string; readonly text: string } | null,
  id: string,
): string | null {
  return refusal?.id === id ? refusal.text : null;
}
