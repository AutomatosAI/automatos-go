// The Chat view's pieces in Candy's paint (CANDY-LAYOUT §4 P2, the 390 mock; the kit's
// chat/thread.module.css at 3920359d5): the user's bubble (at most 270 wide, corners 22 22 8 22,
// userA to userB at 150° drawn by Skia, Nunito 700 14 in the user ink), a tool chip (28 tall in the
// chip fill, Nunito 700 12: the glyph and A2's words, a done receipt's link a link), Auto's bubble
// (at most 300 wide, corners 8 22 22 22, the window's fill) holding A2's markdown, and a
// Deliverable's row (at most 290 wide, rs corners, the window's fill: a 48 square in its kind's
// gradient, radius 16, the title in Nunito 800 14, the kind in 12 quiet, and Open in the accent's
// text colour to its page). Colours come from the resolved style and tokens/candy-paint.ts.

import { Canvas, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FollowLink } from '../../../chat/components/follow-link';
import { routes } from '../../../navigation/routes';
import { Text } from '../../../ui';
import { hitSlopFor } from '../../../ui/paint';
import { useLayoutSize } from '../../ground/use-size';
import { userGradient } from '../../tokens/candy-paint';
import { CANDY_LEADING } from '../../typeface/candy-type';
import { GradientCard } from '../parts/GradientCard';
import { cornersPath, type Corners } from '../parts/shapes';
import { useCandyPaint } from '../parts/use-candy-paint';
import { useSkiaPath } from '../parts/use-skia-path';
import { CANDY_CHAT_COPY } from '../strings';
import type { DeliverableRow as Row, ToolChip as Chip } from './chat';

/** The P2 mock's measures, in points. */
export const BUBBLES = Object.freeze({
  user: 270,
  auto: 300,
  padV: 12,
  padH: 16,
  big: 22,
  small: 8,
  chip: 28,
  chipPadH: 12,
  row: 290,
  rowPad: 10,
  rowGap: 12,
  square: 48,
  squareRadius: 16,
  words: 14,
  meta: 12,
});
const USER_CORNERS: Corners = Object.freeze({
  topLeft: BUBBLES.big,
  topRight: BUBBLES.big,
  bottomRight: BUBBLES.small,
  bottomLeft: BUBBLES.big,
});
const AUTO_CORNERS: Corners = Object.freeze({
  topLeft: BUBBLES.small,
  topRight: BUBBLES.big,
  bottomRight: BUBBLES.big,
  bottomLeft: BUBBLES.big,
});
const CHIP_SLOP = hitSlopFor(BUBBLES.chip);
const PRESSED_OPACITY = 0.7;

function cornerStyle(corners: Corners) {
  return {
    borderTopLeftRadius: corners.topLeft,
    borderTopRightRadius: corners.topRight,
    borderBottomRightRadius: corners.bottomRight,
    borderBottomLeftRadius: corners.bottomLeft,
  };
}

type Size = { readonly w: number; readonly h: number };

function UserPaint({ size }: { readonly size: Size }) {
  const { look } = useCandyPaint();
  const paint = useMemo(() => userGradient(look, size), [look, size]);
  const clip = useSkiaPath(cornersPath(size, USER_CORNERS));
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group clip={clip ?? undefined}>
        <Rect x={0} y={0} width={size.w} height={size.h}>
          <LinearGradient
            start={vec(paint.start.x, paint.start.y)}
            end={vec(paint.end.x, paint.end.y)}
            colors={[...paint.colours]}
            positions={[...paint.positions]}
          />
        </Rect>
      </Group>
    </Canvas>
  );
}

