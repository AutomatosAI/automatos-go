// Crash-report text redaction (R01, KR7). Every free-text string a crash report carries (the
// event's message, each exception value, a kept breadcrumb's message) passes redactText() before
// it can leave the phone. What goes: bearer and basic credentials, device tokens, Expo push tokens,
// Clerk keys, JWTs, email addresses, URLs with a host (a self-hosted server's address, a pairing
// link), a host with a port or a home-network name, UUIDs, IP addresses, long opaque tokens (a push
// key, a signature) and any quoted run longer than 40 characters (the shape a chat message or a
// question takes inside an error message). What stays is what makes a crash debuggable: the
// error's own words. Free text outside quotes is not recognisable and is only cut to 300
// characters. Runs on the crash path, so every pattern is linear in the text: bounded
// quantifiers, and text over 4 KB cut first. Pure: no imports.

export const REDACTED = '[redacted]';
/** The longest text a crash report carries after redaction. */
export const MAX_TEXT_LENGTH = 300;
/** The longest text any pattern reads: a longer one is cut first (see headOf). */
export const MAX_INPUT_LENGTH = 4096;

// Runs FIRST, so a token inside a long quote cannot shorten it below the limit and let it through.
// A curly quote's run stops at the next opening one too, so an unclosed one cannot rescan the text.
const QUOTED_RUNS = /"[^"]{41,}"|'[^']{41,}'|`[^`]{41,}`|“[^“”]{41,}”|‘[^‘’]{41,}’/g;
const QUOTE_CHARACTER = /["'`“‘]/;
/** Quotes that never double as an apostrophe, so an unclosed one is a quote cut short. */
const UNCLOSED_QUOTES: readonly (readonly [string, string])[] = Object.freeze([
  ['"', '"'],
  ['`', '`'],
  ['“', '”'],
]);
const MAX_QUOTED_LENGTH = 40;

const SECRET_PATTERNS: readonly RegExp[] = Object.freeze([
  // an Authorization value: the scheme word and the credential after it
  /\bBearer\s+[^\s"'`,;]+/gi,
  /\bBasic\s+[A-Za-z0-9+/=]{8,}/gi,
  // JWT-shaped: a base64url JSON header ('{"' encodes as 'eyJ') and two more dot-joined parts
  /eyJ[A-Za-z0-9_-]{0,256}\.[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{0,1024}/g,
  // the paired device token (connect/config.ts DEVICE_TOKEN_PREFIX)
  /amd_[A-Za-z0-9_-]+/g,
  // an Expo push token (push/config.ts EXPO_PUSH_TOKEN_PATTERN) in either spelling, closed or cut
  /Expo(?:nent)?PushToken\[[^\]\s]*\]?/g,
  // Clerk publishable and secret keys
  /[ps]k_(?:live|test)_[A-Za-z0-9_=+/$-]+/g,
  // a URL with a host (any scheme, so automatos://go/pair?code=… too); app:///main.jsbundle has none
  /\b[a-z][a-z0-9+.-]{0,31}:\/\/[^\s/?#"'`<>()[\]{}]+[^\s"'`<>()[\]{}]*/gi,
  // an email address, plain or percent-encoded (%40)
  /[A-Za-z0-9._%+-]{1,64}(?:@|%40)[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}/g,
  // a host with a port, or a home-network name, written without a scheme
  /\b[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,8}:\d{2,5}\b/g,
  /\b[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.(?:local|lan|internal|home\.arpa|localdomain)\b/gi,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?\b/g,
  // IPv6: four to eight groups, or a '::' between groups
  /\b[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){3,7}\b/gi,
  /\b[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6}::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?/gi,
]);

// An opaque token: a run of 32+ token characters with a digit in it (a push key, a hex signature).
// Matched as a whole run and tested in a callback, so the scan never restarts inside a run.
const TOKEN_RUN = /[A-Za-z0-9_-]{32,}/g;
const DIGIT = /\d/;

/**
 * Over-long text cut to MAX_INPUT_LENGTH before any pattern reads it. The cut could open a quote
 * it never closes or halve a token, so the head ends before its first quote character, or else
 * before its last (possibly halved) word, and says that the rest was taken out.
 */
function headOf(text: string): string {
  if (text.length <= MAX_INPUT_LENGTH) return text;
  const cut = text.slice(0, MAX_INPUT_LENGTH);
  const quote = cut.search(QUOTE_CHARACTER);
  const end = quote === -1 ? cut.search(/\s\S*$/) : quote;
  const kept = end <= 0 ? '' : cut.slice(0, end).trimEnd();
  return kept === '' ? REDACTED : `${kept} ${REDACTED}`;
}

function isUnclosed(text: string, open: string, close: string, at: number): boolean {
  if (open !== close) return text.indexOf(close, at) === -1;
  return text.split(open).length % 2 === 0;
}

/**
 * A quote opened and never closed (an error that echoes a cut-off body) with more than 40
 * characters after it: everything from it on is taken out. Runs after QUOTED_RUNS, so the closed
 * runs are gone and the last opening quote left over is the unclosed one.
 */
function withoutUnclosedQuote(text: string): string {
  return UNCLOSED_QUOTES.reduce((current, [open, close]) => {
    const at = current.lastIndexOf(open);
    if (at === -1 || current.length - at - 1 <= MAX_QUOTED_LENGTH) return current;
    return isUnclosed(current, open, close, at) ? `${current.slice(0, at)}${REDACTED}` : current;
  }, text);
}

/** The text with every secret, address and long quote replaced, cut to MAX_TEXT_LENGTH. */
export function redactText(text: string): string {
  const unquoted = withoutUnclosedQuote(headOf(text).replace(QUOTED_RUNS, REDACTED));
  const redacted = SECRET_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, REDACTED),
    unquoted,
  );
  const untokened = redacted.replace(TOKEN_RUN, (run) => (DIGIT.test(run) ? REDACTED : run));
  return untokened.slice(0, MAX_TEXT_LENGTH);
}
