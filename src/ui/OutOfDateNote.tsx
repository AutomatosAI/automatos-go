// The line over data that is out of date (docs/app-standard.md rule 6.4): a list keeps what it last
// had when a refresh fails (and what the phone kept from the last time it was open), and this says
// so, quietly, in the feature's own words, above it. It is not the failed state: the data stays on
// screen, and a refresh tries again. TalkBack hears it through its live region; VoiceOver is told
// it once, when it appears (iOS has no live regions: useAnnounce).

import { Text } from './Text';
import { useAnnounce } from './use-announce';
import type { TextLevel } from './variants';

const NOTE_LEVEL: TextLevel = 5;

export type OutOfDateNoteProps = {
  /** The feature's words for its own data (its strings.ts), never the loading or failed words. */
  readonly words: string;
  /** The list's own side padding, so the line sits over the rows. */
  readonly inset?: number;
};

export function OutOfDateNote({ words, inset = 0 }: OutOfDateNoteProps) {
  useAnnounce(words);
  return (
    <Text
      level={NOTE_LEVEL}
      tone="muted"
      accessibilityLiveRegion="polite"
      style={{ paddingHorizontal: inset }}
    >
      {words}
    </Text>
  );
}
