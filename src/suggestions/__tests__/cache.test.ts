import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { OPEN_KEY, putBack, takeOff } from '../cache';
import { suggestion } from './fixtures';

describe('the open list in the cache', () => {
  it('takes a started or hidden suggestion off at once, and a failed Hide puts it back', () => {
    const queryClient = new QueryClient();
    const list = [suggestion('a'), suggestion('b')];
    queryClient.setQueryData(OPEN_KEY, list);
    const previous = takeOff(queryClient, 'a');
    expect(queryClient.getQueryData<typeof list>(OPEN_KEY)?.map((each) => each.id)).toEqual(['b']);
    putBack(queryClient, previous);
    expect(queryClient.getQueryData(OPEN_KEY)).toEqual(list);
  });

  it('leaves an empty cache empty', () => {
    const queryClient = new QueryClient();
    expect(takeOff(queryClient, 'a')).toBeUndefined();
    putBack(queryClient, undefined);
    expect(queryClient.getQueryData(OPEN_KEY)).toBeUndefined();
  });
});
