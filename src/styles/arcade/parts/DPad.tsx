// The handheld's D-pad (PRD-001 §4.6.1 D-ARC-6; README 'Pages'; the design kit's frame/controls.tsx
// and the 'Phone 390' controls): four named targets in a 3 × 3 grid of 64 pt cells (pad-grid.ts) — ▲
// Quests, ◀ Chat, ▶ Inventory, ▼ Menu — round the page-ground hub, each a button with its word as
// its label (VoiceOver never reads the arrow) and what it opens as its hint. The page on screen is
// selected (the menu's highlight and its ink) and Menu says whether the menu is open. Each cell is
// the page with the window border inside; a press nudges it 2 pt. Cells grow with Dynamic Type
// (padSide). The home says where each target goes (US-022g): routes only from routes.ts.

import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Text } from '../../../ui';
import { ARCADE_COPY } from '../../strings';
import { arcadePadWord } from '../../typeface/arcade-type';
import { DPAD_GRID, DPAD_METRICS, padSide, padState, type DPadCell, type DPadId } from './pad-grid';
import { useArcadePaint } from './use-arcade-paint';

const PAD_WORD = arcadePadWord();

export type DPadProps = {
  /** The page on screen (selected), or null when it is none of the four. */
  readonly current: DPadId | null;
  /** The menu is open: Menu is selected and expanded, nothing else is. */
  readonly menuOpen?: boolean;
  readonly onPress: (id: DPadId) => void;
};

type PadProps = {
  readonly id: DPadId;
  readonly side: number;
  readonly current: DPadId | null;
  readonly menuOpen: boolean;
  readonly onPress: (id: DPadId) => void;
};

function Pad({ id, side, current, menuOpen, onPress }: PadProps) {
  const { vars, type } = useArcadePaint();
  const copy = ARCADE_COPY.dpad[id];
  const state = padState(id, current, menuOpen);
  const ink = state.selected ? vars.hlt : vars.tx;
  return (
    <Pressable
      onPress={() => onPress(id)}
      accessibilityRole="button"
      accessibilityLabel={copy.word}
      accessibilityHint={copy.hint}
      accessibilityState={state}
      style={({ pressed }) => [
        styles.cell,
        { width: side, height: side, borderColor: vars.bd },
        { backgroundColor: state.selected ? vars.hl : vars.page },
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[type.label, { color: ink }]}>{copy.arrow}</Text>
      <Text style={[PAD_WORD, { color: ink }]} numberOfLines={1}>
        {copy.word}
      </Text>
    </Pressable>
  );
}

function Filler({ cell, side }: { readonly cell: 'hub' | null; readonly side: number }) {
  const { vars } = useArcadePaint();
  const hub =
    cell === 'hub' ? [styles.hub, { backgroundColor: vars.page, borderColor: vars.bd }] : null;
  return <View style={[{ width: side, height: side }, hub]} />;
}

export function DPad({ current, menuOpen = false, onPress }: DPadProps) {
  const side = padSide(useWindowDimensions().fontScale);
  const place = (cell: DPadCell, column: number) =>
    cell === null || cell === 'hub' ? (
      <Filler key={column} cell={cell} side={side} />
    ) : (
      <Pad
        key={cell}
        id={cell}
        side={side}
        current={current}
        menuOpen={menuOpen}
        onPress={onPress}
      />
    );
  return (
    <View style={styles.grid}>
      {DPAD_GRID.map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map(place)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: DPAD_METRICS.gap,
    borderWidth: DPAD_METRICS.ring,
  },
  hub: { borderWidth: DPAD_METRICS.ring },
  pressed: { transform: [{ translateX: DPAD_METRICS.press }, { translateY: DPAD_METRICS.press }] },
});
