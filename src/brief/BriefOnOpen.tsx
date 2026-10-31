// The brief on open, wired (PRD-268 §6.4, US-G06; the rules are on-open.ts's): mounted once under
// the signed-in gate (app/(app)/_layout.tsx), it calls the brief route when the session is ready and
// on every return to the foreground, and on-open.ts lets one call a day through per workspace. Only
// when discovery lists `brief` (canBrief): an older server sees no call at all. Once the day's
// message is there, the history and that chat's messages are read again, so home's thread, the
// Auto thread, shows the brief without waiting for the live event. Then the Auto thread opens at
// the brief (US-G03, src/chat/focus.ts briefOpenStep): a thread on screen that shows its chat
// scrolls there; else, on home in a layout with a thread (Studio, Play), the chat route opens at it
// (routes.chatAt); anywhere else nothing moves. Draws nothing.

import { useQueryClient } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { canBrief } from '../api/capabilities';
import { matchesFamily, queryKeys } from '../api/query-keys';
import { useAppSession } from '../app-state/session';
import { briefOpenStep, focusTargetOf, threadFocus } from '../chat/focus';
import { routes } from '../navigation/routes';
import { homeFor } from '../styles/homes/layout';
import { useStyle } from '../styles/theme';
import { onForegroundReturn } from '../styles/sync/foreground';
import { openBrief } from './api';
import { createBriefOpener } from './on-open';
import type { BriefOpen } from './schema';

/** The phone's IANA zone as it is now (expo-localization), or null when it reports none. */
function phoneTimeZone(): string | null {
  return getCalendars()[0]?.timeZone ?? null;
}

/** The layouts whose home draws a thread to open at the brief (HUD's and Arcade's draw none). */
const THREAD_HOMES: ReadonlySet<string> = new Set(['studio', 'play']);

/** Opens the Auto thread at the day's brief (US-G03), reading where the person is when it answers. */
function useOpenAtBrief(): (answer: BriefOpen) => void {
  const router = useRouter();
  const pathname = usePathname();
  const kind = homeFor(useStyle().layout);
  // read when the answer lands, not when the call went out; one callback for the opener's life
  const where = useRef({ router, pathname, kind });
  useEffect(() => {
    where.current = { router, pathname, kind };
  }, [router, pathname, kind]);
  return useCallback((answer: BriefOpen) => {
    const target = focusTargetOf(answer);
    if (!target) return;
    const now = where.current;
    const step = briefOpenStep({
      shown: threadFocus.request(target),
      onHome: now.pathname === routes.home,
      threadLayout: THREAD_HOMES.has(now.kind),
    });
    if (step === 'open') now.router.push(routes.chatAt(target.chatId, target.messageId));
  }, []);
}

export function BriefOnOpen() {
  const { client, discovery, server, workspace } = useAppSession();
  const queryClient = useQueryClient();
  const openAtBrief = useOpenAtBrief();
  const offered = canBrief(discovery);
  const scope = `${server.apiUrl}\n${workspace.id}`;
  const opener = useMemo(
    () =>
      createBriefOpener({
        open: (body) => openBrief(client, body),
        now: () => new Date(),
        timeZone: phoneTimeZone,
        onAnswered: (answer: BriefOpen) => {
          void queryClient.invalidateQueries({
            predicate: (query) => matchesFamily('chat.history', query.queryKey),
          });
          if (answer.chat_id)
            void queryClient.invalidateQueries({
              queryKey: queryKeys.chat.messages(answer.chat_id),
            });
          openAtBrief(answer);
        },
      }),
    [client, queryClient, openAtBrief],
  );
  useEffect(() => {
    if (!offered) return undefined;
    void opener.foreground(scope);
    return onForegroundReturn(() => void opener.foreground(scope));
  }, [offered, opener, scope]);
  return null;
}
