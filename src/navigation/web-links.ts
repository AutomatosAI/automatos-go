// Web links into the app (K5), and the one table every link from outside goes through (the app
// standard's rule 5.2). Receipts, ticket links and notification links carry the web's paths
// (automatos-ai frontend/lib/ticket-links.ts at the pinned SHA). The ones the phone has a screen for
// open that screen; every other internal path (an agent, a mission, the Watchlist) opens Studio in
// the system browser (no WebView, D-NO-WEBVIEW). Only an internal path is followed, as the web's
// own safeLink rule says: never another site, never a scheme. Studio is the CURRENT server's
// (src/connect/current-server.ts): an own server's links open its web_url, the hosted server's
// EXPO_PUBLIC_WEB_URL (US-006d). A link the OS hands the app (an iOS universal link, an Android App
// Link or an automatos:// link: app.json K9) goes through appPathForSystemLink from
// app/+native-intent.tsx (P001N-SEAM-3), by the same table: it opens a route the table builds, or
// Lost, never the link as it came. Nothing longer than LINK_MAX_LENGTH is parsed, and every id a
// link carries is held to isUsableId (routes.ts). Parsed by hand, not with URL: React Native's URL
// is a partial polyfill.

import { withoutTrailingSlash } from '../api/url';
import { APP_PAIR_LINK, APP_SCHEME, PAIR_LINK_PATH } from '../connect/config';
import { currentWebUrl } from '../connect/current-server';
import { parsePairLink } from '../connect/pair-link';
import { chatWithTicket, isTaskId, isUsableId, pairLinkWith, routes } from './routes';

export type WebLinkTarget =
  /** A route in this app (routes.ts), for router.push. */
  | { readonly app: string }
  /**
   * A page for the system browser: Studio's (every link this module maps), or another site's from
   * Auto's answer once the reader has seen its address and chosen Open (chat/markdown/links.ts).
   */
  | { readonly external: string };

type Query = ReadonlyMap<string, string>;
/** A link's path (no trailing slash), its query read into pairs, and that query as written. */
type SplitLink = Readonly<{ path: string; query: Query; search: string }>;
/** Who handed the link over: a screen inside the app, or the OS (a link from outside). */
type From = 'app' | 'system';
type Entry = Readonly<{ open: (link: SplitLink) => string | null; from: readonly From[] }>;

/** A link longer than this is not one anyone built (the pairing link's own cap): never parsed. */
export const LINK_MAX_LENGTH = 2048;
/**
 * The one host app.json claims for universal links and App Links (K9; the audits read it from
 * src/release/__tests__/settings/identity.ts). The OS hands over no other, but on Android another
 * app can name this one in an intent with any address, so the host is checked here too.
 */
export const APP_LINK_HOST = 'ui.automatos.app';

/** A development build (Metro's __DEV__): its client opens the app by addresses of its own. */
const DEVELOPMENT_BUILD = typeof __DEV__ !== 'undefined' && __DEV__;

/** The web's Command Centre tabs the phone has (the web's default tab, Summary, opens the Board). */
const BOARD_TABS: ReadonlySet<string> = new Set(['board', 'summary']);
const TAB_ROUTES: ReadonlyMap<string, string> = new Map([
  ['questions', routes.cc.questions],
  ['calendar', routes.cc.calendar],
]);

/** A query value that can be an id, trimmed; null when absent or unusable. */
function idParam(query: Query, name: string): string | null {
  const value = query.get(name)?.trim();
  return value && isUsableId(value) ? value : null;
}

/** Whitespace or a control character: not a link anyone built (and never sent to the browser). */
const UNSAFE_CHARACTERS = /[\s\u0000-\u001f\u007f]/;

function isInternalPath(link: string): boolean {
  return link.startsWith('/') && !link.startsWith('//') && !UNSAFE_CHARACTERS.test(link);
}

