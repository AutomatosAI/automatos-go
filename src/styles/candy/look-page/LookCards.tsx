// Make it sweet's looks (the kit's looks/look-presets.tsx at 3920359d5): the three presets as cards
// on the window's fill with rs corners and the tinted shadow, each a small picture of its palette
// (a gradient card of its first set over its page colour, painted in that preset's own look by a
// StyleScope of its own) over its name and line; then the person's saved looks as pills. Both are
// radio groups: the look Candy paints is checked, ringed in the accent (a preset) or filled with it
// (a saved look), and carries a ✓ before its name, never colour alone. A tap picks a look; a long
// press on a saved look (VoiceOver: its 'Rename or delete' action) opens the sheet. A preset is
// never renamed or deleted, so it offers neither.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { StyleScope } from '../../provider/StyleScope';
import { builtinChoice } from '../../registry/style-id';
import { CANDY_LEADING } from '../../typeface/candy-type';
import type { CandyLooks } from '../candy-looks';
import { pillPaint } from '../parts/chips';
import { GradientCard } from '../parts/GradientCard';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_SWEET_COPY } from '../strings';
import { SWEET_PAGE, presetItems, savedItems, type LookItem } from './sweet';

const CANDY = builtinChoice('candy');
const said = CANDY_SWEET_COPY;
const { preset } = SWEET_PAGE;
const HOLD_ACTION = 'longpress';
const OWN_ACTIONS = Object.freeze([{ name: HOLD_ACTION, label: said.savedHint }]);
const PRESSED_OPACITY = 0.7;
const SUB_SIZE = 13;

/** The look's name, with the ✓ before it while it is the one on (hidden from VoiceOver). */
function chosenName(item: LookItem): string {
  return item.selected ? `${said.chosen} ${item.look.name}` : item.look.name;
}

/** A preset's picture: its page colour under a card in its first gradient, in its own look. */
function Picture() {
  const { vars, rs } = useCandyPaint();
  return (
    <View style={[styles.picture, { backgroundColor: vars.page, borderRadius: rs }]}>
      <GradientCard set={1} style={styles.fill} shadow={false} />
    </View>
  );
}

type CardProps = { readonly item: LookItem; readonly onPick: (id: string) => void };

function PresetCard({ item, onPick }: CardProps) {
  const { vars, type, rs, shadow } = useCandyPaint();
  const ring = item.selected ? vars.accent : vars.win;
  return (
    <Pressable
      onPress={() => onPick(item.look.id)}
      accessibilityRole="radio"
      accessibilityLabel={item.label}
      accessibilityState={{ checked: item.selected }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: vars.win,
          borderColor: ring,
          borderRadius: rs,
          opacity: pressed ? PRESSED_OPACITY : 1,
        },
        shadow,
      ]}
    >
      <StyleScope choice={CANDY} look={item.look}>
        <Picture />
      </StyleScope>
      <Text style={[type.display('panel'), { color: vars.text }]}>{chosenName(item)}</Text>
      <Text
        style={[type.body(SUB_SIZE, 700, { leading: CANDY_LEADING.label }), { color: vars.quiet }]}
      >
        {item.look.sub}
      </Text>
    </Pressable>
  );
}

type SavedProps = CardProps & { readonly onHold: (id: string) => void };

function SavedLook({ item, onPick, onHold }: SavedProps) {
  const { vars, type, round } = useCandyPaint();
  const paint = pillPaint(item.selected);
  const { id } = item.look;
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === HOLD_ACTION) onHold(id);
  };
  return (
    <Pressable
      onPress={() => onPick(id)}
      onLongPress={() => onHold(id)}
      accessibilityRole="radio"
      accessibilityLabel={item.label}
      accessibilityHint={said.savedHint}
      accessibilityState={{ checked: item.selected }}
      accessibilityActions={OWN_ACTIONS}
      onAccessibilityAction={onAction}
      style={({ pressed }) => [
        styles.pill,
        { borderRadius: round, opacity: pressed ? PRESSED_OPACITY : 1 },
        paint.fill ? { backgroundColor: vars[paint.fill] } : null,
      ]}
    >
      <Text style={[type.button, { color: vars[paint.ink] }]}>{chosenName(item)}</Text>
    </Pressable>
  );
}

type GroupProps = { readonly title: string; readonly children: ReactNode };

function Group({ title, children }: GroupProps) {
  const { vars, type } = useCandyPaint();
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={[type.display('snag'), { color: vars.text }]}>
        {title}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={title} style={styles.wrap}>
        {children}
      </View>
    </View>
  );
}

export type LookCardsProps = {
  readonly looks: CandyLooks;
  readonly onPick: (id: string) => void;
  readonly onHold: (id: string) => void;
};

export function LookCards({ looks, onPick, onHold }: LookCardsProps) {
  const saved = savedItems(looks);
  return (
    <>
      <Group title={said.presets}>
        {presetItems(looks).map((item) => (
          <PresetCard key={item.look.id} item={item} onPick={onPick} />
        ))}
      </Group>
      {saved.length === 0 ? null : (
        <Group title={said.saved}>
          {saved.map((item) => (
            <SavedLook key={item.look.id} item={item} onPick={onPick} onHold={onHold} />
          ))}
        </Group>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: SWEET_PAGE.sectionGap },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: preset.gap },
  card: {
    flexGrow: 1,
    flexBasis: preset.minWidth,
    padding: preset.pad,
    gap: preset.line,
    borderWidth: preset.ring,
  },
  picture: {
    height: preset.picture,
    padding: preset.inset,
    marginBottom: preset.inset,
    overflow: 'hidden',
  },
  fill: { flex: 1 },
  pill: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: preset.pad + preset.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
