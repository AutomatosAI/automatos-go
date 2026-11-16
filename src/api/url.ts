// URL building for the one client: the server's base URL, a route path with its `{name}` segments
// filled (URI-encoded), and a query string. Pure; a bad parameter is a programming error and throws
// a TypeError before any request is made. Each `{name}` is one path segment, and the builder itself
// refuses a value that could leave it, whatever its caller checked: the server decodes %2F into its
// own '/', so 'a/../b' sent as 'a%2F..%2Fb' would reach another route. Two rules, by the parameter:
// an id (isIdSegment, every parameter but a file name's) and a file name the server chose
// (isFileNameSegment, FILE_NAME_PARAMS).

export type PathParams = Readonly<Record<string, string | number>>;
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Readonly<Record<string, QueryValue>>;

const PATH_PARAM = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
/** Segments a URL resolver would collapse, re-aiming the request at another path. */
const DOT_SEGMENTS: ReadonlySet<string> = new Set(['.', '..']);
const SLASH = '/';

/**
 * The text without the slashes it ends with, read back from the end once. Not a pattern: /\/+$/
 * starts again at every slash of a long run that does not end the text, which is quadratic.
 */
export function withoutTrailingSlash(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === SLASH) end -= 1;
  return url.slice(0, end);
}

/** An id as the server writes one (a UUID, a row id, a base64url install id): 128 at most. */
const ID_SEGMENT = /^[A-Za-z0-9._-]{1,128}$/;
/**
 * The parameters that carry a file name the server chose: a social post's media file
 * (`{file_name}`, names such as 'image-1.png') and a generated document (`{filename}`, which the
 * server names, so spaces, other scripts and brackets may be in it).
 */
export const FILE_NAME_PARAMS: ReadonlySet<string> = new Set(['file_name', 'filename']);
/** Longer than any file name a file system keeps. */
const FILE_NAME_MAX_LENGTH = 255;
/** What no file name in one segment holds: a slash, a backslash, a control character (C0, C1). */
const NOT_IN_A_FILE_NAME = /[/\\\u0000-\u001f\u007f-\u009f]/;

/**
 * A UTF-16 surrogate with no partner, which encodeURIComponent cannot encode (it throws a bare
 * URIError): refused first, with this module's own error.
 */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Text every encoder can encode: no lone surrogate. */
export function isWellFormed(text: string): boolean {
  return !LONE_SURROGATE.test(text);
}

/** An id in one segment: letters, digits, '.', '_' and '-', and not a dot segment. */
export function isIdSegment(text: string): boolean {
  return ID_SEGMENT.test(text) && !DOT_SEGMENTS.has(text);
}

function readsAsFileName(text: string): boolean {
  if (text === '' || text.length > FILE_NAME_MAX_LENGTH) return false;
  return !NOT_IN_A_FILE_NAME.test(text) && !DOT_SEGMENTS.has(text);
}

function decodedOnce(text: string): string | null {
  try {
    return decodeURIComponent(text);
  } catch {
    return null; // a '%' that is no escape: the text stands as it is
  }
}

/**
 * A file name in one segment: any characters but a slash, a backslash or a control character, not a
 * dot segment, FILE_NAME_MAX_LENGTH at most; and the same once percent-decoded, so '%2F', '%5C',
 * '%2E%2E' or '%00' in it is refused too.
 */
export function isFileNameSegment(text: string): boolean {
  const decoded = decodedOnce(text);
  return readsAsFileName(text) && (decoded === null || readsAsFileName(decoded));
}

function paramValue(params: PathParams, name: string): string {
  const value = Object.prototype.hasOwnProperty.call(params, name) ? params[name] : undefined;
  const text = value === undefined ? '' : String(value);
  const fits = FILE_NAME_PARAMS.has(name) ? isFileNameSegment(text) : isIdSegment(text);
  if (!fits || !isWellFormed(text)) {
    // the parameter's name only: never its value, which may be anything a server or a link sent
    throw new TypeError(`Path parameter "${name}" is missing or not a usable segment`);
  }
  return encodeURIComponent(text);
}

/**
 * A route's path with its parameters filled. The path must start with exactly one '/': one written
 * without it ('evil.example/x') would be glued onto the server's host, and one with two ('//x')
 * names another host to a URL parser.
 */
export function fillPath(path: string, params: PathParams = {}): string {
  if (!path.startsWith(SLASH) || path.startsWith(`${SLASH}${SLASH}`)) {
    throw new TypeError('A route path must start with exactly one "/"');
  }
  return path.replace(PATH_PARAM, (_match, name: string) => paramValue(params, name));
}

function queryPair(key: string, value: string): string {
  if (!isWellFormed(key) || !isWellFormed(value)) {
    // never the value, and not the key either: neither can be written out as it is
    throw new TypeError('A query parameter is not a usable value');
  }
  return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function queryString(query: QueryParams = {}): string {
  const pairs = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => queryPair(key, String(value)));
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

export function buildUrl(
  baseUrl: string,
  path: string,
  params?: PathParams,
  query?: QueryParams,
): string {
  return `${withoutTrailingSlash(baseUrl)}${fillPath(path, params)}${queryString(query)}`;
}

/** Whitespace, a control character or a backslash: nothing a real address holds. */
const UNSAFE_IN_ADDRESS = /[\s\u0000-\u001f\u007f\\]/;

/**
 * Whether `url` is on the server at `apiUrl` (a plain origin): it starts with that origin, in any
 * case, then a '/', and holds no character a real address never holds. Another host, a look-alike
 * (the origin followed by '.', ':' or '@'), another scheme and a relative address are not.
 */
export function isOnServer(apiUrl: string, url: string): boolean {
  const origin = withoutTrailingSlash(apiUrl).toLowerCase();
  const sameOrigin = url.slice(0, origin.length).toLowerCase() === origin;
  return sameOrigin && url.charAt(origin.length) === '/' && !UNSAFE_IN_ADDRESS.test(url);
}
