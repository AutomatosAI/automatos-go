// Options' knob rows (the design kit's looks/look-controls.tsx KnobRows and the 'Phone 390'
// options): each knob a row under a 2 pt rule in the page colour — the ▶ cursor beside the label of
// the row last changed (blinking on Arcade's clock while it moves, on while still), the schema's
// label in Press Start 2P, and its choices as a radio group of square 44 pt choices on the page
// ground with the window border inside, wrapping as the width and text size need. The chosen one
// takes the highlight AND a ▶ before its word, so it is never colour alone; VoiceOver hears the
// row as a radio group named by its label and each choice as a radio, checked or not.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { ARCADE_OPTIONS_COPY } from '../../strings';
import type { ArcadeKnob } from '../look-schema';
import { useArcadePaint } from '../parts/use-arcade-paint';
import { useCursorOn } from '../sprite/use-ticks';
import { useArcadeMotion } from '../use-arcade-motion';
import { OPTIONS_PAGE, type OptionChoice, type OptionRow } from './options';

const { row, choice } = OPTIONS_PAGE;
const CURSOR = ARCADE_OPTIONS_COPY.cursor;

type ChoiceProps = {
  readonly item: OptionChoice;
  readonly onPick: () => void;
};

function Choice({ item, onPick }: ChoiceProps) {
  const { vars, type } = useArcadePaint();
  const ink = item.selected ? vars.hlt : vars.tx;
  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="radio"
      accessibilityLabel={item.label}
      accessibilityState={{ checked: item.selected }}
      style={({ pressed }) => [
        styles.choice,
        { borderColor: vars.bd, backgroundColor: item.selected ? vars.hl : vars.page },
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[type.body(choice.size), { color: ink }]}>
        {item.selected ? <Text style={[type.label, { color: ink }]}>{`${CURSOR} `}</Text> : null}
        {item.word}
      </Text>
    </Pressable>
  );
}

type RowProps = {
  readonly item: OptionRow;
  readonly cursor: boolean;
  readonly onChange: (knob: ArcadeKnob, value: string) => void;
};

function KnobRow({ item, cursor, onChange }: RowProps) {
  const { vars, type } = useArcadePaint();
  const { moving } = useArcadeMotion();
  const blinkOn = useCursorOn(cursor && moving);
  return (
    <View style={[styles.row, { borderTopColor: vars.page }]}>
      <View style={styles.head}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[
            type.label,
            styles.cursor,
            { color: vars.ac, opacity: cursor && blinkOn ? 1 : 0 },
          ]}
        >
          {CURSOR}
        </Text>
        <Text accessibilityRole="header" style={[type.label, styles.shrink, { color: vars.tx2 }]}>
          {item.title}
        </Text>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={item.title} style={styles.choices}>
        {item.choices.map((entry) => (
          <Choice key={entry.value} item={entry} onPick={() => onChange(item.knob, entry.value)} />
        ))}
      </View>
    </View>
  );
}

export type KnobRowsProps = {
  readonly rows: readonly OptionRow[];
  /** The row the ▶ cursor sits beside. */
  readonly cursor: ArcadeKnob;
  readonly onChange: (knob: ArcadeKnob, value: string) => void;
};

export function KnobRows({ rows, cursor, onChange }: KnobRowsProps) {
  return (
    <View>
      {rows.map((item) => (
        <KnobRow key={item.knob} item={item} cursor={item.knob === cursor} onChange={onChange} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: row.gap, paddingVertical: row.padV, borderTopWidth: row.rule },
  head: { flexDirection: 'row', alignItems: 'center' },
  cursor: { width: row.cursor },
  shrink: { flexShrink: 1 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: choice.gap },
  choice: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: choice.padH,
    borderWidth: choice.ring,
  },
  pressed: { transform: [{ translateX: choice.press }, { translateY: choice.press }] },
});
