// The gallery's hooks: they read the chosen filter's pages, the clock and the phone's timezone, and
// hand them to gallery.ts (pure). The types the pills offer are remembered across filters, so
// choosing one never takes the others away. 'Load more' asks for the next page once at a time; a
// failure says why in the app's one toast, in the taxonomy's words, and the list keeps what it had.
// Nothing polls and no stream is opened (D-LIVE): a pull refetches the loaded pages.

import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { userMessage } from '../../api/errors';
import { useAppSession } from '../../app-state/session';
import { useToast } from '../../ui';
import { useMinuteClock, usePhoneTimeZone } from '../shell/use-shell';
import { usePullRefresh } from '../use-pull-refresh';
import { galleryQuery } from './api';
import {
  galleryView,
  mergePages,
  withTypes,
  type DeliverablePage,
  type GalleryFilter,
} from './gallery';

/** The types seen so far, kept while the tab is open; the list grows as pages bring new ones. */
function useKnownTypes(pages: readonly DeliverablePage[] | null): readonly string[] {
  const [known, setKnown] = useState<readonly string[]>([]);
  const next = pages ? withTypes(known, mergePages(pages)) : known;
  if (next !== known) setKnown(next);
  return next;
}

type NextPage = {
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly fetchNextPage: () => Promise<{ readonly error: unknown }>;
};

export type LoadMore = { readonly busy: boolean; readonly load: () => void };

function useLoadMore({ hasNextPage, isFetchingNextPage, fetchNextPage }: NextPage): LoadMore {
  const toast = useToast();
  const load = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    fetchNextPage()
      .then((result) => {
        if (result.error) toast.show(userMessage(result.error));
      })
      .catch((error: unknown) => toast.show(userMessage(error)));
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, toast]);
  return { busy: isFetchingNextPage, load };
}

export function useGallery() {
  const { client, workspace } = useAppSession();
  const [chosen, setChosen] = useState<GalleryFilter>(null);
  const query = useInfiniteQuery(galleryQuery(client, workspace.id, chosen));
  const pull = usePullRefresh(query.refetch);
  const loadMore = useLoadMore(query);
  const pages = query.data?.pages ?? null;
  const known = useKnownTypes(pages);
  const now = useMinuteClock();
  const timeZone = usePhoneTimeZone();
  const view = useMemo(
    () => galleryView({ pages, chosen, known, clock: { now, timeZone } }),
    [pages, chosen, known, now, timeZone],
  );
  return { query, view, pull, loadMore, choose: setChosen };
}

export type Gallery = ReturnType<typeof useGallery>;
