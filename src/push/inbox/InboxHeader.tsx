// The inbox's header, on the home header's own bar (HeaderBar, D73), so home, Older chats and the
// inbox are the same height: Back, the serif title, and Mark all read while any row is unread.

import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { StyleSheet } from 'react-native';

import { HeaderBar } from '../../chat/home/HeaderBar';
import { HEADER } from '../../chat/home/menu';
import { Button, IconButton, Text } from '../../ui';
import { PUSH_INBOX_COPY } from '../strings';

const TITLE_LEVEL = 4;

export type InboxHeaderProps = {
  readonly onBack: () => void;
  /** Mark all read: shown only while a row is unread. */
  readonly onMarkAll: (() => void) | null;
  readonly marking: boolean;
};

export function InboxHeader({ onBack, onMarkAll, marking }: InboxHeaderProps) {
  return (
    <HeaderBar left={HEADER.edge.control} right={HEADER.edge.bordered}>
      <IconButton
        icon={ChevronLeft}
        accessibilityLabel={PUSH_INBOX_COPY.back}
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
        {PUSH_INBOX_COPY.title}
      </Text>
      {onMarkAll ? (
        <Button
          label={PUSH_INBOX_COPY.markAllRead}
          onPress={onMarkAll}
          variant="outline"
          size="sm"
          busy={marking}
          disabled={marking}
        />
      ) : null}
    </HeaderBar>
  );
}

const styles = StyleSheet.create({
  title: { flex: 1, minWidth: 0 },
});
