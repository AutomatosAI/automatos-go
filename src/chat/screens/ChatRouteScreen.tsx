// One conversation as app/(app)/chat/[id].tsx mounts it (routes.chat(id); 'new' is a draft): the
// same thread and composer as home, with a way back. Opened from a deep link, Back goes home
// (useGoBack). A draft with a ticket in its params (routes.chatWithTicket, D-ASK-AUTO) discusses
// that ticket. The style's layout draws it (src/styles/homes StyleChat, US-016k): Studio's
// ChatScreen, Play's Companion chat, HUD's core. routes.chatAt opens it scrolled to one of its
// messages (the `focus` param, PRD-268 US-G03). The params are the route's, read by chat-route.ts,
// discussion.ts and routes.ts; this only wires them.
import { focusFromChatParams, routes, type RouteParams } from '../../navigation/routes';
import { useGoBack } from '../../navigation/use-go-back';
import { StyleChat } from '../../styles/homes/StyleHome';
import { routeTicketId } from '../discussion/discussion';
import { routeChatId } from './chat-route';

export function ChatRouteScreen({ params }: { readonly params: RouteParams }) {
  const back = useGoBack(routes.home);
  return (
    <StyleChat
      chatId={routeChatId(params)}
      ticketId={routeTicketId(params)}
      focusMessageId={focusFromChatParams(params)}
      onBack={back}
    />
  );
}
