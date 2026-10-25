// The drawer's looks row ('Automatos Command HUD.dc.html'): the five presets, then the saved looks,
// as cards 96 wide — a 58 pt swatch in the look's ground with a 40 pt ring in its accent (2 pt,
// glowing 12 out and 8 in), over the name in Geist Mono 600 11 at .08em. The look on is framed in
// 1.5 pt of the accent, the others in 1 pt of the line. A tap picks a look; a long press on a
// saved look (VoiceOver: its 'Rename or delete' action) opens the sheet. A look just saved scrolls
// into view, without the scroll's motion while loops are off.

import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
} from 'react-native';

import { Text } from '../../../ui';
import { useScrollToNew } from '../../play/look-page/LooksRow';
import { HUD_DRAWER_COPY } from '../../strings';
import { ringGlow } from '../../tokens/drawer-colours';
import { HUD_DRAWER, drawerFrame, type DrawerLook } from '../drawer-model';
import { useDrawerPaint, type DrawerPaint } from './use-drawer';

const { card } = HUD_DRAWER;
const HOLD_ACTION = 'longpress';
const OWN_ACTIONS = Object.freeze([{ name: HOLD_ACTION, label: HUD_DRAWER_COPY.lookHint }]);
const NAME_LINES = 2;

function Swatch({ item }: { readonly item: DrawerLook }) {
  const glow = ringGlow(item.accent, card.ringGlow, card.ringInset);
  return (
    <View style={[styles.swatch, { backgroundColor: item.ground }]}>
      <View style={[styles.ring, { borderColor: item.accent, boxShadow: glow }]} />
    </View>
  );
}

type CardProps = {
  readonly item: DrawerLook;
  readonly paint: DrawerPaint;
  readonly onPick: (id: string) => void;
  readonly onHold: (id: string) => void;
};

function LookCard({ item, paint, onPick, onHold }: CardProps) {
  const { vars, style } = paint;
  const { id } = item.look;
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === HOLD_ACTION) onHold(id);
  };
  const face = style.type.mono(card.nameSize, 600, { trackingEm: card.nameTracking });
  return (
    <Pressable
      onPress={() => onPick(id)}
      onLongPress={item.own ? () => onHold(id) : undefined}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityHint={item.own ? HUD_DRAWER_COPY.lookHint : undefined}
      accessibilityState={{ selected: item.selected }}
      accessibilityActions={item.own ? OWN_ACTIONS : undefined}
      onAccessibilityAction={item.own ? onAction : undefined}
      style={({ pressed }) => [
        styles.card,
        drawerFrame(item.selected, vars),
        pressed ? styles.pressed : null,
      ]}
    >
      <Swatch item={item} />
      <Text numberOfLines={NAME_LINES} style={[face, styles.name, { color: vars.text }]}>
        {item.look.name}
      </Text>
    </Pressable>
  );
}

export type DrawerLooksRowProps = {
  readonly items: readonly DrawerLook[];
  readonly onPick: (id: string) => void;
  readonly onHold: (id: string) => void;
};

export function DrawerLooksRow({ items, onPick, onHold }: DrawerLooksRowProps) {
  const paint = useDrawerPaint();
  const scroller = useScrollToNew(items.length, paint?.style.motion.loops ?? false);
  if (!paint) return null;
  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((item) => (
        <LookCard key={item.look.id} item={item} paint={paint} onPick={onPick} onHold={onHold} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: card.gap, paddingBottom: card.rowPadBottom },
  card: { width: card.width },
  pressed: { opacity: HUD_DRAWER.pressedOpacity },
  swatch: {
    height: card.swatch,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ring: {
    width: card.ring,
    height: card.ring,
    borderRadius: card.ring / 2,
    borderWidth: card.ringLine,
  },
  name: { paddingHorizontal: card.padX, paddingVertical: card.padY },
});
