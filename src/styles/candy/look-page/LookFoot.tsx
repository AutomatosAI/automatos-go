// Make it sweet's foot (the kit's looks/look-transfer.tsx at 3920359d5): Save look, a round pill in
// the accent with its ink, stretching, and Reset, a round pill in the chip fill — each at least 44
// pt and growing with Dynamic Type, wrapping under each other when the words need the room. Under
// them, what the last one did ('Saved as My look 2.', 'Back to Blush.'), said politely, or why a
// change was refused or not kept, said at once (an alert) in the error's text colour. The kit's
// Export and Import are not ported: the phone keeps no files.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { useStyle } from '../../theme';
import { pillPaint } from '../parts/chips';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_SWEET_COPY } from '../strings';
import { SWEET_PAGE, type SweetSaid } from './sweet';

const said = CANDY_SWEET_COPY;
const SAID_SIZE = 14;
const PAD = 22;
const PRESSED_OPACITY = 0.7;

type ActionProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly primary?: boolean;
  readonly hint?: string;
};

function Action({ label, onPress, primary = false, hint }: ActionProps) {
  const { vars, type, round } = useCandyPaint();
  const paint = pillPaint(primary);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.grow : null,
        { borderRadius: round, opacity: pressed ? PRESSED_OPACITY : 1 },
        paint.fill ? { backgroundColor: vars[paint.fill] } : null,
      ]}
    >
      <Text style={[type.button, { color: vars[paint.ink] }]}>{label}</Text>
    </Pressable>
  );
}

function SaidLine({ line }: { readonly line: SweetSaid | null }) {
  const style = useStyle();
  const { vars, type } = useCandyPaint();
  if (line === null) return null;
  const failedLine = line.kind === 'failed';
  return (
    <Text
      accessibilityRole={failedLine ? 'alert' : undefined}
      accessibilityLiveRegion={failedLine ? 'assertive' : 'polite'}
      style={[
        type.body(SAID_SIZE, 700),
        { color: failedLine ? style.tokens.colours.destructive : vars.quiet },
      ]}
    >
      {line.text}
    </Text>
  );
}

export type LookFootProps = {
  readonly said: SweetSaid | null;
  readonly onSave: () => void;
  readonly onReset: () => void;
};

export function LookFoot({ said: line, onSave, onReset }: LookFootProps) {
  return (
    <View style={styles.foot}>
      <View style={styles.row}>
        <Action label={said.saveLook} onPress={onSave} primary />
        <Action label={said.reset} onPress={onReset} hint={said.resetHint} />
      </View>
      <SaidLine line={line} />
    </View>
  );
}

const styles = StyleSheet.create({
  foot: { gap: SWEET_PAGE.foot.gap },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SWEET_PAGE.foot.gap },
  action: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: PAD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flexGrow: 1 },
});
