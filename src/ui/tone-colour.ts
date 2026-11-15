// The token a tone's text is drawn in, pure (docs/app-standard.md rule 10.4): the tone's own
// (variants.ts TEXT_TONES), but for the accent, which reads from accent.ts so that it can be read
// in a palette whose `accent` is a ground.

import type { ColourName, Colours } from '../styles/tokens';
import { accentToken } from './accent';
import { TEXT_TONES, type TextTone } from './variants';

export function toneColour(colours: Colours, tone: TextTone): ColourName {
  return tone === 'accent' ? accentToken(colours) : TEXT_TONES[tone];
}
