// The slim header bar home, the chat route and Older chats share (D73): --secondary chrome running
// up under the status bar, a 1 pt --border rule under it, and one row at least 44 pt tall (min, not
// fixed, so Dynamic Type can grow it). The screens only choose their edges and fill the row.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTokens } from '../../styles/theme';
import type { SpaceName } from '../../styles/tokens';
import { HEADER } from './menu';

export type HeaderBarProps = {
  /** From the screen's left edge to the first item. */
  readonly left: SpaceName;
  /** From the last item to the screen's right edge. */
  readonly right: SpaceName;
  readonly children: ReactNode;
};

export function HeaderBar({ left, right, children }: HeaderBarProps) {
  const insets = useSafeAreaInsets();
  const { colours, spacing } = useTokens();
  return (
    <View
      style={{
        backgroundColor: colours.secondary,
        borderBottomColor: colours.border,
        borderBottomWidth: HEADER.rule,
        paddingTop: insets.top,
      }}
    >
      <View
        style={[
          styles.row,
          {
            minHeight: HEADER.rowHeight,
            paddingLeft: spacing[left],
            paddingRight: spacing[right],
            gap: spacing[HEADER.gap],
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
