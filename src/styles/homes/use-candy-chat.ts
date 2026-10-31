// Candy's Chat view in React (US-023h): the wiring candy/home/chat.ts and composer.ts decide for,
// over the home's one thread (useHomeThread). The entries are A2's rows with the Deliverables this
// conversation made placed in them (shelf.ts, as Play's and Arcade's homes place them), A2's Try
// again, cards and links; the stage's title is the chat's own from A2's check, read from its cache
// and never fetched again (usePlayTitle's way); its back circle goes where stageBack says; the
// message box is Play's composer model over A2's composerState and the home's sendMessage
// (usePlayComposer), a send makes the thread's turn the newest for the voice (typed()), and Auto
// listens while the box has the keyboard (its focus is his 'input-focus', as Arcade's TYPE sheet).

import { skipToken, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { queryKeys } from '../../api/query-keys';
import type { SettleCard } from '../../chat/cards/model';
import { useFollowLink, type FollowLink } from '../../chat/components/follow-link';
import type { ThreadState } from '../../chat/controller/thread';
import type { ChatThread } from '../../chat/schemas';
import { LIVE_AUTO_KEY, threadRows } from '../../chat/view-model';
import { routes } from '../../navigation/routes';
import { typingEvent } from '../arcade/sprite/turn-state';
import { chatEntries, chatTitle, stageBack, type ChatEntry } from '../candy/home/chat';
import { placeReports } from './shelf';
import { useTryAgain } from './use-arcade-home';
import type { HomeThread } from './use-home-thread';
import { usePlayComposer, useShelf, type PlayComposerModel } from './use-play-home';

export type CandyChat = {
  readonly entries: readonly ChatEntry[];
  readonly onRetry: () => void;
  readonly onCard: SettleCard;
  readonly onLink: FollowLink;
};

/** The Chat view's entries and handlers over the home's thread. */
export function useCandyChat(home: HomeThread): CandyChat {
  const { state, send, settleCard } = home.thread;
  const onLink = useFollowLink();
  const shelf = useShelf(state);
  const rows = useMemo(() => threadRows(state), [state]);
  const entries = useMemo(() => {
    const places = placeReports(shelf, state, LIVE_AUTO_KEY, new Set(rows.map((row) => row.key)));
    return chatEntries(rows, places);
  }, [shelf, state, rows]);
  const onRetry = useTryAgain(state, send);
  return { entries, onRetry, onCard: settleCard, onLink };
}

/** The stage's title: the chat's own once A2's check cached it, never a second fetch. */
export function useChatTitle(state: Pick<ThreadState, 'chatId'>): string {
  const { chatId } = state;
  const checked = useQuery<ChatThread | null>({
    queryKey: queryKeys.chat.thread(chatId ?? ''),
    queryFn: skipToken,
  });
  return chatTitle(state, checked.data);
}

/** The back circle: the conversation route's Back, Today in place on the home, else the home. */
export function useStageBack(showToday: () => void, onBack?: () => void): () => void {
  const router = useRouter();
  const onHome = usePathname() === routes.home;
  const goes = stageBack(onHome, onBack !== undefined);
  return useCallback(() => {
    if (goes === 'onBack') onBack?.();
    else if (goes === 'today') showToday();
    else router.dismissTo(routes.home);
  }, [goes, onBack, showToday, router]);
}

export type CandyComposerModel = PlayComposerModel & {
  /** The box takes the keyboard, or lets it go: Auto listens while it has it. */
  readonly onFocus: () => void;
  readonly onBlur: () => void;
};

/** The message box: Play's model over A2's composerState; a send tells the voice it was typed. */
export function useCandyComposer(home: HomeThread, typed: () => void): CandyComposerModel {
  const composer = usePlayComposer(home);
  const { send: sendTyped, state } = composer;
  const sends = state.buttonMode === 'send';
  const send = useCallback(() => {
    if (!sends) return;
    sendTyped();
    typed();
  }, [sends, sendTyped, typed]);
  const { send: tell } = home.mascot;
  const onFocus = useCallback(() => tell(typingEvent(true)), [tell]);
  const onBlur = useCallback(() => tell(typingEvent(false)), [tell]);
  return { ...composer, send, onFocus, onBlur };
}
