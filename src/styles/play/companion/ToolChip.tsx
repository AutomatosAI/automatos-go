// A tool call as Play's chip (Ember 01-02 and the style sheet's tool line), in the vendored
// toolLineLabel's words: running on the accent fill with a 1 pt accent line at 0.4 and an 11 pt
// spinner ring (2 pt, the accent on top; still under Reduce Motion, where the words say it runs);
// done on the ground's chip, radius 8, '✓ …' in text2; failed on the error at 0.1 with its line at
// 0.45 and '✕' in the error; waiting '…' 'Waiting for you'; skipped or stopped faded. Geist Mono
// 12 throughout. ReceiptsLine is "What Auto did": the label, then one line per receipt in Geist
// Mono 12/1.7 text2, a done write in the text colour with its 'Done' in the accent text. It takes
// the receipts themselves, or rows already made (A2's view-model, US-016k): a row with a link is a
// link, its spoken label A2's.

import { Pressable, StyleSheet, View } from 'react-native';

import type { Receipt } from '../../../core/web/types/chat';
import { Text } from '../../../ui';
import { hitSlopFor } from '../../../ui/paint';
import { PLAY_CHAT_COPY } from '../../strings';
import { Spin } from './Loop';
import { COMPANION, receiptRows, type ReceiptRow, type ToolChipView } from './model';
import { badgeInk, chipPaint } from './paint';
import { useCompanionPaint, type CompanionPaint } from './use-companion';

const { chip, receipts } = COMPANION;

function Spinner({ paint }: { readonly paint: CompanionPaint }) {
  const side = chip.spinner;
  return (
    <Spin
      animate={paint.loops}
      style={{
        width: side,
        height: side,
        borderRadius: side / 2,
        borderWidth: chip.spinnerStroke,
        borderColor: paint.lines.spinnerTrack,
        borderTopColor: paint.vars.accent,
      }}
    />
  );
}

export type ToolChipProps = { readonly chip: ToolChipView };

export function ToolChip({ chip: view }: ToolChipProps) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const tone = chipPaint(view.kind, paint);
  const face = paint.style.type.mono(chip.size);
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={view.label}
      style={[
        styles.chip,
        {
          gap: chip.gap,
          paddingHorizontal: chip.paddingX,
          paddingVertical: chip.paddingY,
          borderRadius: chip.radius,
          backgroundColor: tone.fill,
          borderWidth: tone.line ? 1 : 0,
          borderColor: tone.line ?? undefined,
        },
      ]}
    >
      {tone.spinner ? <Spinner paint={paint} /> : null}
      <Text style={[face, styles.words, { color: tone.ink }]}>
        {view.mark ? <Text style={[face, { color: tone.markInk }]}>{`${view.mark} `}</Text> : null}
        {view.text}
      </Text>
    </View>
  );
}

function ReceiptLine({ row, paint }: { readonly row: ReceiptRow; readonly paint: CompanionPaint }) {
  const { vars, style } = paint;
  const face = style.type.mono(receipts.size, 400, { leading: receipts.leading });
  const ink = row.emphasis ? vars.groundText : vars.groundText2;
  return (
    <Text style={[face, { color: ink }]}>
      {`${row.mark} ${row.text}`}
      {row.badge && row.badgeTone ? (
        <>
          {PLAY_CHAT_COPY.receipts.joiner}
          <Text style={[face, { color: badgeInk(row.badgeTone, paint) }]}>{row.badge}</Text>
        </>
      ) : null}
    </Text>
  );
}

type LinkedLineProps = {
  readonly row: ReceiptRow;
  readonly paint: CompanionPaint;
  readonly onRow: (key: string) => void;
};

/** A receipt that opens something: the line as a link, 44 pt to touch. */
function LinkedLine({ row, paint, onRow }: LinkedLineProps) {
  const height = receipts.size * receipts.leading;
  return (
    <Pressable
      onPress={() => onRow(row.key)}
      hitSlop={hitSlopFor(height)}
      accessibilityRole="link"
      accessibilityLabel={row.label ?? row.text}
      style={({ pressed }) => ({ opacity: pressed ? COMPANION.pressedOpacity : 1 })}
    >
      <ReceiptLine row={row} paint={paint} />
    </Pressable>
  );
}

export type ReceiptsLineProps = {
  /** The turn's receipts; or `rows`, already made. */
  readonly receipts?: readonly Receipt[];
  readonly rows?: readonly ReceiptRow[];
  /** A linked row was tapped (by its key). */
  readonly onRow?: (key: string) => void;
};

export function ReceiptsLine({ receipts: list = [], rows, onRow }: ReceiptsLineProps) {
  const paint = useCompanionPaint();
  const lines = rows ?? receiptRows(list);
  if (!paint || lines.length === 0) return null;
  return (
    <View>
      <Text accessibilityRole="header" style={[paint.style.type.label, { color: paint.text3 }]}>
        {PLAY_CHAT_COPY.receipts.title}
      </Text>
      {lines.map((row) =>
        row.linked && onRow ? (
          <LinkedLine key={row.key} row={row} paint={paint} onRow={onRow} />
        ) : (
          <View key={row.key} accessible accessibilityLabel={row.label}>
            <ReceiptLine row={row} paint={paint} />
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%' },
  words: { flexShrink: 1 },
});
