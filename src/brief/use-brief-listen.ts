// Listen on a brief card, wired (the rules are listen.ts's): one reader per card over the one voice
// out (voice-out.ts), speaking as quick-ask speaks: "I speak"'s language and its voice choice
// (spokenLanguage), and Auto's server voice when the server lists `tts` and the person keeps it
// (serverSpeechFor), the phone's voice when it refuses. A press reads, a second press stops, and a
// card going away stops its own reading. VoiceOver hears the button's new name (Stop reading the
// brief) rather than an announcement, which would talk over the reading.

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { useAppSession } from '../app-state/session';
import { spokenLanguage } from '../voice/language/language-voice';
import { usePhoneLocale } from '../voice/language/use-speak-language';
import { serverSpeechFor } from '../voice/server/server-voices';
import { useServerVoices } from '../voice/server/use-server-voices';
import { useVoiceSetting } from '../voice/settings/use-voice-setting';
import { voiceOut } from '../voice/speech/voice-out';
import { briefSpokenText, createBriefReader } from './listen';
import type { Brief } from './schema';

export type BriefListen = {
  /** The brief has something to say. */
  readonly offered: boolean;
  readonly reading: boolean;
  /** Listen, or Stop while it reads. */
  readonly toggle: () => void;
};

export function useBriefListen(brief: Pick<Brief, 'spoken' | 'prose'>): BriefListen {
  const text = useMemo(() => briefSpokenText(brief), [brief]);
  const phone = usePhoneLocale();
  const saved = useVoiceSetting();
  const voices = useServerVoices();
  const { discovery, client } = useAppSession();
  const reader = useMemo(() => createBriefReader(voiceOut), []);
  const reading = useSyncExternalStore(reader.subscribe, reader.reading);
  useEffect(() => () => reader.stop(), [reader]);
  const toggle = useCallback(() => {
    if (reader.reading()) {
      reader.stop();
      return;
    }
    const spoken = spokenLanguage(saved, phone, voices);
    const server = serverSpeechFor({
      discovery,
      setting: spoken.setting,
      voices: spoken.voices,
      client,
    });
    void reader.read(text, { language: spoken.language, setting: spoken.setting, server });
  }, [reader, saved, phone, voices, discovery, client, text]);
  return { offered: text !== '', reading, toggle };
}
