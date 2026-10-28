// The server's voices on a screen (27 Oct 2026): the session's server and client (useAppSession),
// the list read through the one cache (server-voices.ts). Off when the server lists no tts; quick-
// ask reads the kept list, Settings → Voice reads it afresh when it opens (fresh). A read that
// fails is read again until the list loads (watchServerVoices). Only wiring.

import { useEffect, useState } from 'react';

import { canServerVoice } from '../../api/capabilities';
import { useAppSession } from '../../app-state/session';
import {
  VOICES_LOADING,
  VOICES_OFF,
  createVoicesCache,
  watchServerVoices,
  type ServerVoicesState,
} from './server-voices';

/** The app's one list of server voices, kept per server for the launch. */
export const serverVoices = createVoicesCache();

function later(run: () => void, ms: number): () => void {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
}

export function useServerVoices(fresh = false): ServerVoicesState {
  const { discovery, client } = useAppSession();
  const offered = canServerVoice(discovery);
  const [state, setState] = useState<ServerVoicesState>(VOICES_LOADING);
  useEffect(() => {
    if (!offered) return undefined;
    return watchServerVoices({ cache: serverVoices, client, fresh, onState: setState, later });
  }, [offered, client, fresh]);
  return offered ? state : VOICES_OFF;
}
