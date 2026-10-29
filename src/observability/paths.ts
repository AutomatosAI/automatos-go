// A URL as a crash report may carry it (R01, KR7): the path only, with every segment that is not
// one of the app's own route words replaced by ':id'. The route words come from the app's route
// tables (src/**/routes.ts, the same tables scripts/check-routes.ts reads), so a chat id, a call
// id, a ticket number, a Deliverable's file name or a slug never survives, and a route a later
// wave adds without its table here only loses words (it shows as ':id'), never leaks. Pure: the
// route tables are plain data.

import { routes } from '../api/routes';
import { CC_ROUTES } from '../cc/routes';
import { CHAT_ROUTES } from '../chat/routes';
import { CONNECT_ROUTES } from '../connect/routes';
import { PUSH_ROUTES } from '../push/routes';
import { STYLE_ROUTES } from '../styles/routes';
import { SUGGESTION_ROUTES } from '../suggestions/routes';
import { VOICE_ROUTES } from '../voice/routes';
import { MAX_INPUT_LENGTH, MAX_TEXT_LENGTH } from './redact';

/** A path segment that is not a route word: an id, a number, a name. */
export const ID_SEGMENT = ':id';

/** Every route table the app calls the server through (a table may nest: STYLE_ROUTES does). */
export const ROUTE_TABLES: readonly object[] = Object.freeze([
  routes,
  CC_ROUTES,
  CHAT_ROUTES,
  CONNECT_ROUTES,
  PUSH_ROUTES,
  STYLE_ROUTES,
  SUGGESTION_ROUTES,
  VOICE_ROUTES,
]);

const PARAMETER = /^\{[^}]*\}$/;
/** Route tables nest one level today; deeper than this is not a table. */
const MAX_TABLE_DEPTH = 4;

/** Every route path in a table: a {method, path} object's path, or its children's. */
function pathsIn(value: unknown, depth = 0): string[] {
  if (typeof value !== 'object' || value === null || depth > MAX_TABLE_DEPTH) return [];
  const { path } = value as { readonly path?: unknown };
  if (typeof path === 'string') return [path];
  return Object.values(value).flatMap((child) => pathsIn(child, depth + 1));
}

/** The literal segments of every route path (api, v1, chat, messages, …); parameters excluded. */
export function routeWordsOf(tables: readonly object[]): ReadonlySet<string> {
  const words = tables
    .flatMap((table) => pathsIn(table))
    .flatMap((routePath) => routePath.split('/'))
    .filter((segment) => segment !== '' && !PARAMETER.test(segment));
  return new Set(words);
}

export const ROUTE_WORDS: ReadonlySet<string> = routeWordsOf(ROUTE_TABLES);

const SCHEME_AND_HOST = /^[a-z][a-z0-9+.-]{0,31}:\/\/[^/?#]*/i;
const HAS_HOST = /^[a-z][a-z0-9+.-]{0,31}:\/\/[^/?#]/i;
const QUERY_OR_FRAGMENT = /[?#]/;
const HOME_FOLDER = /^\/(Users|home)\/[^/]+/;
/** iOS names each install's app and data folders with a random UUID. */
const APP_CONTAINER = /\/Application\/[0-9A-Fa-f-]{36}\//;
/** A scheme with an empty host (app://, file://): kept as written. */
const HOSTLESS_SCHEME = /^[a-z][a-z0-9+.-]{0,31}:\/\/(?=\/)/i;

function withoutPersonalFolders(local: string): string {
  return local
    .replace(HOME_FOLDER, `/$1/${ID_SEGMENT}`)
    .replace(APP_CONTAINER, `/Application/${ID_SEGMENT}/`);
}

/** True for a URL with a host (https://srv/…), false for app:///main.jsbundle or a bare path. */
export function hasHost(url: string): boolean {
  return HAS_HOST.test(url);
}

/** The URL without its scheme, host, port, query and fragment: the path only. */
export function stripHost(url: string): string {
  const withoutHost = url.slice(0, MAX_INPUT_LENGTH).replace(SCHEME_AND_HOST, '');
  const end = withoutHost.search(QUERY_OR_FRAGMENT);
  const path = end === -1 ? withoutHost : withoutHost.slice(0, end);
  return path === '' ? '/' : path;
}

/** A frame's or image's file as a report carries it: no host, user name or install folder id. */
export function framePath(path: string): string {
  if (hasHost(path)) return withoutPersonalFolders(stripHost(path));
  // app:///main.jsbundle keeps its scheme (source maps are matched on it), never a query
  const scheme = HOSTLESS_SCHEME.exec(path)?.[0] ?? '';
  return `${scheme}${withoutPersonalFolders(stripHost(path.slice(scheme.length)))}`;
}

/** The URL as a path template: no host, no query, and every segment not a route word → ':id'. */
export function reducePath(url: string, words: ReadonlySet<string> = ROUTE_WORDS): string {
  const template = stripHost(url)
    .split('/')
    .map((segment) => (segment === '' || words.has(segment) ? segment : ID_SEGMENT))
    .join('/');
  return template.slice(0, MAX_TEXT_LENGTH);
}
