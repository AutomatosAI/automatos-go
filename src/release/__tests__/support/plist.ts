// A minimal XML-plist reader for the release audits (test-only): the elements a
// PrivacyInfo.xcprivacy uses (dict, array, string, true, false, integer) and the <plist> wrapper.
// Any other element (data, date, real), text where an element belongs, a duplicate key or an
// unclosed element throws, so an audit never trusts a manifest it only half read.

export type PlistValue =
  string | number | boolean | readonly PlistValue[] | Readonly<{ [key: string]: PlistValue }>;

type Tag = Readonly<{ kind: 'open' | 'close' | 'empty'; name: string }>;
type Text = Readonly<{ kind: 'text'; text: string }>;
type Token = Tag | Text;
type Read<T> = readonly [value: T, next: number];

const PROLOG = /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/g;
const TOKEN = /<(\/?)([A-Za-z]+)(?:\s[^<>]*?)?(\/?)>|([^<]+)|(<)/g;
const INTEGER = /^[+-]?\d+$/;
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&',
};
const ENTITY = /&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g;

function fail(message: string): never {
  throw new Error(`plist: ${message}`);
}

function decodeEntity(whole: string, body: string): string {
  if (body.startsWith('#x')) return String.fromCodePoint(parseInt(body.slice(2), 16));
  if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
  return NAMED_ENTITIES[body] ?? fail(`unknown entity ${whole}`);
}

function toToken(match: RegExpMatchArray): Token {
  const [, slash, name, selfClose, text, stray] = match;
  if (stray !== undefined) fail(`a '<' that starts no element at offset ${match.index ?? -1}`);
  if (text !== undefined) return { kind: 'text', text: text.replace(ENTITY, decodeEntity) };
  if (slash && selfClose) fail(`</${name}/> is not an element`);
  return { kind: slash ? 'close' : selfClose ? 'empty' : 'open', name: name ?? '' };
}

function tokenize(xml: string): readonly Token[] {
  return [...xml.replace(PROLOG, '').matchAll(TOKEN)].map(toToken);
}

function describeToken(token: Token | undefined): string {
  if (token === undefined) return 'the end of the document';
  if (token.kind === 'text') return `text '${token.text.trim().slice(0, 40)}'`;
  return token.kind === 'close' ? `</${token.name}>` : `<${token.name}>`;
}

/** The first token at or after `at` that is not whitespace-only text. */
function skipSpace(tokens: readonly Token[], at: number): number {
  const token = tokens[at];
  return token?.kind === 'text' && token.text.trim() === '' ? skipSpace(tokens, at + 1) : at;
}

function expectClose(tokens: readonly Token[], at: number, name: string): number {
  const token = tokens[at];
  if (token?.kind === 'close' && token.name === name) return at + 1;
  return fail(`expected </${name}>, found ${describeToken(token)}`);
}

/** <name>text</name> or <name/>, as its (entity-decoded) text. */
function readLeafText(tokens: readonly Token[], at: number, name: string): Read<string> {
  if (tokens[at]?.kind === 'empty') return ['', at + 1];
  const body = tokens[at + 1];
  if (body?.kind === 'text') return [body.text, expectClose(tokens, at + 2, name)];
  return ['', expectClose(tokens, at + 1, name)];
}

function readInteger(tokens: readonly Token[], at: number): Read<number> {
  const [text, next] = readLeafText(tokens, at, 'integer');
  const trimmed = text.trim();
  return INTEGER.test(trimmed) ? [Number(trimmed), next] : fail(`'${text}' is not an <integer>`);
}

function readBoolean(tokens: readonly Token[], at: number, name: string): Read<boolean> {
  const value = name === 'true';
  if (tokens[at]?.kind === 'empty') return [value, at + 1];
  return [value, expectClose(tokens, skipSpace(tokens, at + 1), name)];
}

/** The items of a container up to its close tag, each read by readItem from its first token. */
function readItems<T>(
  tokens: readonly Token[],
  at: number,
  name: string,
  readItem: (from: number) => Read<T>,
): Read<readonly T[]> {
  if (tokens[at]?.kind === 'empty') return [[], at + 1];
  const collect = (cursor: number, items: readonly T[]): Read<readonly T[]> => {
    const token = tokens[cursor];
    if (token?.kind === 'close' && token.name === name) return [items, cursor + 1];
    const [item, next] = readItem(cursor);
    return collect(skipSpace(tokens, next), [...items, item]);
  };
  return collect(skipSpace(tokens, at + 1), []);
}

function readEntry(tokens: readonly Token[], at: number): Read<readonly [string, PlistValue]> {
  const token = tokens[at];
  if (!(token?.kind === 'open' || token?.kind === 'empty') || token.name !== 'key') {
    return fail(`expected <key> in a <dict>, found ${describeToken(token)}`);
  }
  const [key, afterKey] = readLeafText(tokens, at, 'key');
  const [value, next] = readValue(tokens, skipSpace(tokens, afterKey));
  return [[key, value], next];
}

function readDict(tokens: readonly Token[], at: number): Read<PlistValue> {
  const [entries, next] = readItems(tokens, at, 'dict', (from) => readEntry(tokens, from));
  const keys = entries.map(([key]) => key);
  const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
  if (duplicate !== undefined) fail(`the key '${duplicate}' appears twice in one <dict>`);
  return [Object.freeze(Object.fromEntries(entries)), next];
}

function readArray(tokens: readonly Token[], at: number): Read<PlistValue> {
  const [items, next] = readItems(tokens, at, 'array', (from) => readValue(tokens, from));
  return [Object.freeze(items), next];
}

type Reader = (tokens: readonly Token[], at: number) => Read<PlistValue>;

// A Map, not an object literal, so an element named after an Object.prototype key is unknown too.
const READERS: ReadonlyMap<string, Reader> = new Map<string, Reader>([
  ['dict', readDict],
  ['array', readArray],
  ['string', (tokens, at) => readLeafText(tokens, at, 'string')],
  ['integer', readInteger],
  ['true', (tokens, at) => readBoolean(tokens, at, 'true')],
  ['false', (tokens, at) => readBoolean(tokens, at, 'false')],
]);

function readValue(tokens: readonly Token[], at: number): Read<PlistValue> {
  const token = tokens[at];
  if (token?.kind !== 'open' && token?.kind !== 'empty') {
    return fail(`expected a value, found ${describeToken(token)}`);
  }
  const reader = READERS.get(token.name);
  return reader ? reader(tokens, at) : fail(`<${token.name}> is not an element this reader knows`);
}

/** The value inside an XML plist's <plist> element. Throws on anything it cannot read exactly. */
export function parsePlist(xml: string): PlistValue {
  const tokens = tokenize(xml);
  const start = skipSpace(tokens, 0);
  const open = tokens[start];
  if (open?.kind !== 'open' || open.name !== 'plist') {
    return fail(`expected <plist>, found ${describeToken(open)}`);
  }
  const [value, afterValue] = readValue(tokens, skipSpace(tokens, start + 1));
  const end = skipSpace(tokens, expectClose(tokens, skipSpace(tokens, afterValue), 'plist'));
  if (end !== tokens.length) fail(`${describeToken(tokens[end])} after </plist>`);
  return value;
}
