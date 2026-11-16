// The text tone audit's true negatives (text-tones.test.ts, rules 2.1 and 1.4): each a file and the
// exact colours it hands Text there, reviewed, with its reason. Outside src/ui/ a feature names a
// tone, never a colour; what is listed here paints a palette no shared tone names (a style's own
// chrome, rule 17; the voice core's paint) or a control's own pairing from its lookup. A new colour
// fails the audit until it is a tone or is listed here with a reason; a listed one that is gone
// fails it too. A style's own chrome is listed in text-tones-styles.ts.

import { STYLE_CHROME } from './text-tones-styles';

export type AllowedColour = Readonly<{
  file: string;
  /** The colours as the audit reads them: 'color: vars.tx', or 'color' written alone. */
  texts: readonly string[];
  reason: string;
}>;

const allow = (file: string, reason: string, ...texts: string[]): AllowedColour =>
  Object.freeze({ file, texts: Object.freeze(texts), reason });

const CONTROL_FILL =
  "Text on a control's own ground, from the lookup that pairs it (rule 10.4: a pairing is never a new tone): the dress's chosen and resting chip (src/styles/dress/cc-dress.ts dressedStripCell) and its resting pill (src/ui/dressed.ts dressedPillPaint), as the Pill primitive draws its own label.";
const DRESS_MARK =
  "The style's mark, chosen by the dress (src/styles/dress/cc-dress.ts markToken, shellTabPaint, shellTitle): the chosen tab's word in Studio's and Play's ink, HUD's and Candy's primary or Arcade's accent, and HUD's and Arcade's title run in primary. No tone gives HUD's primary: the accent tone is HUD's error red.";
const VOICE_CORE =
  "The voice core's paint (D-ONE-VOICE, D60; src/styles/tokens/voice-colours.ts voicePaint): the voice screen's words in each style's own text, text2 and accent, from HUD's, Play's, Arcade's and Candy's own variables and Studio's ink and orange. HUD's and Arcade's accent there is their primary, which no one shared tone gives.";
const AI_LABEL =
  "The AI label (D-AI-LABEL, D73): React Native's own Text in the scale's undressed face and the muted token, as src/styles/__tests__/ai-label.test.ts requires of it and measures at AA on every built-in style's background. A tone needs the Text primitive, whose face the dress may change.";

export const ALLOWED: readonly AllowedColour[] = [
  allow('src/cc/calendar/DayStrip.tsx', CONTROL_FILL, 'color: paint.color'),
  allow('src/voice/language/LanguageChip.tsx', CONTROL_FILL, 'color: ink'),
  allow('src/cc/shell/Head.tsx', DRESS_MARK, 'color: colours.primary'),
  allow('src/cc/shell/TabStrip.tsx', DRESS_MARK, 'color'),
  allow('src/brief/HudBrief.tsx', VOICE_CORE, 'color: core.paint.text', 'color: core.paint.text2'),
  allow('src/styles/hud/core/CoreFold.tsx', VOICE_CORE, 'color: paint.accent'),
  allow(
    'src/styles/hud/core/HudButtons.tsx',
    VOICE_CORE,
    'color: ink',
    'color: lit ? paint.accentInk : paint.accent',
    'color: paint.text',
  ),
  allow(
    'src/styles/hud/core/HudTopBar.tsx',
    VOICE_CORE,
    'color: core.paint.text2',
    'color: mic.live ? paint.accent : paint.text2',
    'color: paint.accent',
    'color: paint.text',
  ),
  allow('src/styles/hud/core/StateChip.tsx', VOICE_CORE, 'color: paint.accent'),
  allow(
    'src/styles/hud/core/Transcript.tsx',
    VOICE_CORE,
    'color: colour',
    'color: core.paint.text2',
  ),
  allow(
    'src/suggestions/HudNext.tsx',
    VOICE_CORE,
    'color: core.paint.accent',
    'color: core.paint.text',
    'color: core.paint.text2',
  ),
  allow('src/styles/ai-label.tsx', AI_LABEL, 'color: colours[AI_LABEL_TONE]'),
  ...STYLE_CHROME,
];
