// URL building for the one client: the server's base URL, a route path with its `{name}` segments
// filled (URI-encoded), and a query string. Pure; a bad parameter is a programming error and throws.

export type PathParams = Readonly<Record<string, string | number>>;
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Readonly<Record<string, QueryValue>>;

const PATH_PARAM = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
/** Segments a URL resolver would collapse, re-aiming the request at another path. */
const DOT_SEGMENTS: ReadonlySet<string> = new Set(['.', '..']);
const TRAILING_SLASHES = /\/+$/;

export function withoutTrailingSlash(url: string): string {
  return url.replace(TRAILING_SLASHES, '');
}

function paramValue(params: PathParams, name: string): string {
  const value = Object.prototype.hasOwnProperty.call(params, name) ? params[name] : undefined;
  const text = value === undefined ? '' : String(value);
  if (text === '' || DOT_SEGMENTS.has(text)) {
    throw new TypeError(`Path parameter "${name}" is missing or not a usable segment`);
  }
  return encodeURIComponent(text);
}

export function fillPath(path: string, params: PathParams = {}): string {
  return path.replace(PATH_PARAM, (_match, name: string) => paramValue(params, name));
}

export function queryString(query: QueryParams = {}): string {
  const pairs = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
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
