// The shell's paints and sizes, pure (handoff §2, D-ONE-SET): every value the top bar, the head and
// the tabs draw with is a token key or a named size here, so the screens only wire and A5 can dress
// them for Play and HUD in one place. The live word: the foundation's one stream (useLiveStatus)
// as a dot and a word, the dot pulsing (2 s, down to 35 %) only while live and never under Reduce
// Motion; every state has a word (§4.6), offline too.

import type { LiveStatus } from '../../api/live-events';
import type { ColourName, Colours, SpaceName } from '../../styles/tokens';
import type { TypeScale, TypeStyle } from '../../styles/type';
import type { TextLevel, TextTone } from '../../ui/variants';
import { SHELL_COPY } from '../strings';

export type LiveWord = {
  readonly word: string;
  readonly dot: ColourName;
  readonly tone: TextTone;
  readonly pulse: boolean;
};

const LIVE_WORDS: Readonly<Record<LiveStatus, LiveWord>> = Object.freeze({
  live: { word: SHELL_COPY.live.live, dot: 'ccLiveDot', tone: 'success', pulse: true },
  connecting: {
    word: SHELL_COPY.live.connecting,
    dot: 'mutedForeground',
    tone: 'muted',
    pulse: false,
  },
  offline: { word: SHELL_COPY.live.offline, dot: 'mutedForeground', tone: 'muted', pulse: false },
});

/** The stream's word and dot; a status this version does not know reads as offline. */
export function liveWord(status: LiveStatus, reduceMotion: boolean): LiveWord {
  const spec = LIVE_WORDS[status] ?? LIVE_WORDS.offline;
  return { ...spec, pulse: spec.pulse && !reduceMotion };
}

/** The handoff's pulse keyframes: opacity 1 → .35 → 1 over 2 s, ease-in-out. */
export const LIVE_PULSE = Object.freeze({ periodMs: 2000, lowOpacity: 0.35, dotSize: 6 });

/** Top bar: --secondary chrome, a 1 pt --border under it; back is 40 tall, a 20 pt icon at 1.6. */
export const TOP_BAR = Object.freeze({
  ground: 'secondary' as ColourName,
  rule: 'border' as ColourName,
  ruleWidth: 1,
  paddingX: 'space4' as SpaceName,
  paddingTop: 'space1' as SpaceName,
  paddingBottom: 'space2' as SpaceName,
  /** Between the live dot and its word, and the word's inset from the edge. */
  liveGap: 'space2' as SpaceName,
  liveInset: 'space3' as SpaceName,
  backHeight: 40,
  backPaddingX: 'space3' as SpaceName,
  backGap: 2,
  backIconSize: 20,
  backIconStroke: 1.6,
  backLevel: 1 as TextLevel,
  backWeight: 500 as const,
});

/** Head: 18 pt in, 14 pt under, 6 pt between; Title 1, the lede at Body 3, muted. */
export const HEAD = Object.freeze({
  paddingX: 'space8' as SpaceName,
  paddingTop: 'space8' as SpaceName,
  paddingBottom: 'space6' as SpaceName,
  gap: 'space2' as SpaceName,
  titleLevel: 1 as TextLevel,
  ledeLevel: 3 as TextLevel,
  ledeTone: 'muted' as TextTone,
  /** The lede's figures: ink, the needs clause's in the accent. */
  figureTone: 'default' as TextTone,
  needsTone: 'accent' as TextTone,
});

/** Tabs: 40 tall, 18 pt apart and in, Body 4 at 500, a 2 pt accent rule under the active one. */
export const TAB_STRIP = Object.freeze({
  height: 40,
  gap: 'space8' as SpaceName,
  paddingX: 'space8' as SpaceName,
  countGap: 'space1' as SpaceName,
  rule: 2,
  level: 4 as TextLevel,
  weight: 500 as const,
  ground: 'background' as ColourName,
  border: 'border' as ColourName,
  ruleWidth: 1,
});

export type TabPaint = { readonly color: string; readonly rule: string };

/** The active tab in ink over the accent rule; the others muted, with no rule. */
export function tabPaint(colours: Colours, selected: boolean): TabPaint {
  return selected
    ? { color: colours.foreground, rule: colours.accent }
    : { color: colours.mutedForeground, rule: 'transparent' };
}

/** The lede's figures in mono (the figure face, tabular) at the lede's own size. */
export function ledeFigureFace(type: TypeScale): Pick<TypeStyle, 'fontFamily' | 'fontVariant'> {
  return { fontFamily: type.figure3.fontFamily, fontVariant: type.figure3.fontVariant };
}
