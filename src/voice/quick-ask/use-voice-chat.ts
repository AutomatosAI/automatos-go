// The voice screen's conversation (US-019g): the chat its route names (routes '/voice?chat=<id>'),
// else A2's home thread (KC4: the newest conversation, checked before reuse by useThread, or a draft
// whose first message creates the chat). Until the home thread is chosen the id is undefined: the
// screen shows loading and opens no thread, so nothing is said into a thread not yet chosen.

import { useHomeChat, type HomeChat } from '../../chat/home/use-home';

const NO_RETRY = (): void => undefined;

/** The conversation quick-ask talks into; `chatId` param first, else the home thread. */
export function useVoiceChat(chatId: string | null): HomeChat {
  const home = useHomeChat();
  return chatId === null ? home : { chatId, error: null, retry: NO_RETRY };
}
