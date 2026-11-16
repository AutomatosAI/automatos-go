// The token a tone's text is drawn in, pure (docs/app-standard.md rules 2.1 and 10.4): the tone's
// own (variants.ts TEXT_TONES), but for the accent, which reads from accent.ts so that it can be read
// in a palette whose `accent` is a ground. A feature names a tone and never a colour: the two
// quieter inks (muted, the muted foreground; subtle, the quietest, fg3) and a state's words in the
// ink that reads as text (success olive, info navy, warning warn-ink, danger the destructive red).
// A state's glyph is a mark in its role, which is state-tokens.ts's, not a tone.

import type { ColourName, Colours } from '../styles/tokens';
import { accentToken } from './accent';
import { TEXT_TONES, type TextTone } from './variants';

export function toneColour(colours: Colours, tone: TextTone): ColourName {
  return tone === 'accent' ? accentToken(colours) : TEXT_TONES[tone];
}
