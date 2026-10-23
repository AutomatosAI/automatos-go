// The older chats list's header, in the home header's chrome (--secondary under the status bar, a
// 1 pt --border under it): Back, the serif title, and 'New chat', which opens a draft.

import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import SquarePen from 'lucide-react-native/icons/square-pen';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTokens } from '../../styles/theme';
import { Button, IconButton, Text } from '../../ui';
import { HISTORY_COPY, HOME_COPY } from '../strings';

const TITLE_LEVEL = 4;

export type ChatsHeaderProps = {
  readonly onBack: () => void;
  readonly onNewChat: () => void;
};

export function ChatsHeader({ onBack, onNewChat }: ChatsHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colours, spacing } = useTokens();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colours.secondary,
          borderBottomColor: colours.border,
          paddingTop: insets.top + spacing.space3,
          paddingBottom: spacing.space4,
          paddingLeft: spacing.space3,
          paddingRight: spacing.space6,
          gap: spacing.space4,
        },
      ]}
    >
      <IconButton
        icon={ChevronLeft}
        accessibilityLabel={HOME_COPY.back}
        onPress={onBack}
        variant="ghost"
        size="md"
      />
      <Text
        variant="title"
        level={TITLE_LEVEL}
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.title}
      >
        {HISTORY_COPY.title}
      </Text>
      <Button
        label={HISTORY_COPY.newChat}
        icon={SquarePen}
        onPress={onNewChat}
        variant="outline"
        size="sm"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  title: { flex: 1, minWidth: 0 },
});
