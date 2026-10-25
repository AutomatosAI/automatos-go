// Older chats (routes.chats, D28), behind the header menu's Chats (D73): every chat of
// either kind, newest activity first, 50 at a time with 'Load more'. A row opens routes.chat(id);
// 'New chat' opens a draft (routes.chat('new')), which its first message creates. It only wires:
// the paging is history.ts's, each row's words rows.ts's.

import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { routes } from '../../navigation/routes';
import { useTokens } from '../../styles/theme';
import {
  Button,
  Divider,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  Text,
  UI_COPY,
} from '../../ui';
import { NEW_CHAT_ID } from '../screens/chat-route';
import { HISTORY_COPY } from '../strings';
import { ChatRow } from './ChatRow';
import { ChatsHeader } from './ChatsHeader';
import type { HistoryFooter } from './history';
import { chatRowViews, type ChatRowView } from './rows';
import { useChatHistory, type ChatHistory } from './use-history';

/** The header runs up under the status bar itself. */
const SCREEN_EDGES: readonly Edge[] = ['left', 'right', 'bottom'];

export type FooterProps = { readonly footer: HistoryFooter; readonly onLoadMore: () => void };

/** Load more, its spinner or its failure under the rows (Play's Conversations draws it too). */
export function ListFooter({ footer, onLoadMore }: FooterProps) {
  const { spacing } = useTokens();
  if (footer === 'end') return null;
  if (footer === 'loading') return <LoadingState label={HISTORY_COPY.loadingMore} />;
  const failed = footer === 'failed';
  return (
    <View style={[styles.footer, { padding: spacing.space6, gap: spacing.space3 }]}>
      {failed ? (
        <Text tone="muted" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {HISTORY_COPY.loadMoreFailed}
        </Text>
      ) : null}
      <Button
        label={failed ? UI_COPY.retry : HISTORY_COPY.loadMore}
        onPress={onLoadMore}
        variant="outline"
        size="sm"
      />
    </View>
  );
}

type ChatListProps = {
  readonly rows: readonly ChatRowView[];
  readonly footer: HistoryFooter;
  readonly onOpen: (chatId: string) => void;
  readonly onLoadMore: () => void;
};

const keyOf = (row: ChatRowView) => row.id;

function ChatList({ rows, footer, onOpen, onLoadMore }: ChatListProps) {
  const { spacing } = useTokens();
  const renderItem = useCallback<ListRenderItem<ChatRowView>>(
    ({ item }) => <ChatRow row={item} onOpen={onOpen} />,
    [onOpen],
  );
  return (
    <FlatList
      data={rows}
      keyExtractor={keyOf}
      renderItem={renderItem}
      ItemSeparatorComponent={Divider}
      ListFooterComponent={<ListFooter footer={footer} onLoadMore={onLoadMore} />}
      contentContainerStyle={{ paddingHorizontal: spacing.space3, paddingBottom: spacing.space6 }}
    />
  );
}

type BodyProps = {
  readonly history: ChatHistory;
  readonly onOpen: (chatId: string) => void;
  readonly onNewChat: () => void;
};

function HistoryBody({ history, onOpen, onNewChat }: BodyProps) {
  const { state, footer, error, retry, loadMore } = history;
  const list = state.status === 'loaded' ? state.list : null;
  // the times are read against the moment each answer arrives
  const rows = useMemo(() => (list ? chatRowViews(list.rows, new Date()) : []), [list]);
  if (state.status === 'failed') return <ErrorState error={error} onRetry={retry} />;
  if (state.status === 'loading') return <LoadingState />;
  if (rows.length === 0) {
    return (
      <EmptyState
        title={HISTORY_COPY.emptyTitle}
        message={HISTORY_COPY.emptyMessage}
        action={{ label: HISTORY_COPY.newChat, onPress: onNewChat }}
      />
    );
  }
  return <ChatList rows={rows} footer={footer} onOpen={onOpen} onLoadMore={loadMore} />;
}

export function ChatsScreen() {
  const router = useRouter();
  const history = useChatHistory();
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.home);
  }, [router]);
  const newChat = useCallback(() => router.push(routes.chat(NEW_CHAT_ID)), [router]);
  const open = useCallback((chatId: string) => router.push(routes.chat(chatId)), [router]);
  return (
    <Screen edges={SCREEN_EDGES}>
      <ChatsHeader onBack={back} onNewChat={newChat} />
      <HistoryBody history={history} onOpen={open} onNewChat={newChat} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center' },
});
