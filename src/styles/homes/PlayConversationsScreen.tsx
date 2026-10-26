// Play's Conversations (Ember 03, US-017g) on routes.chats: US-017c's PlayConversations over A2's
// history (src/chat/history useChatHistory: 50 at a time, merged by id, ended by a short page or a
// cursor the server ignored), with A2's own Load more under the rows. While there are no rows the
// list shows the wait, the failure with Try again, or the first chat's nudge with New chat, under
// Play's header and over its bottom bar. New chat opens a draft (routes.chat('new')), a row its
// chat, as A2's list does. The times are read on the phone's calendar, again each minute.

import { useRouter } from 'expo-router';
import { useCallback, useMemo, type ReactElement } from 'react';

import { ListFooter } from '../../chat/history/ChatsScreen';
import { useChatHistory, type ChatHistory } from '../../chat/history/use-history';
import { NEW_CHAT_ID } from '../../chat/screens/chat-route';
import { HISTORY_COPY } from '../../chat/strings';
import { useMinuteClock, usePhoneTimeZone } from '../../cc/shell/use-shell';
import { routes } from '../../navigation/routes';
import { EmptyState, ErrorState, LoadingState } from '../../ui';
import { PlayConversations } from '../play/companion';
import { chatsPlaceholder, playConversationsOf } from './play-chats';

type PlaceholderProps = { readonly history: ChatHistory; readonly onNewChat: () => void };

function Placeholder({ history, onNewChat }: PlaceholderProps): ReactElement | null {
  switch (chatsPlaceholder(history.state)) {
    case 'loading':
      return <LoadingState />;
    case 'failed':
      return <ErrorState error={history.error} onRetry={history.retry} />;
    case 'empty':
      return (
        <EmptyState
          title={HISTORY_COPY.emptyTitle}
          message={HISTORY_COPY.emptyMessage}
          action={{ label: HISTORY_COPY.newChat, onPress: onNewChat }}
        />
      );
    default:
      return null;
  }
}

export function PlayConversationsScreen() {
  const router = useRouter();
  const history = useChatHistory();
  const now = useMinuteClock();
  const timeZone = usePhoneTimeZone();
  const { state, footer, loadMore } = history;
  const rows = state.status === 'loaded' ? state.list.rows : null;
  const conversations = useMemo(() => playConversationsOf(rows ?? []), [rows]);
  const newChat = useCallback(() => router.push(routes.chat(NEW_CHAT_ID)), [router]);
  const open = useCallback((chatId: string) => router.push(routes.chat(chatId)), [router]);
  return (
    <PlayConversations
      conversations={conversations}
      now={now}
      timeZone={timeZone}
      onNewChat={newChat}
      onOpen={open}
      footer={rows?.length ? <ListFooter footer={footer} onLoadMore={loadMore} /> : null}
      empty={<Placeholder history={history} onNewChat={newChat} />}
    />
  );
}
