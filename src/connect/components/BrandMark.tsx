// The Automatos sail mark on Welcome (src/ui has no brand mark: KC2's adapter). The image is the
// trimmed Studio mark the splash screen uses (assets/brand/SOURCES.md, 321×394, transparent around
// it), so it sits on every ground. Decorative: the title beside it says 'Automatos Go'.

import { Image, StyleSheet } from 'react-native';

/** assets/brand/splash.png's own size, for its aspect ratio. */
const MARK_WIDTH = 321;
const MARK_HEIGHT = 394;
const DEFAULT_HEIGHT = 64;

// Metro resolves the asset at build time (a PNG has no import declaration in this project)
const MARK = require('../../../assets/brand/splash.png');

export type BrandMarkProps = { readonly height?: number };

export function BrandMark({ height = DEFAULT_HEIGHT }: BrandMarkProps) {
  return (
    <Image
      source={MARK}
      style={[styles.mark, { height, width: (height * MARK_WIDTH) / MARK_HEIGHT }]}
      resizeMode="contain"
      accessible={false}
      importantForAccessibility="no"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  mark: { alignSelf: 'flex-start' },
});