export function UserBubble({ text, label }: { readonly text: string; readonly label: string }) {
  const { vars, type } = useCandyPaint();
  const [layout, onLayout] = useLayoutSize();
  const size = useMemo(() => (layout ? { w: layout.width, h: layout.height } : null), [layout]);
  return (
    <View
      onLayout={onLayout}
      style={[styles.user, cornerStyle(USER_CORNERS), { backgroundColor: vars.userA }]}
    >
      {size ? <UserPaint size={size} /> : null}
      <Text
        accessibilityLabel={label}
        style={[type.body(BUBBLES.words, 700), { color: vars.userInk }]}
      >
        {text}
      </Text>
    </View>
  );
}

export function AutoBubble({ children }: { readonly children: ReactNode }) {
  const { vars } = useCandyPaint();
  return (
    <View style={[styles.auto, cornerStyle(AUTO_CORNERS), { backgroundColor: vars.win }]}>
      {children}
    </View>
  );
}

export function ToolChipView({ chip, onLink }: { readonly chip: Chip; readonly onLink: FollowLink }) {
  const { vars, type, round } = useCandyPaint();
  const face = type.body(BUBBLES.meta, 700, { leading: CANDY_LEADING.label });
  const box = [styles.chip, { borderRadius: round, backgroundColor: vars.chip }];
  // VoiceOver hears A2's label (the status word and the words), never the glyph
  const words = (
    <Text style={[face, styles.chipWords, { color: vars.text }]}>{`${chip.glyph} ${chip.text}`}</Text>
  );
  const { link } = chip;
  if (!link) {
    return (
      <View accessible accessibilityLabel={chip.label} style={box}>
        {words}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => onLink(link)}
      hitSlop={CHIP_SLOP}
      accessibilityRole="link"
      accessibilityLabel={chip.label}
      style={({ pressed }) => [box, { opacity: pressed ? PRESSED_OPACITY : 1 }]}
    >
      {words}
    </Pressable>
  );
}

export function DeliverableRowView({ row }: { readonly row: Row }) {
  const router = useRouter();
  const { vars, type, rs } = useCandyPaint();
  const label = { leading: CANDY_LEADING.label };
  return (
    <View style={[styles.row, { borderRadius: rs, backgroundColor: vars.win }]}>
      <GradientCard set={row.set} radius={BUBBLES.squareRadius} shadow={false} style={styles.square} />
      <View accessible accessibilityLabel={row.label} style={styles.rowWords}>
        <Text style={[type.body(BUBBLES.words, 800, label), { color: vars.text }]}>{row.title}</Text>
        <Text style={[type.body(BUBBLES.meta, 400, label), { color: vars.quiet }]}>{row.kind}</Text>
      </View>
      {row.openable ? (
        <Pressable
          onPress={() => router.push(routes.cc.deliverable(row.id))}
          hitSlop={CHIP_SLOP}
          accessibilityRole="button"
          accessibilityLabel={CANDY_CHAT_COPY.open}
          accessibilityHint={CANDY_CHAT_COPY.openHint}
          style={({ pressed }) => [styles.open, { opacity: pressed ? PRESSED_OPACITY : 1 }]}
        >
          <Text style={[type.button, { color: vars.accentText }]}>{CANDY_CHAT_COPY.open}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  user: {
    alignSelf: 'flex-end',
    maxWidth: BUBBLES.user,
    paddingVertical: BUBBLES.padV,
    paddingHorizontal: BUBBLES.padH,
    overflow: 'hidden',
  },
  auto: {
    alignSelf: 'flex-start',
    maxWidth: BUBBLES.auto,
    paddingVertical: BUBBLES.padV,
    paddingHorizontal: BUBBLES.padH,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: BUBBLES.chip,
    paddingHorizontal: BUBBLES.chipPadH,
  },
  chipWords: { flexShrink: 1 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: BUBBLES.row,
    gap: BUBBLES.rowGap,
    padding: BUBBLES.rowPad,
  },
  square: { width: BUBBLES.square, height: BUBBLES.square },
  rowWords: { flex: 1, minWidth: BUBBLES.square },
  open: { justifyContent: 'center', minHeight: BUBBLES.chip },
});
