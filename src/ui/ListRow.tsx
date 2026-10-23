// A list row (the digest's rows, settings rows): an optional 28 pt icon tile, a serif title and a
// summary line, and a trailing slot (a chevron when the row opens something, or a control). At
// least 44 tall; a pressable row reads as one button with its title and summary.

import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';

import { useTokens } from '../styles/theme';
import { Text } from './Text';
import { ICON_STROKE, MIN_TOUCH, joinLabel } from './paint';
import { cardPaint } from './variants';

const TILE_SIZE = 28;
const TILE_ICON_SIZE = 15;
const CHEVRON_SIZE = 16;
const TITLE_LEVEL = 6;
const SUMMARY_LEVEL = 6;

export type ListRowProps = {
  readonly title: string;
  readonly summary?: string;
  readonly icon?: LucideIcon;
  /** A control or value on the right; a pressable row without one shows a chevron. */
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  /** VoiceOver's name when the row says more than its title and summary (a count beside it). */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly disabled?: boolean;
};

export function ListRow({
  title,
  summary,
  icon: Icon,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
}: ListRowProps) {
  const { colours, radii, spacing } = useTokens();
  const body = (
    <>
      {Icon ? (
        <View
          style={[styles.tile, { backgroundColor: colours.secondary, borderRadius: radii.control }]}
        >
          <Icon size={TILE_ICON_SIZE} color={colours.foreground} strokeWidth={ICON_STROKE} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="title" level={TITLE_LEVEL}>
          {title}
        </Text>
        {summary ? (
          <Text level={SUMMARY_LEVEL} tone="muted">
            {summary}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <ChevronRight
            size={CHEVRON_SIZE}
            color={colours.mutedForeground}
            strokeWidth={ICON_STROKE}
          />
        ) : null)}
    </>
  );
  const frame = [styles.row, { gap: spacing.space4, paddingVertical: spacing.space3 }];
  if (!onPress) return <View style={frame}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? joinLabel(title, summary)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        frame,
        { borderRadius: radii.control },
        pressed ? { backgroundColor: cardPaint(colours, true).backgroundColor } : null,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH },
  tile: { width: TILE_SIZE, height: TILE_SIZE, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
});
