// Options' main window (the design kit's looks/look-editor.tsx EditorBody and the 'Phone 390'
// options): the knob rows, the note on reduced motion, SAVE LOOK (the accent, a new save slot
// from the look on screen) and RESET (the palette's preset as it ships), and under them what the
// last action did — a polite status for a success, an alert in HP red for a refusal or a change
// the phone could not keep (look-transfer.tsx SaidLine).

import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { ARCADE_OPTIONS_COPY } from '../../strings';
import type { ArcadeKnob } from '../look-schema';
import { ArcadeButton } from '../parts/ArcadeButton';
import { ArcadeWindow } from '../parts/ArcadeWindow';
import { useArcadePaint } from '../parts/use-arcade-paint';
import { KnobRows } from './KnobRows';
import { OPTIONS_PAGE, type OptionRow, type OptionsSaid } from './options';

const said = ARCADE_OPTIONS_COPY;

function SaidLine({ line }: { readonly line: OptionsSaid | null }) {
  const { vars, type } = useArcadePaint();
  if (line === null) return null;
  const failedLine = line.kind === 'failed';
  return (
    <Text
      accessibilityRole={failedLine ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[type.body(OPTIONS_PAGE.noticeSize), { color: failedLine ? vars.hp : vars.tx }]}
    >
      {line.text}
    </Text>
  );
}

export type OptionsWindowProps = {
  readonly rows: readonly OptionRow[];
  readonly cursor: ArcadeKnob;
  readonly said: OptionsSaid | null;
  readonly onChange: (knob: ArcadeKnob, value: string) => void;
  readonly onSave: () => void;
  readonly onReset: () => void;
};

export function OptionsWindow(props: OptionsWindowProps) {
  const { vars, type } = useArcadePaint();
  return (
    <ArcadeWindow contentStyle={styles.content}>
      <KnobRows rows={props.rows} cursor={props.cursor} onChange={props.onChange} />
      <Text style={[type.body(OPTIONS_PAGE.noticeSize), { color: vars.tx2 }]}>
        {said.motionNote}
      </Text>
      <View style={styles.actions}>
        <ArcadeButton kind="primary" label={said.saveLook} onPress={props.onSave} />
        <ArcadeButton label={said.reset} hint={said.resetHint} onPress={props.onReset} />
      </View>
      <SaidLine line={props.said} />
    </ArcadeWindow>
  );
}

const styles = StyleSheet.create({
  content: { padding: OPTIONS_PAGE.windowPad, gap: OPTIONS_PAGE.windowGap },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: OPTIONS_PAGE.actionsGap },
});
