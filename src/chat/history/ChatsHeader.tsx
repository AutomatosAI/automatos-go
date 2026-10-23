// The older chats list's header, on HomeHeader's own bar (HeaderBar, D73), so home and Older chats
// are the same height: Back, the serif title, and 'New chat', which opens a draft.

import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import SquarePen from 'lucide-react-native/icons/square-pen';
import { StyleSheet } from 'react-native';

import { Button, IconButton, Text } from '../../ui';
import { HeaderBar } from '../home/HeaderBar';
import { HEADER } from '../home/menu';
import { HISTORY_COPY, HOME_COPY } from '../strings';

const TITLE_LEVEL = 4;

export type ChatsHeaderProps = {
  readonly onBack: () => void;
  readonly onNewChat: () => void;
};

export function ChatsHeader({ onBack, onNewChat }: ChatsHeaderProps) {
  return (
    <HeaderBar left={HEADER.edge.control} right={HEADER.edge.bordered}>
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
    </HeaderBar>
  );
}

const styles = StyleSheet.create({
  title: { flex: 1, minWidth: 0 },
});
