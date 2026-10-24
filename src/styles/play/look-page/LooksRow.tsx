// The looks row ('Automatos Play Looks.dc.html'): the five presets, then the saved looks, as cards
// 136 wide with a radius of 12 — an 84 pt swatch in the look's own ground with 'Aa' in its display
// face, its light as a glowing ring and its accent as a bar, over the name (Geist 600 13) and the
// sub (12). The look on is framed in the accent. A tap picks a look; a long press on a saved look
// (VoiceOver: its 'Rename, duplicate or delete' action) opens the sheet. A look just saved scrolls
// into view, without the scroll's motion under Reduce Motion.

import { useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
} from 'react-native';

import { Text } from '../../../ui';
import { PLAY_LOOK_COPY } from '../../strings';
import { lightGlow } from '../../tokens/look-page-colours';
import { useCompanionPaint, type CompanionPaint } from '../companion/use-companion';
import type { LookRowItem } from '../look-page';
import { LOOK_PAGE, optionFrame, rowSwatch, sampleFace } from './knobs';

const { row } = LOOK_PAGE;
const HOLD_ACTION = 'longpress';
const OWN_ACTIONS = Object.freeze([{ name: HOLD_ACTION, label: PLAY_LOOK_COPY.lookHint }]);

function Swatch({ item }: { readonly item: LookRowItem }) {
  const colours = rowSwatch(item.look);
  return (
    <View style={[styles.swatch, { backgroundColor: colours.ground }]}>
      <Text style={[sampleFace(item.look.font), { color: colours.text }]}>
        {PLAY_LOOK_COPY.sample}
      </Text>
      <View style={styles.marks}>
        <View
          style={[
            styles.light,
            { borderColor: colours.light, boxShadow: lightGlow(colours.light, row.lightGlow) },
          ]}
        />
        <View style={[styles.bar, { backgroundColor: colours.accent }]} />
      </View>
    </View>
  );
}

type CardProps = {
  readonly item: LookRowItem;
  readonly paint: CompanionPaint;
  readonly onPick: (id: string) => void;
  readonly onHold: (id: string) => void;
};

function LookCard({ item, paint, onPick, onHold }: CardProps) {
  const { vars, style } = paint;
  const { id } = item.look;
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === HOLD_ACTION) onHold(id);
  };
  return (
    <Pressable
      onPress={() => onPick(id)}
      onLongPress={item.own ? () => onHold(id) : undefined}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityHint={item.own ? PLAY_LOOK_COPY.lookHint : undefined}
      accessibilityState={{ selected: item.selected }}
      accessibilityActions={item.own ? OWN_ACTIONS : undefined}
      onAccessibilityAction={item.own ? onAction : undefined}
      style={({ pressed }) => [
        styles.card,
        optionFrame(item.selected, vars),
        pressed ? styles.pressed : null,
      ]}
    >
      <Swatch item={item} />
      <View style={[styles.words, { backgroundColor: vars.groundSurface }]}>
        <Text style={[style.type.body(row.nameSize, 600), { color: vars.groundText }]}>
          {item.look.name}
        </Text>
        <Text style={[style.type.body(row.subSize), { color: vars.groundText2 }]}>
          {item.look.sub}
        </Text>
      </View>
    </Pressable>
  );
}

/** A look saved since the last render scrolls the row to its end, where it lands. */
function useScrollToNew(count: number, animated: boolean) {
  const scroller = useRef<ScrollView>(null);
  const seen = useRef(count);
  useEffect(() => {
    if (count > seen.current) scroller.current?.scrollToEnd({ animated });
    seen.current = count;
  }, [count, animated]);
  return scroller;
}

export type LooksRowProps = {
  readonly items: readonly LookRowItem[];
  readonly onPick: (id: string) => void;
  readonly onHold: (id: string) => void;
};

export function LooksRow({ items, onPick, onHold }: LooksRowProps) {
  const paint = useCompanionPaint();
  const scroller = useScrollToNew(items.length, paint?.loops ?? false);
  if (!paint) return null;
  return (
    <View style={{ gap: LOOK_PAGE.sectionGap }}>
      <Text
        accessibilityRole="header"
        style={[paint.style.type.label, { color: paint.vars.groundText2 }]}
      >
        {PLAY_LOOK_COPY.looks}
      </Text>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: row.gap }}
      >
        {items.map((item) => (
          <LookCard key={item.look.id} item={item} paint={paint} onPick={onPick} onHold={onHold} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: row.width, borderRadius: row.radius, overflow: 'hidden' },
  pressed: { opacity: LOOK_PAGE.pressedOpacity },
  swatch: {
    height: row.swatchHeight,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: row.swatchPadX,
    paddingVertical: row.swatchPadY,
  },
  marks: { alignItems: 'flex-end', gap: row.marksGap },
  light: {
    width: row.light,
    height: row.light,
    borderRadius: row.light / 2,
    borderWidth: row.lightLine,
  },
  bar: { width: row.bar.width, height: row.bar.height, borderRadius: row.bar.radius },
  words: {
    paddingHorizontal: row.padX,
    paddingTop: row.padTop,
    paddingBottom: row.padBottom,
    gap: row.wordsGap,
  },
});
