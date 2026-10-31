// A suggestion's post in the Auto thread (PRD-268 §6.5.1, §6.12.5; US-G01 'the Auto-thread card is
// drawn from source.suggestion_id'): the thread's 'suggestion' row (src/chat/suggestion-row.ts)
// drawn as the suggestion's card (SuggestionCard: 'Auto suggests', the title, the why, what Start
// does, Start behind Face ID and Hide with its reasons) while the open list has it, from the list,
// so its state is the live one; 'Started. Auto is on it.' in its place for 4 s after a Start from
// it; else the message's own text (`fallback`, the layout's Auto row), which is also what the post
// the pinned card above the composer shows draws (model.ts threadSuggestionShown). Layout-neutral:
// the layout hands in its row for the text and, if it wants one, a frame for the card (Studio's
// Auto column). No cost or credit is shown (D8).

import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import { suggestionView, threadSuggestionShown } from './model';
import { StartedLine, SuggestionCard } from './SuggestionCard';
import { SUGGESTION_COPY } from './strings';
import { useOpenSuggestions, useSuggestionActions } from './use-suggestions';

export type ThreadSuggestionProps = {
  readonly suggestionId: string;
  /** The message as the layout draws Auto's row: shown whenever the card is not. */
  readonly fallback: ReactNode;
  /** The layout's frame around the card (Studio: Auto's column); none, the card as it is. */
  readonly frame?: (card: ReactNode) => ReactNode;
};

const AS_IS = (card: ReactNode) => card;

export function ThreadSuggestion({ suggestionId, fallback, frame = AS_IS }: ThreadSuggestionProps) {
  const { open } = useOpenSuggestions();
  const actions = useSuggestionActions();
  const started = actions.started?.id ?? null;
  useEffect(() => {
    if (started === suggestionId)
      AccessibilityInfo.announceForAccessibility(SUGGESTION_COPY.started);
  }, [started, suggestionId]);
  const shown = threadSuggestionShown(open, suggestionId, started);
  if (shown.kind === 'started') return <>{frame(<StartedLine />)}</>;
  if (shown.kind === 'text') return <>{fallback}</>;
  return <>{frame(<SuggestionCard view={suggestionView(shown.suggestion)} actions={actions} />)}</>;
}
