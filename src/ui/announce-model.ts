// useAnnounce's logic, pure (docs/app-standard.md rule 10): what VoiceOver is told, and when.
// React Native honours accessibilityLiveRegion on Android only, so TalkBack hears a polite region
// for itself and an iPhone hears nothing unless the words are announced. This decides, for one
// region's words at each run of the hook, whether to say them: on iOS, once each time they appear
// or change, never again for the same words still on screen, never a blank line; on Android never
// (its live region speaks). An occasion (a reply's id, a press's refusal) makes the same words new:
// each occasion is told once while its words are on screen. Once they have gone (hidden, null or
// blank), the same occasion coming back is a new appearance: a second press refused with the same
// frozen refusal is said again. An occasion that is an identity (`once`: a reply's id) is told
// once for good, so a reply hidden under 'Thinking' and shown again after a failed turn is not said
// again. Words that were on screen from the very first run can be left to VoiceOver to read in
// order (`quietAtFirst`), so only a later change is said.

/** The platform as React Native names it (Platform.OS). */
export type AnnouncePlatform = 'ios' | 'android' | 'windows' | 'macos' | 'web';

/** What the hook keeps between runs. */
export type Heard = Readonly<{
  /** The words on screen at the last run; null when none were showing. */
  shown: string | null;
  /**
   * The last occasion told (or let pass at the first run) while its words are on screen; undefined
   * before any, and again once they have gone, unless the occasion is told `once`.
   */
  told: unknown;
}>;

export const NOTHING_HEARD: Heard = Object.freeze({ shown: null, told: undefined });

export type AnnounceInput = Readonly<{
  platform: AnnouncePlatform;
  /** The region's words; null or blank when it says nothing. */
  words: string | null | undefined;
  /** The words are on screen (a region can hold words it does not show). */
  showing: boolean;
  /** Makes the same words new: each occasion is told once. Undefined: the words alone decide. */
  occasion?: unknown;
  /** The occasion is an identity, told once for good: its words going and coming back say nothing. */
  once?: boolean;
  /** The first run, for a region whose first words VoiceOver reads in order: say nothing yet. */
  quietAtFirst: boolean;
}>;

export type AnnounceStep = Readonly<{
  /** The words to tell VoiceOver now, or null. */
  say: string | null;
  heard: Heard;
}>;

function wordsShown(input: AnnounceInput): string | null {
  const { words, showing } = input;
  if (!showing || typeof words !== 'string' || words.trim() === '') return null;
  return words;
}

/** One run of the hook: what to say, and what to keep for the next run. */
export function announceStep(input: AnnounceInput, heard: Heard): AnnounceStep {
  const words = wordsShown(input);
  if (words === null) {
    // gone: the occasion is forgotten, so coming back is a new appearance, unless it is an identity
    const told = input.once === true ? heard.told : undefined;
    return Object.freeze({ say: null, heard: Object.freeze({ shown: null, told }) });
  }
  const byOccasion = input.occasion !== undefined;
  const fresh = byOccasion ? !Object.is(heard.told, input.occasion) : heard.shown !== words;
  const next: Heard = Object.freeze({
    shown: words,
    told: byOccasion ? input.occasion : heard.told,
  });
  const say = fresh && !input.quietAtFirst && input.platform === 'ios' ? words : null;
  return Object.freeze({ say, heard: next });
}

const ENDS_A_SENTENCE = /[.!?…]$/;

/** Parts said as sentences: blank ones dropped, a full stop after any that does not end in one. */
export function sentences(...parts: readonly (string | null | undefined)[]): string {
  return parts
    .map((part) => (part ?? '').trim())
    .filter((part) => part !== '')
    .map((part) => (ENDS_A_SENTENCE.test(part) ? part : `${part}.`))
    .join(' ');
}
