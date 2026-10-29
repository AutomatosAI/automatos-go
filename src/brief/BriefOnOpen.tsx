// The brief on open, wired (PRD-268 §6.4, US-G06; the rules are on-open.ts's): mounted once under
// the signed-in gate (app/(app)/_layout.tsx), it calls the brief route when the session is ready and
// on every return to the foreground, and on-open.ts lets one call a day through per workspace. Only
// when discovery lists `brief` (canBrief): an older server sees no call at all. Once the day's
// message is there, the history and that chat's messages are read again, so home's thread, the
// Auto thread, shows the brief without waiting for the live event. Draws nothing.

import { useQueryClient } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';
import { useEffect, useMemo } from 'react';

import { canBrief } from '../api/capabilities';
import { matchesFamily, queryKeys } from '../api/query-keys';
import { useAppSession } from '../app-state/session';
import { onForegroundReturn } from '../styles/sync/foreground';
import { openBrief } from './api';
import { createBriefOpener } from './on-open';
import type { BriefOpen } from './schema';

/** The phone's IANA zone as it is now (expo-localization), or null when it reports none. */
function phoneTimeZone(): string | null {
  return getCalendars()[0]?.timeZone ?? null;
}

export function BriefOnOpen() {
  const { client, discovery, server, workspace } = useAppSession();
  const queryClient = useQueryClient();
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
        },
      }),
    [client, queryClient],
  );
  useEffect(() => {
    if (!offered) return undefined;
    void opener.foreground(scope);
    return onForegroundReturn(() => void opener.foreground(scope));
  }, [offered, opener, scope]);
  return null;
}
