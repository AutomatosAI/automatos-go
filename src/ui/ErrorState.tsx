// A failed load: the error's kind in the taxonomy's own words (userMessage → src/api/strings.ts),
// never a status, URL or server internals, and 'Try again' where a retry can help (not for a
// signed-out session, a missing permission or something that is gone). Announced as an alert.

import { StyleSheet, View } from 'react-native';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';

import { useTokens } from '../styles/theme';
import { Button } from './Button';
import { UI_COPY } from './strings';
import { Text } from './Text';
import { ICON_STROKE, tint } from './paint';
import { errorCopy } from './variants';

const TILE_SIZE = 48;
const ICON_SIZE = 22;
const TILE_FILL_ALPHA = 0.12;
const TITLE_LEVEL = 4;
const MESSAGE_LEVEL = 3;

export type ErrorStateProps = {
  /** An ApiError (any other value shows the server copy). */
  readonly error: unknown;
  readonly onRetry?: () => void;
  readonly title?: string;
};

export function ErrorState({ error, onRetry, title }: ErrorStateProps) {
  const { colours, radii, spacing } = useTokens();
  const copy = errorCopy(error);
  return (
    <View
      style={[styles.state, { padding: spacing.space9, gap: spacing.space3 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View
        style={[
          styles.tile,
          { borderRadius: radii.panel, backgroundColor: tint(colours.accent, TILE_FILL_ALPHA) },
        ]}
        importantForAccessibility="no-hide-descendants"
      >
        <TriangleAlert size={ICON_SIZE} color={colours.accent} strokeWidth={ICON_STROKE} />
      </View>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header" style={styles.centre}>
        {title ?? copy.title}
      </Text>
      <Text level={MESSAGE_LEVEL} tone="muted" style={styles.centre}>
        {copy.message}
      </Text>
      {onRetry && copy.canRetry ? (
        <Button label={UI_COPY.retry} onPress={onRetry} variant="outline" size="sm" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center' },
  tile: { width: TILE_SIZE, height: TILE_SIZE, alignItems: 'center', justifyContent: 'center' },
  centre: { textAlign: 'center' },
});
