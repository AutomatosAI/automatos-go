// One conversation (routes.chat(id); 'new' is a draft, routes.chatWithTicket a draft about a
// ticket, routes.chatAt one scrolled to a message). The screen only wires the route's params; it
// is src/chat/screens/ChatRouteScreen.tsx.
import { useLocalSearchParams } from 'expo-router';

import { ChatRouteScreen } from '../../../src/chat/screens/ChatRouteScreen';

export default function ChatRoute() {
  return <ChatRouteScreen params={useLocalSearchParams()} />;
}
