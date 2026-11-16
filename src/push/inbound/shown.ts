// What a notification shows that its signature does not cover (D-SIGNATURE, KP6), held to what the
// server sends before a Reply is built from it. The server's message to a phone is its title, its
// body, the signed data, the priority, the category, the Android channel and the sound: no
// subtitle and no picture. A question push's body is its signed `question`. Its title is
// "{sender} · {badge}": the agent that asked, or Auto when none is named, and the fixed AI term of
// the phone's language (AI, IA or KI). A Reply is built only when the body is the signed question
// and the notification shows no subtitle and no picture. Its title is then Auto's own (checked
// here), none, or one the server must confirm before the Reply posts: the agent's name is not in
// the signed payload, so confirm-sender.ts reads who asked from the server. Android draws a large
// picture from an image link without telling the app (the server never sends one). Pure.

import { PUSH_AI_BADGES, PUSH_TITLE_SENDER, PUSH_TITLE_SEPARATOR } from '../config';
import type { ShownText } from './parse';

/** "{sender} · AI", "· IA" and "· KI": the titles the server sets for one sender. */
export function titlesOf(sender: string): ReadonlySet<string> {
  return new Set(PUSH_AI_BADGES.map((badge) => `${sender}${PUSH_TITLE_SEPARATOR}${badge}`));
}

const AUTO_TITLES = titlesOf(PUSH_TITLE_SENDER);

function blank(text: string | null): boolean {
  return !text?.trim();
}

/** The body is the question the server signed, word for word (edge spaces aside). */
export function showsSignedQuestion(shown: string | null, signed: string | undefined): boolean {
  return !!shown && !!signed && shown.trim() === signed.trim();
}

/** Something shown is not the signed question: another body, a subtitle or a picture. */
export function wordsUnbound(shown: ShownText, question: string | undefined): boolean {
  const onlyTheQuestion =
    showsSignedQuestion(shown.body, question) && blank(shown.subtitle) && shown.attachments === 0;
  return !onlyTheQuestion;
}

/** The title the server must confirm before a Reply posts; null for none or one of Auto's. */
export function titleToConfirm(title: string | null): string | null {
  if (title === null || blank(title) || AUTO_TITLES.has(title.trim())) return null;
  return title.trim();
}
