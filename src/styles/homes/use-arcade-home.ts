// Arcade's home in React (US-022g): the wiring arcade-home.ts and arcade-story.ts decide for. The
// counters read numbers the app already fetches (needs-you's one number, the Board's query the
// Command Centre makes; no new endpoint, no fetch outside src/api); the party (US-022l, party.ts)
// is the chat's agents read (its own query, GET /api/chat/agents) with needs-you's rows and the
// same Board query; the dialogue remembers which turns typed on this screen (withTyped, as useShelf
// remembers the Deliverables); the D-pad switches the handheld's screen (the chat or the Quests
// map, US-022m) or pushes the routes padAction names; TYPE's sheet is the
// composer, so opening it is Auto's composer focus (typingEvent) and closing it the blur; a sprite
// has no clip boundary, so a one-shot (hello, celebrate) ends on its timer (turn-state.ts
// oneShotEndMs); the story is A2's rows with the Deliverables this conversation made placed in
// them (shelf.ts), A2's Try again, cards and links.

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { NeedsYouRows } from '../../api/needs-you';
import { useApiClient } from '../../app-state/session';
import { useFollowLink, type FollowLink } from '../../chat/components/follow-link';
import type { SettleCard } from '../../chat/cards/model';
import { reportTarget, type ThreadReport } from '../../chat/report/report';
import type { ChatFile } from '../../chat/request';
import { agentsQuery } from '../../chat/api';
import { LIVE_AUTO_KEY, retryInput, threadRows } from '../../chat/view-model';
import { boardQuery } from '../../cc/board/api';
import type { ThreadState } from '../../chat/controller/thread';
import type { ThreadView } from '../../chat/controller/use-thread';
import { partyOf, type PartyMember } from '../arcade/home/party';
import type { CounterValues } from '../arcade/parts/counters';
import type { DPadId } from '../arcade/parts/pad-grid';
import { oneShotEndMs, oneShotEnded, portraitState, typingEvent } from '../arcade/sprite/turn-state';
import type { MascotController } from '../mascot/use-mascot';
import {
  arcadeCounters,
  dialogueSay,
  padAction,
  withTyped,
  type DialogueSay,
  type HandheldScreen,
} from './arcade-home';
import { sayingRowKey, storyEntries, type StoryEntry } from './arcade-story';
import { placeReports } from './shelf';
import type { HomeThread } from './use-home-thread';
import { useShelf } from './use-play-home';

/** XP, ! and QUEST from what the app already has: `needs` is needs-you's total once served. */
export function useArcadeCounters(needs: number | null): CounterValues {
  const client = useApiClient();
  const board = useQuery(boardQuery(client)).data?.tasks ?? null;
  return useMemo(() => arcadeCounters({ needs, board }), [needs, board]);
}

/** The party under the status bar: the chat's agents, each in its state; none before the read. */
export function useArcadeParty(needsYou: NeedsYouRows): readonly PartyMember[] {
  const client = useApiClient();
  const agents = useQuery(agentsQuery(client)).data ?? null;
  const board = useQuery(boardQuery(client)).data?.tasks ?? null;
  return useMemo(() => partyOf({ agents, needsYou, board }), [agents, needsYou, board]);
}

/** What the dialogue says, remembering the turns this screen saw live. */
export function useDialogueSay(state: ThreadState): DialogueSay {
  const [typed, setTyped] = useState<ReadonlySet<string>>(() => withTyped(new Set(), state));
  useEffect(() => {
    setTyped((current) => withTyped(current, state));
  }, [state]);
  return useMemo(() => dialogueSay(state, withTyped(typed, state)), [state, typed]);
}

/** A one-shot the portrait shows ends after ONE_SHOT_MS, as a clip's end would. */
export function useOneShotEnd(mascot: MascotController): void {
  const state = portraitState(mascot.driver.mascot);
  const { send } = mascot;
  useEffect(() => {
    const wait = oneShotEndMs(state);
    if (wait === null) return undefined;
    const timer = setTimeout(() => send(oneShotEnded(state)), wait);
    return () => clearTimeout(timer);
  }, [state, send]);
}

