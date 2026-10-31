// A suggestion's post in the Auto thread as a row of its own (PRD-268 §6.5.1, §6.11.2, §6.12.5), pure.
// core posts each suggestion it delivers as Auto's message with source {origin 'suggestion',
// suggestion_id} and parts [text, {type 'suggestion@1', suggestion_id}]; where the caller says the
// thread draws suggestions (view-model.ts ViewOptions.suggestions), that message is a 'suggestion'
// row: the suggestion's id, and the message as the Auto row it is otherwise (`text`). The layout
// draws the suggestion's card (src/suggestions/ThreadSuggestion.tsx) while the open list has it,
// and `text` when it does not (an unknown, decided or expired suggestion), so the card's state is
// always the live one and never comes from the thread. The id is the part's own, else the source's.

import { isUsableId } from '../navigation/routes';
import { SUGGESTION_ORIGIN } from '../suggestions/schema';
import type { StoredMessage } from './schemas';
import type { AutoRow } from './view-model';

/** One of Auto's suggestions posted in the thread (ViewOptions.suggestions). */
export type ThreadSuggestionRow = {
  readonly type: 'suggestion';
  /** The message's id, as its Auto row's key. */
  readonly key: string;
  readonly messageId: string;
  /** The suggestion it delivered: its card is drawn from the open list by this id. */
  readonly suggestionId: string;
  /** The message as Auto's row (its text, Report this): drawn whenever the card is not. */
  readonly text: AutoRow;
};

function idOf(value: string | null | undefined): string | null {
  const id = value?.trim();
  return id && isUsableId(id) ? id : null;
}

/** The suggestion an Auto message delivered: its suggestion@1 part's id, else source.suggestion_id. */
export function threadSuggestionId(
  message: Pick<StoredMessage, 'role' | 'structured' | 'source'>,
): string | null {
  if (message.role !== 'assistant') return null;
  const part = message.structured?.find((each) => each.type === 'suggestion@1');
  if (part?.type !== 'suggestion@1') return null;
  const fromSource =
    message.source?.origin === SUGGESTION_ORIGIN ? idOf(message.source.suggestion_id) : null;
  return idOf(part.suggestion_id) ?? fromSource;
}

/** The message's row as a suggestion row; null for a message that delivered none. */
export function suggestionRowOf(
  message: Pick<StoredMessage, 'id' | 'role' | 'structured' | 'source'>,
  text: AutoRow,
): ThreadSuggestionRow | null {
  const suggestionId = threadSuggestionId(message);
  if (suggestionId === null) return null;
  return Object.freeze({
    type: 'suggestion',
    key: text.key,
    messageId: message.id,
    suggestionId,
    text,
  });
}
