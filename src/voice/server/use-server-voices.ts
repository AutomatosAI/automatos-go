// The server's voices on a screen (27 Oct 2026): the session's server and client (useAppSession),
// the list read through the one cache (server-voices.ts). Off when the server lists no tts; quick-
// ask reads the kept list, Settings → Voice reads it afresh when it opens (fresh). Only wiring.

import { useEffect, useState } from 'react';

import { canServerVoice } from '../../api/capabilities';
import { useAppSession } from '../../app-state/session';
import {
  VOICES_LOADING,
  VOICES_OFF,
  VOICES_UNAVAILABLE,
  createVoicesCache,
  voicesReady,
  type ServerVoicesState,
} from './server-voices';

/** The app's one list of server voices, kept per server for the launch. */
export const serverVoices = createVoicesCache();

export function useServerVoices(fresh = false): ServerVoicesState {
  const { discovery, client } = useAppSession();
  const offered = canServerVoice(discovery);
  const [state, setState] = useState<ServerVoicesState>(VOICES_LOADING);
  useEffect(() => {
    if (!offered) return undefined;
    let alive = true;
    serverVoices.get(client, fresh).then((list) => {
      if (alive) setState(list === null ? VOICES_UNAVAILABLE : voicesReady(list));
    });
    return () => {
      alive = false;
    };
  }, [offered, client, fresh]);
  return offered ? state : VOICES_OFF;
}
