// One conversation (routes.chat(id); 'new' is a draft): the same thread and composer as home,
// with a way back. Opened from a deep link, Back goes home.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { ChatScreen } from '../../../src/chat/screens/ChatScreen';
import { routeChatId } from '../../../src/chat/screens/chat-route';
import { routes } from '../../../src/navigation/routes';

export default function ChatRoute() {
  const router = useRouter();
  const chatId = routeChatId(useLocalSearchParams());
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.home);
  }, [router]);
  return <ChatScreen chatId={chatId} onBack={back} />;
}
