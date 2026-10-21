// A screen's frame: the safe area over the ground (--background), optionally scrolling so text at
// the accessibility sizes wraps and stays reachable (§4.6).

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTokens } from '../styles/theme';
import type { SpaceName } from '../styles/tokens';

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom', 'left', 'right'];

export type ScreenProps = {
  readonly children: ReactNode;
  readonly edges?: readonly Edge[];
  /** Scrolls the content (forms, settings, long states); off for screens that own a list. */
  readonly scroll?: boolean;
  readonly padding?: SpaceName;
  readonly style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  edges = DEFAULT_EDGES,
  scroll = false,
  padding,
  style,
}: ScreenProps) {
  const { colours, spacing } = useTokens();
  const inner = padding === undefined ? null : { padding: spacing[padding] };
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.screen, { backgroundColor: colours.background }, style]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.grow, inner]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screen, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  grow: { flexGrow: 1 },
});
