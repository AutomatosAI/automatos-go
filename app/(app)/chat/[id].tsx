// One conversation (routes.chat(id); 'new' is a draft): the same thread and composer as home,
// with a way back. Opened from a deep link, Back goes home. A draft with a ticket in its params
// (routes.chatWithTicket, D-ASK-AUTO) discusses that ticket. The style's layout draws it
// (src/styles/homes StyleChat, US-016k): Studio's ChatScreen, Play's Companion chat, HUD's core.
// routes.chatAt opens it scrolled to one of its messages (the `focus` param, PRD-268 US-G03).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { routeTicketId } from '../../../src/chat/discussion/discussion';
import { routeChatId } from '../../../src/chat/screens/chat-route';
import { focusFromChatParams, routes } from '../../../src/navigation/routes';
import { StyleChat } from '../../../src/styles/homes/StyleHome';

export default function ChatRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.home);
  }, [router]);
  return (
    <StyleChat
      chatId={routeChatId(params)}
      ticketId={routeTicketId(params)}
      focusMessageId={focusFromChatParams(params)}
      onBack={back}
    />
  );
}
