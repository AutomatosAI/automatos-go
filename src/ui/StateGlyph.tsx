// A state's glyph (● ○ ◆ ✓ ✕) in the colour its table gives it (docs/app-standard.md rule 1.4). It
// takes the state and nothing else: the glyph and its token both come from state-tokens.ts
// stateGlyphMark, for the dress and scheme on screen, and its test measures each token as a 3:1
// mark on every ground, so no feature can hand it a colour. The glyph is decoration beside the
// state's word (rule 10.6): the word, in a Text tone, says the state, so the glyph is hidden from
// VoiceOver and TalkBack. StatusPip draws its own glyph the same way.

import type { StatusState } from '../styles/dress/status-glyphs';
import { useDress } from '../styles/dress/use-dress';
import { useTokens } from '../styles/theme';
import { stateGlyphMark } from './state-tokens';
import { Text } from './Text';

export type StateGlyphProps = {
  /** The state the glyph shows; its word beside it says it. */
  readonly state: StatusState;
};

export function StateGlyph({ state }: StateGlyphProps) {
  const { colours, scheme } = useTokens();
  const dress = useDress();
  const mark = stateGlyphMark(state, {
    glyphs: dress.status === 'glyph',
    glyphPaint: dress.glyphPaint,
    scheme,
  });
  return (
    <Text
      variant="mono"
      style={{ color: colours[mark.token] }}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {mark.glyph}
    </Text>
  );
}
