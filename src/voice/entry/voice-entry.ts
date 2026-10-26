// The way into the voice screen from a chat (US-019k, PRD-001 §4.7): whether a composer shows the
// voice button, and where it goes. Viewers get no voice (D-ROLES: roleCan 'chat' is false, also
// while the role is unknown), so the button is not there for them; for everyone else it is there and
// pressable, held by nothing: not the AI label (D73, which never fences anything), not a reply that
// streams. It goes to the voice screen on the open conversation ('/voice?chat=<id>'), or on A2's
// home thread while the chat has no id yet (KC4). A tap never opens the microphone: only HOLD TO
// TALK on the voice screen does (KV5). Pure: no React, no expo-router, so vitest loads it.

import { voiceRoute } from '../nav';
import { VOICE_ENTRY_COPY } from '../strings';

export type VoiceEntryInput = {
  /** roleCan(role, 'chat'): owners, admins and editors. */
  readonly roleCanChat: boolean;
  /** The open conversation's id (A2's thread state.chatId); null for a chat not yet named. */
  readonly chatId: string | null;
};

export type VoiceEntry = {
  /** false for viewers (and while the role is unknown): the composer shows no voice button. */
  readonly visible: boolean;
  /** A shown button is always pressable: nothing holds it. */
  readonly enabled: boolean;
  /** The voice screen's path (src/voice/nav.ts voiceRoute). */
  readonly route: string;
  /** What VoiceOver and TalkBack read, the icon saying nothing. */
  readonly label: string;
  readonly hint: string;
};

export function voiceEntry({ roleCanChat, chatId }: VoiceEntryInput): VoiceEntry {
  return Object.freeze({
    visible: roleCanChat,
    enabled: roleCanChat,
    route: voiceRoute(chatId),
    label: VOICE_ENTRY_COPY.label,
    hint: VOICE_ENTRY_COPY.hint,
  });
}