function decode(text: string): string | null {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return null; // a malformed escape: the pair is dropped, the rest of the link still maps
  }
}

/** The query's pairs; the first value of a repeated name wins, as URLSearchParams.get does. */
export function parseQuery(search: string): Query {
  const pairs = new Map<string, string>();
  for (const part of search.split('&')) {
    const at = part.indexOf('=');
    const name = decode(at < 0 ? part : part.slice(0, at));
    const value = decode(at < 0 ? '' : part.slice(at + 1));
    if (name && value !== null && !pairs.has(name)) pairs.set(name, value);
  }
  return pairs;
}

function splitLink(link: string): SplitLink {
  const withoutHash = link.split('#', 1)[0];
  const at = withoutHash.indexOf('?');
  const rawPath = at < 0 ? withoutHash : withoutHash.slice(0, at);
  const search = at < 0 ? '' : withoutHash.slice(at + 1);
  return { path: withoutTrailingSlash(rawPath) || '/', query: parseQuery(search), search };
}

/** /command-center?tab=board&task_id=<row id>[&question=<grant id>], or a question by id alone. */
function boardRoute(query: Query): string {
  const taskId = idParam(query, 'task_id');
  const questionId = idParam(query, 'question');
  if (taskId && isTaskId(taskId)) return routes.cc.ticket(taskId, questionId);
  // the web's board finds a question's ticket by itself; the phone lists it with the others
  return questionId ? routes.cc.questions : routes.cc.board;
}

function commandCentreRoute({ query }: SplitLink): string | null {
  const tab = query.get('tab') || 'summary';
  if (BOARD_TABS.has(tab)) return boardRoute(query);
  return TAB_ROUTES.get(tab) ?? null;
}

/** /deliverables?deliverable=<id> (DELIVERABLE_PARAM), or the gallery. */
function deliverablesRoute({ query }: SplitLink): string {
  const id = idParam(query, 'deliverable');
  return id ? routes.cc.deliverable(id) : routes.cc.deliverables;
}

/** /chat?ticket=<row id> (D31), /chat?chatId=<id> (chatHref), or just the chat: home. */
function chatRoute({ query }: SplitLink): string {
  const ticket = idParam(query, 'ticket');
  if (ticket && isTaskId(ticket)) return chatWithTicket(ticket);
  const chatId = idParam(query, 'chatId');
  return chatId ? routes.chat(chatId) : routes.home;
}

/**
 * The pairing link (US-006g): its screen with the server and the code, once parsePairLink reads
 * the query as a pairing link's; the bare screen when not, which says the link cannot be used.
 */
function pairRoute({ search }: SplitLink): string {
  const link = parsePairLink(`${APP_PAIR_LINK}?${search}`);
  return link === null ? routes.pairLink : pairLinkWith(link);
}

const EVERYWHERE: readonly From[] = Object.freeze(['app', 'system']);
const FROM_THE_OS: readonly From[] = Object.freeze(['system']);

/**
 * The one table: a link's path → the route it opens. The app's root and the pairing link are the
 * OS's alone: inside the app, `/` and /go/pair are Studio's pages, and an answer never pairs.
 */
const LINKS: ReadonlyMap<string, Entry> = new Map<string, Entry>([
  ['/command-center', { open: commandCentreRoute, from: EVERYWHERE }],
  ['/deliverables', { open: deliverablesRoute, from: EVERYWHERE }],
  ['/chat', { open: chatRoute, from: EVERYWHERE }],
  ['/', { open: () => routes.home, from: FROM_THE_OS }],
  [PAIR_LINK_PATH, { open: pairRoute, from: FROM_THE_OS }],
]);

function routeFor(link: SplitLink, from: From): string | null {
  const entry = LINKS.get(link.path);
  return entry !== undefined && entry.from.includes(from) ? entry.open(link) : null;
}

