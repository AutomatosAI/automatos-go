// Which server voice quick-ask asks for, and the server's list of them (27 Oct 2026). Pure: no
// React, React Native or Expo (use-server-voices.ts reads the list on a screen).
//   The list (GET /api/voice/voices) is read once per server per launch and kept; a read that
//   fails (a 503 when the server has no voice, the network) is not kept, so the next one tries
//   again. Settings → Voice reads it afresh when it opens.
//   serverSpeechFor: Auto's server voice only when the server lists tts and the person has not
//   chosen this phone's voice; otherwise undefined, and the phone's voice speaks exactly as before.
//   The voice asked for is the saved one while the list offers it, else null (the server's
//   default): a voice the server dropped never earns a refusal on every turn. While the list is not
//   known, the saved one is asked for.

import type { ApiClient } from '../../api/client';
import { canServerVoice, type GateInput } from '../../api/capabilities';
import { logger } from '../../lib/logger';
import type { VoiceSetting } from '../settings/voice-setting';
import type { ServerSpeech } from './server-speaker-ports';
import { fetchServerVoices, type ServerVoiceList } from './voice-api';

export type ServerVoicesState =
  /** The server lists no tts: no server voice at all. */
  | { readonly kind: 'off' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly list: ServerVoiceList }
  /** The list did not load: the server's default voice may still speak. */
  | { readonly kind: 'unavailable' };

export const VOICES_OFF: ServerVoicesState = Object.freeze({ kind: 'off' });
export const VOICES_LOADING: ServerVoicesState = Object.freeze({ kind: 'loading' });
export const VOICES_UNAVAILABLE: ServerVoicesState = Object.freeze({ kind: 'unavailable' });

export function voicesReady(list: ServerVoiceList): ServerVoicesState {
  return Object.freeze({ kind: 'ready', list });
}

export type VoicesClient = Pick<ApiClient, 'server' | 'request'>;

export type VoicesCache = {
  /** The server's list, or null when it did not load; `fresh` reads it again. */
  readonly get: (client: VoicesClient, fresh?: boolean) => Promise<ServerVoiceList | null>;
};

type Loader = (client: VoicesClient) => Promise<ServerVoiceList>;

async function loadOrNull(load: Loader, client: VoicesClient): Promise<ServerVoiceList | null> {
  try {
    return await load(client);
  } catch (error) {
    logger.warn("[voice] the server's voices did not load", error);
    return null;
  }
}

/** One list per server (by its API URL); a failed read is dropped so the next get tries again. */
export function createVoicesCache(load: Loader = fetchServerVoices): VoicesCache {
  let lists: ReadonlyMap<string, Promise<ServerVoiceList | null>> = new Map();
  const forget = (key: string): void => {
    lists = new Map([...lists].filter(([held]) => held !== key));
  };
  return Object.freeze({
    get: (client: VoicesClient, fresh = false) => {
      const key = client.server.apiUrl;
      const held = fresh ? undefined : lists.get(key);
      if (held) return held;
      const read = loadOrNull(load, client).then((list) => {
        if (list === null) forget(key);
        return list;
      });
      lists = new Map([...lists, [key, read]]);
      return read;
    },
  });
}

/** The saved voice while the server's list offers it, else null (the server's default). */
export function resolveServerVoice(saved: string | null, voices: ServerVoicesState): string | null {
  if (saved === null || voices.kind !== 'ready') return saved;
  return voices.list.voices.some((voice) => voice.id === saved) ? saved : null;
}

export type ServerSpeechInput = {
  readonly discovery: GateInput;
  readonly setting: VoiceSetting;
  readonly voices: ServerVoicesState;
  readonly client: Pick<ApiClient, 'binary'>;
};

/** Auto's server voice when the server lists tts and the person keeps it; else undefined. */
export function serverSpeechFor({
  discovery,
  setting,
  voices,
  client,
}: ServerSpeechInput): ServerSpeech | undefined {
  if (!canServerVoice(discovery) || setting.source === 'phone') return undefined;
  return Object.freeze({
    voice: resolveServerVoice(setting.serverVoice, voices),
    speed: setting.rate,
    client,
  });
}
