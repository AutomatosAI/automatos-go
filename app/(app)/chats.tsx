// Older chats (routes.chats, D28): the list behind the header menu's Chats (D73, src/chat/history);
// in Play, the Companion's Conversations over the same history (PlayConversationsScreen, Ember 03).
import { ChatsScreen } from '../../src/chat/history/ChatsScreen';
import { PlayConversationsScreen } from '../../src/styles/homes/PlayConversationsScreen';
import { usePlayLayout } from '../../src/styles/homes/use-play-layout';

export default function Chats() {
  return usePlayLayout() ? <PlayConversationsScreen /> : <ChatsScreen />;
}
