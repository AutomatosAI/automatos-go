// Arcade's preview: the handheld in miniature, in the default palette (Overworld, whatever look the
// phone keeps) — the status bar with the wordmark and today's counters (no pause control: nothing
// here moves), the dialogue window tabbed AUTO with Auto's sprite still and his state word over the
// home's line, and the D-pad's four arrows beside it. The ▼ cursor stays on: the picker draws no
// pause control, so nothing loops here (P001A-RVW-1, WCAG 2.2.2).

import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { ARCADE_DEFAULT_LOOK } from '../../arcade/look-schema';
import { ArcadeWindow } from '../../arcade/parts/ArcadeWindow';
import { DPAD_GRID, type DPadCell } from '../../arcade/parts/pad-grid';
import { StatusBar } from '../../arcade/parts/StatusBar';
import { useArcadePaint } from '../../arcade/parts/use-arcade-paint';
import { PixelSprite } from '../../arcade/sprite/PixelSprite';
import { StyleScope } from '../../provider/StyleScope';
import { builtinChoice } from '../../registry/style-id';
import { ARCADE_COPY } from '../../strings';
import { PREVIEW, arcadePreviewWords } from '../cards';

const ARCADE = builtinChoice('arcade');
const { arcade } = PREVIEW;
const WORDS = arcadePreviewWords();

function PadCell({ cell }: { readonly cell: DPadCell }) {
  const { vars, type } = useArcadePaint();
  const box = { width: arcade.padCell, height: arcade.padCell };
  if (cell === null) return <View style={box} />;
  const framed = [styles.cell, box, { backgroundColor: vars.page, borderColor: vars.bd }];
  if (cell === 'hub') return <View style={framed} />;
  return (
    <View style={framed}>
      <Text style={[type.label, { color: vars.tx }]}>{ARCADE_COPY.dpad[cell].arrow}</Text>
    </View>
  );
}

function MiniPad() {
  return (
    <View>
      {DPAD_GRID.map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((cell, column) => (
            <PadCell key={column} cell={cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Dialogue() {
  const { vars, type } = useArcadePaint();
  return (
    <ArcadeWindow
      title={ARCADE_COPY.dialogue.speaker}
      style={styles.grow}
      contentStyle={styles.say}
    >
      <View style={[styles.portrait, { backgroundColor: vars.page, borderColor: vars.bd }]}>
        <PixelSprite state="idle" still />
      </View>
      <View style={styles.words}>
        <Text style={[type.display('status'), { color: vars.tx2 }]}>{WORDS.state}</Text>
        <Text style={[type.body(arcade.lineSize), { color: vars.tx }]}>
          {WORDS.line}
          <Text style={[type.label, { color: vars.ac }]}>{` ${ARCADE_COPY.dialogue.cursor}`}</Text>
        </Text>
      </View>
    </ArcadeWindow>
  );
}

function Handheld() {
  const { vars } = useArcadePaint();
  return (
    <View style={[styles.ground, { backgroundColor: vars.page }]}>
      <StatusBar counters={arcade.counters} pause={false} />
      <View style={styles.console}>
        <Dialogue />
        <MiniPad />
      </View>
    </View>
  );
}

export function ArcadePreview() {
  return (
    <StyleScope choice={ARCADE} look={ARCADE_DEFAULT_LOOK}>
      <Handheld />
    </StyleScope>
  );
}

const styles = StyleSheet.create({
  ground: { minHeight: PREVIEW.minHeight, padding: arcade.pad, gap: arcade.gap },
  console: { flexDirection: 'row', alignItems: 'flex-end', gap: arcade.gap },
  grow: { flex: 1, minWidth: 0 },
  say: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: arcade.gap,
    padding: arcade.windowPad,
  },
  portrait: { padding: arcade.portraitPad, borderWidth: arcade.ring },
  words: { flex: 1, minWidth: 0, gap: arcade.portraitPad },
  row: { flexDirection: 'row' },
  cell: { alignItems: 'center', justifyContent: 'center', borderWidth: arcade.ring },
});
