// HUD's corner brackets (KS12): 14 x 1.5 pt L-shapes at all four corners in the accent at 0.7,
// as 'Automatos Command HUD.dc.html' draws them (its README says top-left and bottom-right; the
// drawing wins), inside the panel's border. Decoration: no touches, hidden from accessibility.

import { StyleSheet, View } from 'react-native';

import { HUD_BRACKET } from '../tokens/hud';
import { bracketBars } from './dress';

const BARS = bracketBars(HUD_BRACKET.length, HUD_BRACKET.thickness);

export function Brackets({ colour }: { readonly colour: string }) {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {BARS.map((bar, index) => (
        <View key={index} style={[styles.bar, bar, { backgroundColor: colour }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute' },
});
