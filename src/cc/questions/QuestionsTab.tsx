// The Questions tab (handoff §2 'Questions', D-QUESTIONS): the open questions, newest first as the
// server lists them, each a QuestionCard. It reads the one questions query (the foundation's stream
// refreshes it on board_changed and on resume; a pull refetches it). A role that may not answer reads
// the cards with the reason over them; a 403 on the list (owners and admins only until PRD-266 W1)
// is the forbidden copy, not an error page. Any other failure is the foundation's ErrorState.

import Lock from 'lucide-react-native/icons/lock';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';

import { userMessage } from '../../api/errors';
import { useTokens } from '../../styles/theme';
import { EmptyState, ErrorState, LoadingState, Text } from '../../ui';
import { QUESTIONS_COPY } from '../strings';
import { isForbidden } from './answer';
import { QUESTIONS_LAYOUT } from './chrome';
import { QuestionCard } from './QuestionCard';
import { useQuestionsTab } from './use-questions';
import type { QuestionCardView } from './view-model';

const keyOf = (card: QuestionCardView) => String(card.id);

function CardGap() {
  const { spacing } = useTokens();
  return <View style={{ height: spacing[QUESTIONS_LAYOUT.cardGap] }} />;
}

function NotLoaded({ tab }: { readonly tab: ReturnType<typeof useQuestionsTab> }) {
  const { query } = tab;
  if (isForbidden(query.error)) {
    return (
      <EmptyState
        icon={Lock}
        title={QUESTIONS_COPY.forbiddenTitle}
        message={userMessage(query.error)}
      />
    );
  }
  return query.error ? (
    <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  ) : (
    <LoadingState label={QUESTIONS_COPY.loading} />
  );
}

export function QuestionsTab() {
  const { colours, spacing } = useTokens();
  const tab = useQuestionsTab();
  const { cards, pull, mayAnswer, readOnly } = tab;
  const inset = spacing[QUESTIONS_LAYOUT.paddingX];
  const renderCard: ListRenderItem<QuestionCardView> = ({ item }) => (
    <View style={{ paddingHorizontal: inset }}>
      <QuestionCard view={item} mayAnswer={mayAnswer} />
    </View>
  );

  if (!cards) return <NotLoaded tab={tab} />;
  return (
    <FlatList
      data={cards}
      keyExtractor={keyOf}
      renderItem={renderCard}
      accessibilityLabel={QUESTIONS_COPY.listLabel}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        readOnly && cards.length > 0 ? (
          <Text
            level={QUESTIONS_LAYOUT.noteLevel}
            tone={QUESTIONS_LAYOUT.noteTone}
            style={{ paddingHorizontal: inset }}
          >
            {readOnly}
          </Text>
        ) : null
      }
      ListHeaderComponentStyle={
        readOnly ? { marginBottom: spacing[QUESTIONS_LAYOUT.noteGap] } : null
      }
      ItemSeparatorComponent={CardGap}
      ListEmptyComponent={
        <EmptyState title={QUESTIONS_COPY.empty.title} message={QUESTIONS_COPY.empty.message} />
      }
      contentContainerStyle={{
        paddingTop: spacing[QUESTIONS_LAYOUT.paddingTop],
        paddingBottom: spacing[QUESTIONS_LAYOUT.paddingBottom],
      }}
      refreshControl={
        <RefreshControl
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          tintColor={colours[QUESTIONS_LAYOUT.spinner]}
          colors={[colours[QUESTIONS_LAYOUT.spinner]]}
        />
      }
    />
  );
}
