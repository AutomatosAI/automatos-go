// Every open suggestion (PRD-268 §6.12.5, US-G01): the header's count ('Ideas · 3' on Studio and
// Play, 'IDEAS · 3' on HUD) opens the foundation's Sheet, dressed per layout, with each suggestion's
// card and its Start and Hide. It closes itself once the last one is started or hidden.

import { useEffect } from 'react';
import { View } from 'react-native';

import { useTokens } from '../styles/theme';
import { Sheet, Text } from '../ui';
import { suggestionView } from './model';
import { StartedLine, SuggestionCard } from './SuggestionCard';
import { SUGGESTION_COPY } from './strings';
import { useOpenSuggestions, useSuggestionActions } from './use-suggestions';

export type SuggestionsSheetProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
};

function SheetBody() {
  const { spacing } = useTokens();
  const { open } = useOpenSuggestions();
  const actions = useSuggestionActions();
  return (
    <View style={{ gap: spacing.space4 }}>
      <Text variant="title" level={4} accessibilityRole="header">
        {SUGGESTION_COPY.sheetTitle}
      </Text>
      {actions.started ? <StartedLine /> : null}
      {open.map((suggestion) => (
        <SuggestionCard key={suggestion.id} view={suggestionView(suggestion)} actions={actions} />
      ))}
    </View>
  );
}

export function SuggestionsSheet({ visible, onClose }: SuggestionsSheetProps) {
  const { open } = useOpenSuggestions();
  const empty = open.length === 0;
  useEffect(() => {
    if (visible && empty) onClose();
  }, [visible, empty, onClose]);
  return (
    <Sheet visible={visible && !empty} onClose={onClose}>
      <SheetBody />
    </Sheet>
  );
}
