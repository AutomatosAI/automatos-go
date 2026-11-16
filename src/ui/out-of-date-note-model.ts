// OutOfDateNote's logic, pure: what VoiceOver is told when the note appears. TalkBack reads the
// note through its live region; iOS has no live regions (React Native honours
// accessibilityLiveRegion on Android only), so on an iPhone the note's words are announced, once,
// when it appears, as ToastProvider announces a toast.

/** The platform as React Native names it (Platform.OS). */
export type NotePlatform = 'ios' | 'android' | 'windows' | 'macos' | 'web';

/**
 * The words to announce, or null for none: the note's words on iOS, the first time only, and
 * never a blank line. Android needs none, its live region speaks.
 */
export function noteAnnouncement(
  platform: NotePlatform,
  words: string,
  alreadyAnnounced: boolean,
): string | null {
  if (platform !== 'ios' || alreadyAnnounced) return null;
  return words.trim() === '' ? null : words;
}
