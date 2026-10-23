// One conversation (routes.chat(id); 'new' is a draft): the same thread and composer as home,
// with a way back. Opened from a deep link, Back goes home. A draft with a ticket in its params
// (routes.chatWithTicket, D-ASK-AUTO) discusses that ticket.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { routeTicketId } from '../../../src/chat/discussion/discussion';
import { ChatScreen } from '../../../src/chat/screens/ChatScreen';
import { routeChatId } from '../../../src/chat/screens/chat-route';
import { routes } from '../../../src/navigation/routes';

export default function ChatRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.home);
  }, [router]);
  return <ChatScreen chatId={routeChatId(params)} ticketId={routeTicketId(params)} onBack={back} />;
}
