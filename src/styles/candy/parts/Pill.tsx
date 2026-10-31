// Candy's pill and the row it slides in (CANDY-LAYOUT §4 P3; the kit's ui/ui.module.css .pill at
// 3920359d5): a 36 pt capsule in the chip fill (or the window's, on a ground of chips) with its
// label in Nunito 800 13, the accent and its ink while chosen (chips.ts pillPaint); it takes the
// 44 pt touch through its slop. A pill with nothing to do is a plain label, never a dimmed button.
// The row scrolls sideways and may bleed past the page's right gutter (P1's and P3's rows); it is
// padded to the 44 pt touch and takes the padding back (touchRoom), since a scroll view clips.

import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { hitSlopFor, touchRoom } from '../../../ui/paint';
import { PILL, pillPaint, type PillGround } from './chips';
import { useCandyPaint } from './use-candy-paint';

const PRESSED_OPACITY = 0.7;
const ROOM = touchRoom(PILL.height);

export type PillProps = {
  readonly label: string;
  readonly selected?: boolean;
  /** What a tap does; a pill without one is a label. */
  readonly onPress?: () => void;
  /** The ground while not chosen: the chip fill (the default) or the window's. */
  readonly ground?: PillGround;
  /** 'tab' in a row that switches what a view shows (the Shelf's types); 'button' otherwise. */
  readonly role?: 'button' | 'tab';
  readonly accessibilityHint?: string;
};

export function Pill({
  label,
  selected = false,
  onPress,
  ground = 'chip',
  role = 'button',
  accessibilityHint,
}: PillProps) {
  const { vars, type, round } = useCandyPaint();
  const paint = pillPaint(selected, ground);
  const box = [styles.pill, { borderRadius: round }, paint.fill ? { backgroundColor: vars[paint.fill] } : null];
  const words = <Text style={[type.button, { color: vars[paint.ink] }]}>{label}</Text>;
  if (!onPress) return <View style={box}>{words}</View>;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlopFor(PILL.height)}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={({ pressed }) => [box, { opacity: pressed ? PRESSED_OPACITY : 1 }]}
    >
      {words}
    </Pressable>
  );
}

export type PillRowProps = {
  readonly children: ReactNode;
  /** What VoiceOver hears for the row ('Types'). */
  readonly accessibilityLabel?: string;
  /** 'tablist' when its pills are tabs. */
  readonly role?: 'tablist';
  /** How far the row slides past the right edge of its column (the page's gutter); 0 by default. */
  readonly bleed?: number;
};

export function PillRow({ children, accessibilityLabel, role, bleed = 0 }: PillRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      style={{ marginVertical: ROOM.marginVertical, marginRight: -bleed }}
      contentContainerStyle={[
        styles.row,
        { paddingVertical: ROOM.paddingVertical, paddingRight: bleed },
      ]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: PILL.height,
    paddingHorizontal: PILL.padH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { gap: PILL.gap, alignItems: 'center' },
});
