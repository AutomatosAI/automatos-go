// The quest log in React (US-022m): the Board's rows from the query the Command Centre's shell
// already makes (boardQuery, so the counters, the party and the map share one cached read and the
// live stream's board_changed refetch; no new endpoint, no fetch outside src/api), with needs-you's
// rows, as quests.ts reads them; loading until the Board first answers, failed (with Try again)
// when it cannot, and the map's own memory of the marker picked.

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { NeedsYouRows } from '../../../api/needs-you';
import { useApiClient } from '../../../app-state/session';
import { boardQuery } from '../../../cc/board/api';
import type { MapSpot } from '../map/world-map';
import { questLog, questSpots, selectedQuest, type Quest, type QuestLog } from './quests';

export type QuestRead =
  | { readonly phase: 'loading' }
  | { readonly phase: 'failed'; readonly retry: () => void }
  | { readonly phase: 'ready'; readonly log: QuestLog };

/** The Board's tickets as quests, once the Board has answered. */
export function useQuestLog(needsYou: NeedsYouRows): QuestRead {
  const client = useApiClient();
  const query = useQuery(boardQuery(client));
  const tasks = query.data?.tasks ?? null;
  const failed = query.isError;
  const { refetch } = query;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);
  return useMemo((): QuestRead => {
    if (tasks !== null) return { phase: 'ready', log: questLog({ board: tasks, needsYou }) };
    return failed ? { phase: 'failed', retry } : { phase: 'loading' };
  }, [tasks, needsYou, failed, retry]);
}

export type QuestPick = {
  readonly selected: Quest | null;
  readonly spots: ReadonlyMap<string, MapSpot>;
  readonly onSelect: (id: number) => void;
};

/** The quest the window shows (the marker picked, else the first that needs you) and each tile. */
export function useQuestPick(quests: readonly Quest[]): QuestPick {
  const [picked, setPicked] = useState<number | null>(null);
  const spots = useMemo(() => questSpots(quests), [quests]);
  const selected = useMemo(() => selectedQuest(quests, picked), [quests, picked]);
  return { selected, spots, onSelect: setPicked };
}
