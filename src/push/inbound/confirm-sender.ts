// A Reply under a title the phone cannot check by itself (shown.ts titleToConfirm: an agent's
// name, which the signed payload does not carry): before it posts, the question its signed
// grant_id names is read from the server with the person's own sign-in (the open questions the
// Questions screen lists, links/stale.ts askedQuestion), within STALE_CHECK_TIMEOUT_MS. It posts
// only when the server still has the question open, its words are the signed question's, and the
// title is exactly "{the agent the server says asked} · AI", "· IA" or "· KI": then the sender
// shown is the one the server names. Nothing from the notification's text chooses what is read.
// The words are compared with the marks a question's markdown may hold (emphasis, code, strike,
// headings, quotes, list dashes) and the spaces left out on both sides, since the server sends a
// question's plain text; a question with a link, a picture or more than 500 characters does not
// match, and is answered in the app. A read that fails (no network, no answer in time, a refusal)
// posts nothing. Pure over its port; never throws. Logs carry kinds only.

import { logger } from '../../lib/logger';
import type { AskedQuestion } from '../api';
import { STALE_CHECK_TIMEOUT_MS } from '../config';
import { probe, type StaleChecks } from '../links/stale';
import { titlesOf } from './shown';

/** What a Reply's title and question must be confirmed against. */
export type SenderToConfirm = Readonly<{ title: string; question: string }>;

/** Posted once confirmed; otherwise why not (outcomes.ts says it). */
export type SenderCheck =
  'confirmed' | 'question_closed' | 'words_differ' | 'sender_unchecked' | 'read_failed';

const MARKS = /[*_`~#>]/g;
const LIST_DASH = /^[ \t]*[-+][ \t]+/gm;
const SPACES = /\s+/g;

function wordsOf(text: string): string {
  return text.replace(LIST_DASH, '').replace(MARKS, '').replace(SPACES, ' ').trim();
}

/** The server's question and the signed one say the same words, marks and spaces aside. */
export function sameWords(asked: string, signed: string): boolean {
  const words = wordsOf(signed);
  return words !== '' && wordsOf(asked) === words;
}

/** The title is "{asker} · {badge}" for the agent the server says asked. */
export function titleNames(title: string, asker: string | null): boolean {
  const name = asker?.trim();
  return !!name && titlesOf(name).has(title.trim());
}

/** What the server's answer decides; null is a question not among the open ones. */
export function senderVerdict(
  asked: AskedQuestion | null,
  confirm: SenderToConfirm,
): Exclude<SenderCheck, 'read_failed'> {
  if (!asked?.open) return 'question_closed';
  if (!sameWords(asked.words, confirm.question)) return 'words_differ';
  return titleNames(confirm.title, asked.asker) ? 'confirmed' : 'sender_unchecked';
}

/** Reads the question by its signed grant id and decides; a read that fails posts nothing. */
export async function confirmSender(
  confirm: SenderToConfirm,
  grantId: string,
  checks: Pick<StaleChecks, 'askedQuestion'>,
  timeoutMs: number = STALE_CHECK_TIMEOUT_MS,
): Promise<SenderCheck> {
  const read = await probe((signal) => checks.askedQuestion(grantId, signal), timeoutMs);
  if ('failed' in read) {
    logger.warn('[push] could not read the question a reply answers', read.failed);
    return 'read_failed';
  }
  return senderVerdict(read.found, confirm);
}
