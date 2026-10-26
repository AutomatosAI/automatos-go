// The chosen day (handoff §2 'Calendar', phone = Day view): the always-on band (dashed, '24/7', a
// line per heartbeat with its cadence), then the day's rows in time order: the mono time, the kind
// as its colour's 8 pt square and its WORD, the serif title and the meta. A paused item is greyed
// and says 'Paused'; an overdue deadline says 'Overdue'. A row or a band line opens the item sheet.
// 'Nothing scheduled this day.' when the day has no rows. Views are view-model.ts's; sizes chrome.ts's.
// A band line is at least 44 tall to touch, its words centred, the '24/7' mark beside the first.

import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { CALENDAR_COPY } from '../strings';
import {
  ALWAYS_ON_BAND,
  DAY_EMPTY,
  DAY_ROW,
  FLAG_TONES,
  KIND_SQUARE,
  kindTone,
  pausedOpacity,
} from './chrome';
import type { KindWord } from './day-model';
import type { BandLineView, CalendarView, ItemFlag, RowView } from './view-model';

function KindSquare({ kind }: { readonly kind: KindWord }) {
  const { colours, radii } = useTokens();
  return (
    <View
      style={{
        width: KIND_SQUARE.size,
        height: KIND_SQUARE.size,
        borderRadius: radii[KIND_SQUARE.radius],
        backgroundColor: kindTone(colours, kind),
      }}
    />
  );
}

function Flags({ flags }: { readonly flags: readonly ItemFlag[] }) {
  return flags.map((flag) => (
    <Text key={flag.key} variant="mono" tone={FLAG_TONES[flag.key]}>
      {`${CALENDAR_COPY.separator} ${flag.word}`}
    </Text>
  ));
}

export type KindLineProps = { readonly kind: KindWord; readonly flags: readonly ItemFlag[] };

/** The kind as its square and WORD in its colour, then 'Paused' or 'Overdue' when they apply. */
export function KindLine({ kind, flags }: KindLineProps) {
  const { colours, spacing } = useTokens();
  return (
    <View style={[styles.line, { gap: spacing[KIND_SQUARE.gap] }]}>
      <KindSquare kind={kind} />
      <Text variant="mono" style={{ color: kindTone(colours, kind) }}>
        {kind.label}
      </Text>
      <Flags flags={flags} />
    </View>
  );
}

function BandLine({
  line,
  onPress,
}: {
  readonly line: BandLineView;
  readonly onPress: () => void;
}) {
  const { spacing } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={line.accessibilityLabel}
      accessibilityHint={CALENDAR_COPY.openHint}
      style={[
        styles.bandLine,
        {
          gap: spacing[ALWAYS_ON_BAND.gap],
          minHeight: ALWAYS_ON_BAND.lineMinHeight,
          opacity: pausedOpacity(line.paused),
        },
      ]}
    >
      <KindSquare kind={line.kind} />
      <Text level={ALWAYS_ON_BAND.titleLevel} style={styles.grow}>
        {line.line}
      </Text>
      <Flags flags={line.flags} />
      <Text
        variant="mono"
        tone={ALWAYS_ON_BAND.everyTone}
        style={{ textTransform: ALWAYS_ON_BAND.everyCase }}
      >
        {line.every}
      </Text>
    </Pressable>
  );
}

function AlwaysOnBand({
  lines,
  onOpen,
}: {
  readonly lines: readonly BandLineView[];
  readonly onOpen: (line: BandLineView) => void;
}) {
  const { colours, radii, spacing } = useTokens();
  return (
    <View
      style={[
        styles.band,
        {
          gap: spacing[ALWAYS_ON_BAND.gap],
          paddingVertical: ALWAYS_ON_BAND.paddingY,
          paddingHorizontal: spacing[ALWAYS_ON_BAND.paddingX],
          borderWidth: ALWAYS_ON_BAND.borderWidth,
          borderStyle: ALWAYS_ON_BAND.borderStyle,
          borderColor: colours[ALWAYS_ON_BAND.border],
          borderRadius: radii[ALWAYS_ON_BAND.radius],
        },
      ]}
    >
      <View style={[styles.mark, { minHeight: ALWAYS_ON_BAND.lineMinHeight }]}>
        <Text
          variant="mono"
          tone={ALWAYS_ON_BAND.markTone}
          accessibilityLabel={CALENDAR_COPY.bandLabel}
        >
          {CALENDAR_COPY.bandMark}
        </Text>
      </View>
      <View style={[styles.grow, { gap: spacing[ALWAYS_ON_BAND.lineGap] }]}>
        {lines.map((line) => (
          <BandLine key={line.itemId} line={line} onPress={() => onOpen(line)} />
        ))}
      </View>
    </View>
  );
}

function DayRow({ row, onPress }: { readonly row: RowView; readonly onPress: () => void }) {
  const { colours, spacing } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
      accessibilityHint={CALENDAR_COPY.openHint}
      style={[styles.row, { gap: spacing[DAY_ROW.gap], opacity: pausedOpacity(row.paused) }]}
    >
      <Text
        variant="mono"
        tone={DAY_ROW.timeTone}
        style={{ minWidth: DAY_ROW.timeWidth, paddingTop: DAY_ROW.timePaddingTop }}
      >
        {row.time}
      </Text>
      <View
        style={[
          styles.grow,
          {
            gap: DAY_ROW.bodyGap,
            paddingTop: DAY_ROW.bodyPaddingTop,
            paddingBottom: DAY_ROW.bodyPaddingBottom,
            borderTopWidth: DAY_ROW.ruleWidth,
            borderTopColor: colours[DAY_ROW.rule],
          },
        ]}
      >
        <KindLine kind={row.kind} flags={row.flags} />
        <Text variant="title" level={DAY_ROW.titleLevel}>
          {row.title}
        </Text>
        {row.meta ? (
          <Text level={DAY_ROW.metaLevel} tone={DAY_ROW.metaTone}>
            {row.meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export type DayViewProps = {
  readonly view: CalendarView;
  readonly onOpenRow: (row: RowView) => void;
  readonly onOpenBand: (line: BandLineView) => void;
};

export function DayView({ view, onOpenRow, onOpenBand }: DayViewProps) {
  const { spacing } = useTokens();
  return (
    <>
      {view.band.length > 0 ? <AlwaysOnBand lines={view.band} onOpen={onOpenBand} /> : null}
      <View>
        {view.rows.map((row) => (
          <DayRow key={row.key} row={row} onPress={() => onOpenRow(row)} />
        ))}
        {view.empty ? (
          <Text
            variant="title"
            level={DAY_EMPTY.level}
            tone={DAY_EMPTY.tone}
            italic
            style={{ paddingVertical: spacing[DAY_EMPTY.paddingY] }}
          >
            {view.empty}
          </Text>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  bandLine: { flexDirection: 'row', alignItems: 'center' },
  mark: { justifyContent: 'center' },
  band: { flexDirection: 'row', alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  grow: { flex: 1, minWidth: 0 },
});
