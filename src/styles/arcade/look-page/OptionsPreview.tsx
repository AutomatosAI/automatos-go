// Options' PREVIEW window (the design kit's looks/look-preview.tsx, preview.ts's rules): a small
// dialogue window titled with the palette — Auto celebrating at the look's pixel scale beside a
// line typing at its text speed with the ▼ cursor, on the page ground inside the window border;
// the four game colours, each a swatch and its word in its colour; a selected menu item (▶ on the
// highlight) and a plain one; the accent on the page ground. It is the look being edited, so every
// change shows here at once. Reduce Motion and the pause control hold Auto on frame 1, show the
// line whole and keep the cursor on. VoiceOver hears the window once, as its title and the line.

import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { ARCADE_OPTIONS_COPY } from '../../strings';
import { ArcadeWindow } from '../parts/ArcadeWindow';
import { useArcadePaint } from '../parts/use-arcade-paint';
import { PixelSprite } from '../sprite/PixelSprite';
import { useCursorOn } from '../sprite/use-ticks';
import { useArcadeMotion } from '../use-arcade-motion';
import { useTypewriter } from '../use-typewriter';
import {
  OPTIONS_PREVIEW,
  PREVIEW_STATE,
  gameColours,
  previewLabel,
  previewTitle,
  previewTypingId,
} from './preview';

const said = ARCADE_OPTIONS_COPY.preview;
const CURSOR = ARCADE_OPTIONS_COPY.cursor;
const GAME_COLOURS = gameColours();

function Say() {
  const { look, vars, type } = useArcadePaint();
  const { moving } = useArcadeMotion();
  const typed = useTypewriter(previewTypingId(look), said.line, {
    speed: look.textSpeed,
    moving,
    streaming: false,
    whole: false,
  });
  const cursorOn = useCursorOn(moving);
  const lineStyle = type.body(OPTIONS_PREVIEW.lineSize);
  const minHeight = lineStyle.lineHeight * OPTIONS_PREVIEW.lineRows;
  return (
    <View style={[styles.say, { backgroundColor: vars.page, borderColor: vars.bd }]}>
      <PixelSprite state={PREVIEW_STATE} />
      <Text style={[lineStyle, styles.line, { color: vars.tx, minHeight }]}>
        {said.line.slice(0, typed.shown)}
        <Text style={[type.label, { color: vars.ac, opacity: cursorOn ? 1 : 0 }]}>
          {` ${said.cursor}`}
        </Text>
      </Text>
    </View>
  );
}

function Swatches() {
  const { vars, type } = useArcadePaint();
  return (
    <View style={styles.colours}>
      {GAME_COLOURS.map((colour) => (
        <View key={colour.tone} style={styles.colour}>
          <View
            style={[styles.swatch, { backgroundColor: vars[colour.tone], borderColor: vars.bd }]}
          />
          <Text style={[type.label, { color: vars[colour.tone] }]}>{colour.word}</Text>
        </View>
      ))}
    </View>
  );
}

function MenuSample() {
  const { vars, type } = useArcadePaint();
  const words = type.body(OPTIONS_PREVIEW.itemSize);
  return (
    <View style={styles.menu}>
      <View style={[styles.item, { backgroundColor: vars.hl }]}>
        <Text style={[type.label, styles.cursor, { color: vars.hlt }]}>{CURSOR}</Text>
        <Text style={[words, styles.shrink, { color: vars.hlt }]}>{said.selectedItem}</Text>
      </View>
      <View style={styles.item}>
        <View style={styles.cursor} />
        <Text style={[words, styles.shrink, { color: vars.tx }]}>{said.menuItem}</Text>
      </View>
    </View>
  );
}

export function OptionsPreview() {
  const { look, vars, type } = useArcadePaint();
  const accent = [type.body(OPTIONS_PREVIEW.lineSize), styles.accent];
  return (
    <ArcadeWindow contentStyle={styles.content}>
      <View accessible accessibilityLabel={previewLabel(look)} style={styles.inner}>
        <Text style={[type.display('panel'), { color: vars.tx2 }]}>{previewTitle(look)}</Text>
        <Say />
        <Swatches />
        <MenuSample />
        <Text style={[accent, { color: vars.ac, backgroundColor: vars.page }]}>
          {said.accentLine}
        </Text>
      </View>
    </ArcadeWindow>
  );
}

const styles = StyleSheet.create({
  content: { padding: OPTIONS_PREVIEW.sayPad },
  inner: { gap: OPTIONS_PREVIEW.gap },
  say: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: OPTIONS_PREVIEW.sayGap,
    padding: OPTIONS_PREVIEW.sayPad,
    borderWidth: OPTIONS_PREVIEW.ring,
  },
  line: { flex: 1, minWidth: OPTIONS_PREVIEW.lineMin },
  colours: { flexDirection: 'row', flexWrap: 'wrap', gap: OPTIONS_PREVIEW.colourGap },
  colour: { flexDirection: 'row', alignItems: 'center', gap: OPTIONS_PREVIEW.swatchGap },
  swatch: {
    width: OPTIONS_PREVIEW.swatch,
    height: OPTIONS_PREVIEW.swatch,
    borderWidth: OPTIONS_PREVIEW.swatchRing,
  },
  menu: { gap: OPTIONS_PREVIEW.itemGap },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH,
    paddingHorizontal: OPTIONS_PREVIEW.itemPadH,
  },
  cursor: { width: OPTIONS_PREVIEW.cursorWidth },
  shrink: { flexShrink: 1 },
  accent: {
    paddingVertical: OPTIONS_PREVIEW.accentPadV,
    paddingHorizontal: OPTIONS_PREVIEW.itemPadH,
  },
});
