// The seven-day strip (handoff §2 'Calendar'): today and the six days after it in seven equal
// cells, each the weekday, the date and a dot when the day has items; the chosen day is the solid
// ink chip and today sits on the card. VoiceOver hears the date, 'today' and how many items. The
// cells are view-model.ts's; the paints chrome.ts's.

import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { CALENDAR_COPY } from '../strings';
import { DAY_STRIP, stripCellPaint } from './chrome';
import type { StripCellView } from './view-model';

function DayCell({
  cell,
  onPress,
}: {
  readonly cell: StripCellView;
  readonly onPress: () => void;
}) {
  const { colours, radii } = useTokens();
  const paint = stripCellPaint(colours, cell);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={cell.accessibilityLabel}
      accessibilityState={{ selected: cell.selected }}
      style={[
        styles.cell,
        {
          paddingTop: DAY_STRIP.paddingTop,
          paddingBottom: DAY_STRIP.paddingBottom,
          gap: DAY_STRIP.lineGap,
          borderWidth: DAY_STRIP.borderWidth,
          borderRadius: radii[DAY_STRIP.radius],
          backgroundColor: paint.backgroundColor,
          borderColor: paint.borderColor,
        },
      ]}
    >
      <Text
        variant="mono"
        numberOfLines={1}
        style={{ color: paint.color, opacity: DAY_STRIP.weekdayOpacity }}
      >
        {cell.weekday}
      </Text>
      <Text variant="mono" level={DAY_STRIP.dateLevel} style={{ color: paint.color }}>
        {cell.day}
      </Text>
      <View
        style={{
          width: DAY_STRIP.dotSize,
          height: DAY_STRIP.dotSize,
          borderRadius: radii[DAY_STRIP.dotRadius],
          backgroundColor: paint.dot,
        }}
      />
    </Pressable>
  );
}

export type DayStripProps = {
  readonly cells: readonly StripCellView[];
  readonly onChoose: (day: string) => void;
};

export function DayStrip({ cells, onChoose }: DayStripProps) {
  const { spacing } = useTokens();
  return (
    <View
      accessibilityLabel={CALENDAR_COPY.stripLabel}
      style={[styles.strip, { gap: spacing[DAY_STRIP.gap] }]}
    >
      {cells.map((cell) => (
        <DayCell key={cell.key} cell={cell} onPress={() => onChoose(cell.key)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, alignItems: 'center' },
});
