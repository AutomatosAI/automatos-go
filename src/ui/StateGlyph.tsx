// A state's glyph (● ○ ◆ ✓ ✕) in the colour role its table gives it (docs/app-standard.md rule
// 1.4): state-tokens.ts statePaint or glyphToken picks the role, and its test measures each as a
// 3:1 mark on every ground. The glyph is never alone: the state's word beside it takes a Text tone
// (StateMarkSpec, MarkSpec), so a feature names a state and its role, never a colour. StatusPip
// draws its own glyph the same way.

import { useTokens } from '../styles/theme';
import type { ColourName } from '../styles/tokens';
import { Text } from './Text';

export type StateGlyphProps = {
  readonly glyph: string;
  /** The role the state's table gives the glyph (state-tokens.ts statePaint, glyphToken). */
  readonly role: ColourName;
};

export function StateGlyph({ glyph, role }: StateGlyphProps) {
  const { colours } = useTokens();
  return (
    <Text variant="mono" style={{ color: colours[role] }}>
      {glyph}
    </Text>
  );
}
