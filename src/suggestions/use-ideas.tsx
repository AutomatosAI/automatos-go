// The header's count of Auto's suggestions and the sheet it opens (PRD-268 §6.12.5, US-G01), for
// every layout's header: Studio's HomeHeader, Play's PlayHeader and HUD's command row. Nothing where
// discovery does not list `suggestions` or none is open.

import { useCallback, useState, type ReactNode } from 'react';

import { countText } from './model';
import { SUGGESTION_COPY } from './strings';
import { SuggestionsSheet } from './SuggestionsSheet';
import { useOpenSuggestions } from './use-suggestions';

export type IdeasCount = {
  /** 'Ideas · 3', VoiceOver's label and the opener; null when there is nothing to count. */
  readonly button: {
    readonly text: string;
    readonly label: string;
    readonly count: number;
    readonly onPress: () => void;
  } | null;
  /** The sheet, mounted beside the header. */
  readonly sheet: ReactNode;
};

export function useIdeas(): IdeasCount {
  const { offered, open } = useOpenSuggestions();
  const [visible, setVisible] = useState(false);
  const show = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const text = offered ? countText(open.length) : null;
  const button = text
    ? { text, label: SUGGESTION_COPY.countLabel(open.length), count: open.length, onPress: show }
    : null;
  return { button, sheet: offered ? <SuggestionsSheet visible={visible} onClose={close} /> : null };
}
