// The status bar's counters, pure (PRD-001 §4.6.1 D-ARC-6; README 'Pages'; the design kit's
// frame/today.tsx at 034fa629c, sha256
// 48a71c230faa9da24c9db4f35227b0ef1f4b21c4a72af8d2204b2706d0790b12): XP is what was done today,
// ! what needs you and QUEST what is in progress, each a game word in its game colour (XP gold,
// quest yellow, mana blue, each measured on the window ground its chip sits on) and a number, and
// in words for VoiceOver ('3 done today'). The home feeds numbers the app already fetches; a
// counter it cannot know is null and left out, never shown as 0. Pure: no React, React Native,
// Expo or Skia.

import { ARCADE_COPY } from '../../strings';

export const COUNTER_KEYS = Object.freeze(['xp', 'needs', 'quest'] as const);
export type CounterKey = (typeof COUNTER_KEYS)[number];

/** The home's numbers: null where the app has no such number (XP without completion times). */
export type CounterValues = Readonly<Record<CounterKey, number | null>>;

/** Each counter's game colour, by the palette's variable names. */
export const COUNTER_TONES: Readonly<Record<CounterKey, 'xp' | 'qs' | 'mp'>> = Object.freeze({
  xp: 'xp',
  needs: 'qs',
  quest: 'mp',
});

export type Counter = {
  readonly key: CounterKey;
  /** The game word on screen (hidden from VoiceOver). */
  readonly game: string;
  readonly value: string;
  /** What VoiceOver hears: '2 need you'. */
  readonly label: string;
  readonly tone: 'xp' | 'qs' | 'mp';
};

/** The counters to show, in XP, !, QUEST order; null ones (or a number that is not one) left out. */
export function statusCounters(values: CounterValues): readonly Counter[] {
  const shown = COUNTER_KEYS.flatMap((key) => {
    const value = values[key];
    if (value === null || !Number.isFinite(value)) return [];
    const copy = ARCADE_COPY.counters[key];
    const count = Math.max(0, Math.floor(value));
    return [
      Object.freeze({
        key,
        game: copy.game,
        value: String(count),
        label: copy.words(count),
        tone: COUNTER_TONES[key],
      }),
    ];
  });
  return Object.freeze(shown);
}
