// The phrases the app's copy never uses (R12–R14), each list with the rule it enforces, and the
// minimum-age statements (R16). store-copy.test.ts reads every strings module and every product
// .tsx's literal text (copy-text.ts) against them; its ALLOWED true negatives (each an exact file
// and text, reviewed, with its reason) are the app's, in settings/store-copy.ts. Every pattern
// ignores case.

export type CopyRuleId = 'SIGNUP' | 'BILLING' | 'DELETION' | 'DATA_CLAIMS';

export type CopyRule = Readonly<{ id: CopyRuleId; rule: string; phrases: readonly RegExp[] }>;

export const SIGNUP: CopyRule = {
  id: 'SIGNUP',
  rule: 'D64: no pointer to creating an account. Both stores count a link out to sign-up as account creation, which would require deletion in the app (D63)',
  phrases: [
    /\bsign[\s-]?ups?\b/i,
    /\bcreate (?:an|one|your|a new) account\b/i,
    /\bno account(?: yet)?\s*\?/i,
    /\bdon[’']t have an account\b/i,
    /\bregister (?:for )?(?:an |one |your )?account\b/i,
    /\bget started (?:for )?free\b/i,
  ],
};

export const BILLING: CopyRule = {
  id: 'BILLING',
  rule: 'D8; Apple 3.1.1, 3.1.3: nothing about plans, credits or prices. A paused workspace says to ask its owner',
  phrases: [
    /\bcredits?\b/i,
    /\bpric(?:e|es|ed|ing)\b/i,
    /\bupgrad(?:e|es|ed|ing)\b/i,
    /\bsubscri(?:be|bed|bes|bing|ber|bers|ption|ptions)\b/i,
    /\btop(?:s|ping)?[\s-]?up\b/i,
    /\badd your own (?:api )?keys?\b/i,
    /\bbuy(?:s|ing)?\b/i,
    /\bpurchas(?:e|es|ed|ing)\b/i,
    /\bbill(?:ing|ed)\b/i,
    /\bcheckout\b/i,
    /\b(?:basic|business|pro|enterprise|starter|team|premium|free|paid|trial) (?:plan|tier)s?\b/i,
    /\btrials?\b/i,
    /[$€£¥]\s?\d/,
    /\bper (?:month|year|seat|user)\b|\/\s?(?:mo|month|yr|year)\b/i,
    /\binvoices?\b/i,
    /\bpayments?\b/i,
  ],
};

export const DELETION: CopyRule = {
  id: 'DELETION',
  rule: 'D63: the app deletes no account or workspace. A workspace is deleted in Studio; a login is removed through support',
  phrases: [
    /\b(?:delete|erase|remove|close) (?:your|my|this|the|an?) (?:account|workspace)\b/i,
    /\bdelete (?:account|workspace)\b/i,
    /\b(?:account|workspace) deletion\b/i,
  ],
};

export const DATA_CLAIMS: CopyRule = {
  id: 'DATA_CLAIMS',
  rule: "D70; connect KC16: never 'nothing leaves your server' or as broad. Even paired to an own server the app sends crash reports to Sentry, checks Expo for updates and may send push through Expo and Apple or Google",
  phrases: [
    /\bnothing (?:ever )?leaves\b/i,
    /\bnever leaves\b/i,
    /\bno data (?:is |ever )?(?:sent|leaves|shared)\b/i,
    /\b100\s?%\s?(?:local|private|on[\s-]device)\b/i,
    /\b(?:fully|completely|totally|entirely) private\b/i,
    /\bstays? entirely (?:on|in)\b/i,
    /\bstays? on your (?:phone|device|server)\b/i,
  ],
};

export const FORBIDDEN_COPY: readonly CopyRule[] = [SIGNUP, BILLING, DELETION, DATA_CLAIMS];

/** The rules a piece of copy breaks: each rule once, with the first phrase that matched. */
export function forbiddenIn(text: string): { rule: CopyRuleId; phrase: string }[] {
  return FORBIDDEN_COPY.flatMap((entry) => {
    const phrase = entry.phrases.find((pattern) => pattern.test(text));
    return phrase ? [{ rule: entry.id, phrase: phrase.source }] : [];
  });
}

/**
 * The one minimum age (R16, the owner, 16 Nov 2026, in place of D12's 16): store metadata, Terms,
 * policy and app copy. No app asks the person's age.
 */
export const MINIMUM_AGE = 18;

/** A statement of age, its number captured: '18 or older', 'aged 18', 'at least 18 years'. */
export const AGE_STATEMENTS: readonly RegExp[] = [
  /\b(\d{1,2}) ?(?:years? (?:old|of age)|or older|or over|and older|and over)\b/gi,
  /\b(?:aged?|ages|age of|minimum age(?: is| of)?) (\d{1,2})\b/gi,
  /\b(?:at least|over|under|older than|younger than) (\d{1,2}) ?(?:years?|yrs?)\b/gi,
  /\b(?:people|users|anyone|children|kids|someone|you|be) (?:over|under|aged|at least) (\d{1,2})\b/gi,
  /\b(\d{1,2})\+ ?(?:only|years?|rated|rating)\b/gi,
];

/** Every age a piece of copy states, each once ('aged 18 and over' states one age). */
export function agesIn(text: string): number[] {
  const ages = AGE_STATEMENTS.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => Number(match[1])),
  );
  return [...new Set(ages)];
}
