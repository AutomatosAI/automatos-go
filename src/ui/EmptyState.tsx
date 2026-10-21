// An empty list or tab ('No open questions. Agents are deciding on their own.'): an icon tile, a
// serif title, an optional line of explanation and an optional action. The copy is the caller's.

import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Inbox from 'lucide-react-native/icons/inbox';

import { useTokens } from '../styles/theme';
import { Button } from './Button';
import { Text } from './Text';
import { ICON_STROKE, tint } from './paint';

const TILE_SIZE = 56;
const ICON_SIZE = 26;
const TILE_FILL_ALPHA = 0.5;
const TILE_BORDER_ALPHA = 0.6;
const TITLE_LEVEL = 4;
const MESSAGE_LEVEL = 3;

export type EmptyStateProps = {
  readonly title: string;
  readonly message?: string;
  readonly icon?: LucideIcon;
  readonly action?: { readonly label: string; readonly onPress: () => void };
};

export function EmptyState({ title, message, icon: Icon = Inbox, action }: EmptyStateProps) {
  const { colours, radii, spacing } = useTokens();
  return (
    <View style={[styles.state, { padding: spacing.space9, gap: spacing.space3 }]}>
      <View
        style={[
          styles.tile,
          {
            borderRadius: radii.panel,
            backgroundColor: tint(colours.secondary, TILE_FILL_ALPHA),
            borderColor: tint(colours.border, TILE_BORDER_ALPHA),
          },
        ]}
        importantForAccessibility="no-hide-descendants"
      >
        <Icon size={ICON_SIZE} color={colours.mutedForeground} strokeWidth={ICON_STROKE} />
      </View>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header" style={styles.centre}>
        {title}
      </Text>
      {message ? (
        <Text level={MESSAGE_LEVEL} tone="muted" style={styles.centre}>
          {message}
        </Text>
      ) : null}
      {action ? (
        <Button label={action.label} onPress={action.onPress} variant="outline" size="sm" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center' },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: { textAlign: 'center' },
});
