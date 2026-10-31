// Today's Needs you window (CANDY-LAYOUT §4 P1; the kit's today/needs-window.tsx at 3920359d5): a
// window card (the window's fill, rs, 14 × 16 padding) titled 'Needs you' (Outfit 600 17) over the
// first two of A2's needs strip cards (today.ts needRows), each a row at least 48 tall: a 38 pt
// gradient avatar with the agent's initial, the request (Nunito 800 14, one line, cut with an
// ellipsis) and '{agent} · {time ago}' (12, quiet). A row opens its card's target as Studio's strip
// does (useFollowLink: a screen in the app, else Studio in the browser), and VoiceOver hears the
// card's own label (its status word, title and meta). Nothing waiting, no window.

import { Pressable, StyleSheet, View } from 'react-native';

import type { FollowLink } from '../../../chat/components/follow-link';
import { Text } from '../../../ui';
import { CANDY_LEADING, CANDY_STEPS } from '../../typeface/candy-type';
import { Avatar } from '../parts/Avatar';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_TODAY_COPY } from '../strings';
import { NEEDS_WINDOW, type NeedRow } from './today';

const WINDOW = Object.freeze({ padV: 14, padH: 16, gap: 6, rowGap: 12 });
const META_SIZE = 12;
const PRESSED_OPACITY = 0.7;

function RowBody({ row }: { readonly row: NeedRow }) {
  const { vars, type } = useCandyPaint();
  const leading = { leading: CANDY_LEADING.label };
  return (
    <>
      <Avatar name={row.avatarName} size={NEEDS_WINDOW.avatar} set={row.set} />
      <View style={styles.words}>
        <Text
          numberOfLines={1}
          style={[type.body(CANDY_STEPS.label, 800, leading), { color: vars.text }]}
        >
          {row.request}
        </Text>
        <Text style={[type.body(META_SIZE, 400, leading), { color: vars.quiet }]}>{row.meta}</Text>
      </View>
    </>
  );
}

function NeedLine({ row, onOpen }: { readonly row: NeedRow; readonly onOpen: FollowLink }) {
  const { target } = row;
  if (!target) {
    return (
      <View accessible accessibilityLabel={row.accessibilityLabel} style={styles.row}>
        <RowBody row={row} />
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => onOpen(target)}
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
      accessibilityHint={row.accessibilityHint}
      style={({ pressed }) => [styles.row, { opacity: pressed ? PRESSED_OPACITY : 1 }]}
    >
      <RowBody row={row} />
    </Pressable>
  );
}

export type NeedsWindowProps = {
  readonly rows: readonly NeedRow[];
  readonly onOpen: FollowLink;
};

export function NeedsWindow({ rows, onOpen }: NeedsWindowProps) {
  const { vars, type, rs } = useCandyPaint();
  if (rows.length === 0) return null;
  return (
    <View style={[styles.window, { borderRadius: rs, backgroundColor: vars.win }]}>
      <Text accessibilityRole="header" style={[type.display('card'), { color: vars.text }]}>
        {CANDY_TODAY_COPY.needsTitle}
      </Text>
      {rows.map((row) => (
        <NeedLine key={row.key} row={row} onOpen={onOpen} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  window: { paddingVertical: WINDOW.padV, paddingHorizontal: WINDOW.padH, gap: WINDOW.gap },
  row: {
    minHeight: NEEDS_WINDOW.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: WINDOW.rowGap,
  },
  words: { flex: 1, minWidth: 0 },
});
