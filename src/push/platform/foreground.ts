// What a push received while the app is open shows (PRD-001 §4.8, KP14, KP15), decided in one
// pure place. Unverified shows nothing. Verified shows its banner and list entry, with a sound for
// a question only; the server's pushes carry no badge and the badge is the needs-you number set
// while the app runs (KP14), so shouldSetBadge is always false. When the person is already on the
// push's target there is no banner and no sound, only the list entry: on Android a sound is what
// raises the heads-up alert (expo-notifications 0.32.17, NotificationBehavior: "shouldPlaySound:
// false will result in the drop-down notification alert not showing"), so a sound would bring the
// banner back. The category is unsigned: it chooses only the sound of a push that verified.
// FOREGROUND_VERIFY_TIMEOUT_MS (2 s) sits inside expo-notifications' own iOS budget of 3 s
// (ios/…/Handler/SingleNotificationHandlerTask.swift), after which nothing is shown.

import { FOREGROUND_VERIFY_TIMEOUT_MS } from '../config';
import { isQuestionCategory } from './categories';
import type { Presentation } from './port';

export type PresentationInput = Readonly<{
  /** The push verified within FOREGROUND_VERIFY_TIMEOUT_MS (a timeout is false). */
  verified: boolean;
  /** request.content.categoryIdentifier as received. */
  category: string | null;
  /** The person is already on the screen the push links to. */
  onScreen: boolean;
}>;

/** Unverified, timed out or failed: no banner, no list entry, no sound. */
export const SHOW_NOTHING: Presentation = Object.freeze({
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
});

export function presentationFor({ verified, category, onScreen }: PresentationInput): Presentation {
  if (!verified) return SHOW_NOTHING;
  return Object.freeze({
    shouldShowBanner: !onScreen,
    shouldShowList: true,
    shouldPlaySound: !onScreen && isQuestionCategory(category),
    shouldSetBadge: false,
  });
}

/** The check's answer within the budget: true only for true; a timeout or a failure is false. */
export async function verifiedWithin(
  check: () => Promise<boolean>,
  timeoutMs: number = FOREGROUND_VERIFY_TIMEOUT_MS,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const answered = Promise.resolve()
    .then(check)
    .then(
      (verified) => verified === true,
      () => false,
    );
  try {
    return await Promise.race([answered, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}
