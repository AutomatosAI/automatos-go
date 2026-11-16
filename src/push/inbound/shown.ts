// What a notification shows that its signature does not cover (D-SIGNATURE, KP6), held to what the
// server sends before a Reply is built from it. The server's message to a phone is its title, its
// body, the signed data, the priority, the category, the Android channel and the sound: no
// subtitle and no picture. A question push's body is its signed `question`. Its title is
// "{sender} · {badge}": the agent that asked, or Auto when none is named, and the fixed AI term of
// the phone's language (AI, IA or KI). The agent's name is not in the signed payload, so the phone
// can check only Auto's titles. A Reply is built only when the body is the signed question, the
// title is absent or one of Auto's, and the notification shows no subtitle and no picture; any other
// Reply opens the question in the app, where the server's own text is shown. Android draws a large
// picture from an image link without telling the app (the server never sends one). Pure.

import { PUSH_AI_BADGES, PUSH_TITLE_SENDER, PUSH_TITLE_SEPARATOR } from '../config';
import type { ShownText } from './parse';

/** Why a Reply may not be built from what was shown: other words, or a sender it cannot check. */
export type ShownReason = 'words_differ' | 'sender_unchecked';

const AUTO_TITLES: ReadonlySet<string> = new Set(
  PUSH_AI_BADGES.map((badge) => `${PUSH_TITLE_SENDER}${PUSH_TITLE_SEPARATOR}${badge}`),
);

function blank(text: string | null): boolean {
  return !text?.trim();
}

/** The body is the question the server signed, word for word (edge spaces aside). */
export function showsSignedQuestion(shown: string | null, signed: string | undefined): boolean {
  return !!shown && !!signed && shown.trim() === signed.trim();
}

/** No title, or one the server sets when Auto sends: one the phone can check. */
export function isCheckableTitle(title: string | null): boolean {
  return title === null || AUTO_TITLES.has(title.trim()) || blank(title);
}

/** null when everything shown is the signed question or the server's own; else why not. */
export function unboundShown(shown: ShownText, question: string | undefined): ShownReason | null {
  const onlyTheQuestion =
    showsSignedQuestion(shown.body, question) && blank(shown.subtitle) && shown.attachments === 0;
  if (!onlyTheQuestion) return 'words_differ';
  return isCheckableTitle(shown.title) ? null : 'sender_unchecked';
}