/** Studio's page for a path, or null when the current server has no web URL to open it on. */
export function studioUrl(path: string, webUrl: string = currentWebUrl()): string | null {
  const base = withoutTrailingSlash(webUrl.trim());
  return base && isInternalPath(path) ? `${base}${path}` : null;
}

/**
 * Where a web link opens: an app route when the phone has the screen, Studio in the system browser
 * for any other internal path, and null for anything that is not an internal path, or longer than
 * LINK_MAX_LENGTH (or an external page when the current server has no Studio address).
 */
export function appRouteForWebLink(
  link: string,
  webUrl: string = currentWebUrl(),
): WebLinkTarget | null {
  if (link.length > LINK_MAX_LENGTH) return null;
  const trimmed = link.trim();
  if (!isInternalPath(trimmed)) return null;
  const app = routeFor(splitLink(trimmed), 'app');
  if (app !== null) return { app };
  const external = studioUrl(trimmed, webUrl);
  return external === null ? null : { external };
}

const HTTPS_PREFIX = 'https://';
const APP_SCHEME_PREFIX = `${APP_SCHEME}://`;
/** https's own port, which a link may spell out. */
const HTTPS_PORT = ':443';
const AUTHORITY_END = /[/?#]/;

function startsWithScheme(link: string, prefix: string): boolean {
  return link.slice(0, prefix.length).toLowerCase() === prefix;
}

/** The path and query of an https link on APP_LINK_HOST; null for any other host. */
function appLinkPath(link: string): string | null {
  const rest = link.slice(HTTPS_PREFIX.length);
  const end = rest.search(AUTHORITY_END);
  const authority = (end < 0 ? rest : rest.slice(0, end)).toLowerCase();
  const host = authority.endsWith(HTTPS_PORT) ? authority.slice(0, -HTTPS_PORT.length) : authority;
  if (host !== APP_LINK_HOST) return null;
  const tail = end < 0 ? '' : rest.slice(end);
  return tail.startsWith('/') ? tail : `/${tail}`;
}

/** An automatos:// link's path: what follows the scheme (the router reads a host as a segment). */
function appSchemePath(link: string): string {
  const rest = link.slice(APP_SCHEME_PREFIX.length);
  let start = 0;
  while (rest[start] === '/') start += 1;
  return `/${rest.slice(start)}`;
}

/** The path a link from the OS carries, when its scheme and host are this app's; null otherwise. */
function systemLinkPath(link: string): string | null {
  if (startsWithScheme(link, HTTPS_PREFIX)) return appLinkPath(link);
  if (startsWithScheme(link, APP_SCHEME_PREFIX)) return appSchemePath(link);
  return link.startsWith('/') ? link : null;
}

function isReadable(link: unknown): link is string {
  return typeof link === 'string' && link.length <= LINK_MAX_LENGTH;
}

function systemRoute(link: unknown): string | null {
  if (!isReadable(link)) return null;
  const path = systemLinkPath(link.trim());
  return path !== null && isInternalPath(path) ? routeFor(splitLink(path), 'system') : null;
}

/**
 * Where a link the OS hands the app opens (expo-router's redirectSystemPath): the route the table
 * builds for it, by the same mapping as a link inside the app, with the app's root at home and a
 * pairing link at its screen. Anything else opens Lost (routes.lost): a link longer than
 * LINK_MAX_LENGTH, a scheme but https and automatos, a host app.json does not claim, a page with no
 * screen here, a malformed link, anything that is not text. Only a development build lets a link
 * the table cannot map go on as it came, so its client's own addresses still open the app; a
 * release build never does. Opens nothing by itself, reads no server state and never throws.
 */
export function appPathForSystemLink(
  link: string,
  development: boolean = DEVELOPMENT_BUILD,
): string {
  try {
    const route = systemRoute(link);
    if (route !== null) return route;
    return development && isReadable(link) ? link : routes.lost;
  } catch {
    return routes.lost; // expo-router crashes the app on a throw here
  }
}
