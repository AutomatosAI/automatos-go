// The app's one way to tell VoiceOver something (docs/app-standard.md rule 10): a region whose
// words appear or change while the person is on the screen calls this beside its
// accessibilityLiveRegion. TalkBack hears the live region; iOS has none, so on an iPhone the words
// are announced, once each time they appear or change (announce-model.ts decides). It runs after a
// render only when the words, whether they show, or the occasion change, never on every render.
// This is the only file that calls AccessibilityInfo.announceForAccessibility
// (src/release/__tests__/announcements.test.ts).
//
// A line that also carries an age ("Updated 2 min ago") has new words each time the age changes,
// so it is said again each time. Pass the words without the age, so only a change in what the line
// says is told, and keep the age outside the live region, which TalkBack would read again too.

import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { NOTHING_HEARD, announceStep, type Heard } from './announce-model';

export type AnnounceOptions = {
  /**
   * Makes the same words new (a press's refusal): each occasion is told once while its words are
   * on screen, and again if they go and it comes back.
   */
  readonly occasion?: unknown;
  /** The occasion is an identity (a reply's id), told once for good even if its words go and return. */
  readonly once?: boolean;
  /**
   * The region is on screen from the start and its words change later (a status line): the words
   * it opens with are left to VoiceOver to read in order, and only a change is said.
   */
  readonly changesOnly?: boolean;
};

/** Tells VoiceOver `words` while `showing`, once each time they appear or change (iOS only). */
export function useAnnounce(
  words: string | null | undefined,
  showing: boolean = true,
  options: AnnounceOptions = {},
): void {
  const { occasion, once = false, changesOnly = false } = options;
  const heard = useRef<Heard>(NOTHING_HEARD);
  const first = useRef(true);
  useEffect(() => {
    const quietAtFirst = first.current && changesOnly;
    first.current = false;
    const step = announceStep(
      { platform: Platform.OS, words, showing, occasion, once, quietAtFirst },
      heard.current,
    );
    heard.current = step.heard;
    if (step.say !== null) AccessibilityInfo.announceForAccessibility(step.say);
  }, [words, showing, occasion, once, changesOnly]);
}
