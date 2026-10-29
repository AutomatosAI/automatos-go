// The open list in the cache (memory only): Start and Hide take a suggestion off it at once, so no
// surface offers it again while the server answers; a Hide that fails puts the list back as it was.

import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/query-keys';
import { withoutSuggestion } from './model';
import type { Suggestion } from './schema';

export const OPEN_KEY = queryKeys.suggestions('open');

/** Takes a suggestion off the cached list; returns the list as it was, for a rollback. */
export function takeOff(
  queryClient: Pick<QueryClient, 'getQueryData' | 'setQueryData'>,
  id: string,
): readonly Suggestion[] | undefined {
  const previous = queryClient.getQueryData<readonly Suggestion[]>(OPEN_KEY);
  queryClient.setQueryData<readonly Suggestion[]>(OPEN_KEY, (list) => withoutSuggestion(list, id));
  return previous;
}

/** Puts the list back as it was before a failed Hide. */
export function putBack(
  queryClient: Pick<QueryClient, 'setQueryData'>,
  previous: readonly Suggestion[] | undefined,
): void {
  if (previous) queryClient.setQueryData(OPEN_KEY, previous);
}