export type ArcadeHandheld = {
  /** What the handheld's screen shows. */
  readonly screen: HandheldScreen;
  /** A D-pad press: Quests, the bag or the chat in the screen, the menu, or home. */
  readonly onPad: (id: DPadId) => void;
  /** Shows the chat again (GO TO CHAT on a quiet map or an empty bag). */
  readonly showChat: () => void;
};

/** The handheld's screen and the D-pad over it; the chat first. */
export function useHandheld(openMenu: () => void): ArcadeHandheld {
  const [screen, setScreen] = useState<HandheldScreen>('chat');
  const router = useRouter();
  const pathname = usePathname();
  const onPad = useCallback(
    (id: DPadId) => {
      const action = padAction(id, pathname, screen);
      if (action.kind === 'screen') setScreen(action.screen);
      else if (action.kind === 'home') router.dismissTo(action.route);
      else if (action.kind === 'menu') openMenu();
    },
    [router, pathname, screen, openMenu],
  );
  const showChat = useCallback(() => setScreen('chat'), []);
  return { screen, onPad, showChat };
}

export type ArcadeComposer = {
  readonly visible: boolean;
  readonly open: () => void;
  readonly close: () => void;
  /** A2's send; the voice hears it was typed, and the sheet closes. */
  readonly onSend: (text: string, ready: readonly ChatFile[]) => void;
};

/** TYPE's sheet: A2's composer, Auto listening while it is open. */
export function useArcadeComposer(home: HomeThread, typed: () => void): ArcadeComposer {
  const [visible, setVisible] = useState(false);
  const { sendMessage, mascot } = home;
  const { send } = mascot;
  const show = useCallback(
    (shown: boolean) => {
      setVisible(shown);
      send(typingEvent(shown));
    },
    [send],
  );
  const open = useCallback(() => show(true), [show]);
  const close = useCallback(() => show(false), [show]);
  const onSend = useCallback(
    (text: string, ready: readonly ChatFile[]) => {
      sendMessage(text, ready);
      typed();
      show(false);
    },
    [sendMessage, typed, show],
  );
  return { visible, open, close, onSend };
}

export type ArcadeStory = {
  readonly entries: readonly StoryEntry[];
  readonly onRetry: () => void;
  readonly onCard: SettleCard;
  readonly onLink: FollowLink;
  /** Report this on the reply the dialogue window says; undefined where it is not offered. */
  readonly sayingReport: (() => void) | undefined;
};

/**
 * Try again as one function for the screen's life, asking the newest state's last message again
 * (A2's MessageList): the memoised entries then hold while a reply streams.
 */
function useTryAgain(state: ThreadState, send: ThreadView['send']): () => void {
  const latest = useRef(state);
  useLayoutEffect(() => {
    latest.current = state;
  });
  return useCallback(() => {
    const again = retryInput(latest.current);
    if (again) send(again);
  }, [send]);
}

/** The story window's entries and handlers over the home's thread. */
export function useArcadeStory(home: HomeThread, report: ThreadReport): ArcadeStory {
  const { state, send, settleCard } = home.thread;
  const onLink = useFollowLink();
  const shelf = useShelf(state);
  const rows = useMemo(() => threadRows(state), [state]);
  const sayingKey = sayingRowKey(rows);
  const entries = useMemo(() => {
    const places = placeReports(shelf, state, LIVE_AUTO_KEY, new Set(rows.map((row) => row.key)));
    return storyEntries(rows, places, sayingKey);
  }, [shelf, state, rows, sayingKey]);
  const onRetry = useTryAgain(state, send);
  const saying = rows.find((row) => row.key === sayingKey);
  const target = saying ? reportTarget(saying, report.allowed) : null;
  // by its id: reportTarget makes a new object each time, the handler stays while the id does
  const targetId = target?.target_id ?? null;
  const { open } = report;
  const sayingReport = useMemo(
    () =>
      targetId === null ? undefined : () => open({ target_type: 'message', target_id: targetId }),
    [targetId, open],
  );
  return { entries, onRetry, onCard: settleCard, onLink, sayingReport };
}
