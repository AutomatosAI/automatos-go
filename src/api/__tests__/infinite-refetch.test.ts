// The out-of-date line on a paged list (rule 6.4) reads the infinite query's isRefetchError: Older
// chats (useChatHistory, shared by Studio's Chats and Play's Conversations) and the Deliverables
// gallery. A failed "load more" has its own footer and Try again, so it must not also say the
// whole list may be out of date. The installed TanStack query (5.104.5) already leaves a failed
// next page out of isRefetchError (infiniteQueryObserver: isRefetchError && !isFetchNextPageError
// && !isFetchPreviousPageError). This runs a real observer in node and pins that, so an upgrade
// that changed it fails here first.

import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { readRepoFile } from '../../release/__tests__/support/tree';

type Page = { readonly page: number };

const FIRST_PAGE = 0;

/** A paged list whose first page and whose later pages can each be made to fail. */
function pagedList(client: QueryClient) {
  const failing = { first: false, next: false };
  const observer = new InfiniteQueryObserver<Page, Error, { pages: Page[] }, string[], number>(
    client,
    {
      queryKey: ['paged'],
      queryFn: ({ pageParam }) => {
        const fails = pageParam === FIRST_PAGE ? failing.first : failing.next;
        return fails ? Promise.reject(new Error('down')) : Promise.resolve({ page: pageParam });
      },
      initialPageParam: FIRST_PAGE,
      getNextPageParam: (last) => last.page + 1,
    },
  );
  return { failing, observer };
}

let client: QueryClient | null = null;

afterEach(() => {
  client?.clear();
  client = null;
});

function newClient(): QueryClient {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return client;
}

describe('a paged list whose pages are held', () => {
  it('a failed next page is the footer’s failure, not a failed refresh of the list', async () => {
    const { failing, observer } = pagedList(newClient());
    expect((await observer.refetch()).data?.pages).toHaveLength(1);
    failing.next = true;
    const more = await observer.fetchNextPage();
    expect(more.isError).toBe(true);
    expect(more.isFetchNextPageError).toBe(true);
    expect(more.isRefetchError).toBe(false);
    expect(more.data?.pages).toHaveLength(1);
  });

  it('a failed refresh of what it holds is a refetch error, with the pages kept', async () => {
    const { failing, observer } = pagedList(newClient());
    await observer.refetch();
    failing.first = true;
    await observer.refetch();
    // refetch answers the base result; the infinite flags are on the observer's own
    const again = observer.getCurrentResult();
    expect(again.isRefetchError).toBe(true);
    expect(again.isFetchNextPageError).toBe(false);
    expect(again.data?.pages).toHaveLength(1);
  });

  it('a refresh that fails after a failed next page is a refetch error again', async () => {
    const { failing, observer } = pagedList(newClient());
    await observer.refetch();
    failing.next = true;
    await observer.fetchNextPage();
    failing.first = true;
    await observer.refetch();
    const again = observer.getCurrentResult();
    expect(again.isRefetchError).toBe(true);
    expect(again.isFetchNextPageError).toBe(false);
  });
});

describe('the paged lists read that flag from their infinite query', () => {
  it('Older chats (Studio and Play) and the Deliverables gallery', () => {
    const history = readRepoFile('src/chat/history/use-history.ts');
    expect(history).toContain('const query = useInfiniteQuery({');
    expect(history).toContain('isRefetchError: query.isRefetchError,');
    expect(readRepoFile('src/cc/deliverables/use-gallery.ts')).toContain(
      'const query = useInfiniteQuery(galleryQuery(client, workspace.id, chosen));',
    );
    expect(readRepoFile('src/cc/deliverables/DeliverablesTab.tsx')).toContain(
      'gallery.query.isRefetchError',
    );
  });
});
