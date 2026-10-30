// The brief card's one entrance (PRD-268 §6.12.3 'Motion'): a fade with a 4 pt rise over 180 ms the
// first time a brief is drawn in this launch, a cross-fade only under Reduce Motion, and nothing when
// the same brief is drawn again (a list scrolled back, a style flipped): history never replays, as
// the thread's own rows do not. Nothing loops. Pure: the components pick the reanimated entrance.

/** §6.12.3: one entrance per component, a fade plus a 4 pt rise over 180 ms. */
export const BRIEF_ENTRANCE = Object.freeze({ durationMs: 180, risePt: 4 });

export type BriefEntrance = 'rise' | 'fade' | null;

/** Which briefs this launch has drawn, by key (the date and the state hash). */
export function createSightings() {
  let seen: ReadonlySet<string> = new Set();
  return Object.freeze({
    /** True the first time the key is seen; the key is then remembered. */
    first: (key: string): boolean => {
      if (seen.has(key)) return false;
      seen = new Set([...seen, key]);
      return true;
    },
  });
}

/** The entrance for a brief: rise the first time, a cross-fade under Reduce Motion, else none. */
export function briefEntrance(firstTime: boolean, reduceMotion: boolean): BriefEntrance {
  if (!firstTime) return null;
  return reduceMotion ? 'fade' : 'rise';
}

/** The key a brief is remembered by. */
export function briefKey(brief: { readonly date: string; readonly state_hash: string }): string {
  return `${brief.date}\n${brief.state_hash}`;
}
