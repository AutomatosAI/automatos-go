// Options' save slots (the design kit's looks/look-controls.tsx SaveSlots and look-editor.tsx's
// 'Save slots' window): the five presets, then the person's looks, one under another — each a
// square slot on the page ground with the window border inside, its name over its line. The look
// on screen takes the highlight AND the ▶ cursor before its name (never colour alone). A tap picks
// a look; a long press on a person's own look (VoiceOver: its 'Rename or delete' action) opens the
// sheet. A preset is never renamed or deleted, so it offers neither.

import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { ARCADE_OPTIONS_COPY } from '../../strings';
import { ArcadeWindow } from '../parts/ArcadeWindow';
import { useArcadePaint } from '../parts/use-arcade-paint';
import { OPTIONS_PAGE, type SaveSlot } from './options';

const { slot } = OPTIONS_PAGE;
const said = ARCADE_OPTIONS_COPY;
const HOLD_ACTION = 'longpress';
const OWN_ACTIONS = Object.freeze([{ name: HOLD_ACTION, label: said.slotHint }]);

type SlotProps = {
  readonly item: SaveSlot;
  readonly onPick: (id: string) => void;
  readonly onHold: (id: string) => void;
};

function Slot({ item, onPick, onHold }: SlotProps) {
  const { vars, type } = useArcadePaint();
  const { id, name, sub } = item.look;
  const ink = item.selected ? vars.hlt : vars.tx;
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === HOLD_ACTION) onHold(id);
  };
  return (
    <Pressable
      onPress={() => onPick(id)}
      onLongPress={item.own ? () => onHold(id) : undefined}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityHint={item.own ? said.slotHint : undefined}
      accessibilityState={{ selected: item.selected }}
      accessibilityActions={item.own ? OWN_ACTIONS : undefined}
      onAccessibilityAction={item.own ? onAction : undefined}
      style={({ pressed }) => [
        styles.slot,
        { borderColor: vars.bd, backgroundColor: item.selected ? vars.hl : vars.page },
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[type.body(slot.nameSize, 600), { color: ink }]}>
        {item.selected ? (
          <Text style={[type.label, { color: ink }]}>{`${said.cursor} `}</Text>
        ) : null}
        {name}
      </Text>
      {sub === '' ? null : (
        <Text style={[type.body(slot.subSize), { color: item.selected ? vars.hlt : vars.tx2 }]}>
          {sub}
        </Text>
      )}
    </Pressable>
  );
}

export type SaveSlotsProps = {
  readonly slots: readonly SaveSlot[];
  readonly onPick: (id: string) => void;
  readonly onHold: (id: string) => void;
};

export function SaveSlots({ slots, onPick, onHold }: SaveSlotsProps) {
  const { vars, type } = useArcadePaint();
  return (
    <ArcadeWindow contentStyle={styles.content}>
      <Text accessibilityRole="header" style={[type.display('panel'), { color: vars.tx2 }]}>
        {said.slots}
      </Text>
      <View style={styles.list}>
        {slots.map((item) => (
          <Slot key={item.look.id} item={item} onPick={onPick} onHold={onHold} />
        ))}
      </View>
    </ArcadeWindow>
  );
}

const styles = StyleSheet.create({
  content: { padding: OPTIONS_PAGE.windowPad, gap: OPTIONS_PAGE.windowGap },
  list: { gap: slot.gap },
  slot: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingVertical: slot.padV,
    paddingHorizontal: slot.padH,
    borderWidth: slot.ring,
  },
  pressed: { transform: [{ translateX: slot.press }, { translateY: slot.press }] },
});
