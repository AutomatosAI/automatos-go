// Older chats (routes.chats, D28): the list behind the header menu's Chats (D73, src/chat/history);
// in Play, the Companion's Conversations over the same history (PlayConversationsScreen, Ember 03).
// The screen only wires; the switch is src/styles/homes/PlaySwitch.tsx.
import { StyleChats } from '../../src/styles/homes/PlaySwitch';

export default function Chats() {
  return <StyleChats />;
}
