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
// Lost, never the link as it came. Nothing longer than LINK_MAX_LENGTH is parsed. A mapped link's
// query is read only for the names its entry reads (readQuery): more than QUERY_PAIRS_MAX pairs, a
// name it reads given twice, or a value longer than PARAM_VALUE_MAX_LENGTH refuses the whole link;
// any other name is ignored, since the route is rebuilt from the names the table reads. Every id
// is held to isUsableId (routes.ts) exactly as it came: a padded one is refused, never trimmed.
// Parsed by hand, not with URL: React Native's URL is a partial polyfill.

import { withoutTrailingSlash } from '../api/url';
import {
  ADDRESS_MAX_LENGTH,
  APP_PAIR_LINK,
  APP_SCHEME,
  PAIR_LINK_API_PARAM,
  PAIR_LINK_CODE_PARAM,
  PAIR_LINK_PATH,
} from '../connect/config';
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
/** A link's path (no trailing slash) and its query as written, read only once an entry wants it. */
type SplitLink = Readonly<{ path: string; search: string }>;
/** A mapped link: its path, the values of the names its entry reads, and the query as written. */
type ReadLink = SplitLink & Readonly<{ query: Query }>;
/** Who handed the link over: a screen inside the app, or the OS (a link from outside). */
type From = 'app' | 'system';
type Entry = Readonly<{
  open: (link: ReadLink) => string | null;
  from: readonly From[];
  /** The query names this entry reads; every other name is ignored. */
  reads: readonly string[];
}>;
/** What the table answers: a route, no entry (or no screen) for the link, or the link refused. */
type Answer = Readonly<{ route: string }> | 'unmapped' | 'refused';

/** A link longer than this is not one anyone built (the pairing link's own cap): never parsed. */
export const LINK_MAX_LENGTH = 2048;
/**
 * More query pairs than this is not a link anyone built: refused before a pair is read. An entry
 * reads three names at the most (/command-center: tab, task_id, question), and a link the web
 * builds carries a few of its own besides (runtime=1, the five utm_ names a mail tool adds).
 */
export const QUERY_PAIRS_MAX = 16;
/** The longest value an entry reads, decoded: a pairing link's server address (ADDRESS_MAX_LENGTH). */
export const PARAM_VALUE_MAX_LENGTH = ADDRESS_MAX_LENGTH;
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

/** A query value that is an id exactly as it came (never trimmed); null when absent or unusable. */
function idParam(query: Query, name: string): string | null {
  const value = query.get(name);
  return value !== undefined && isUsableId(value) ? value : null;
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

/** One pair of a query: its name decoded (null when its escape is malformed), its value as written. */
type Pair = Readonly<{ name: string | null; raw: string }>;
type NamedPair = Readonly<{ name: string; raw: string }>;

function pairOf(part: string): Pair {
  const at = part.indexOf('=');
  if (at < 0) return { name: decode(part), raw: '' };
  return { name: decode(part.slice(0, at)), raw: part.slice(at + 1) };
}

/** How many pairs a query holds, counted without reading one. */
function pairCount(search: string): number {
  let count = search === '' ? 0 : 1;
  for (let at = search.indexOf('&'); at !== -1; at = search.indexOf('&', at + 1)) count += 1;
  return count;
}

/**
 * The values of the names `reads` lists, or null when the link is refused: more than
 * QUERY_PAIRS_MAX pairs (counted before any is read), a name it reads given twice (a second value
 * is how two readers of one link are made to disagree), or a value it reads longer than
 * PARAM_VALUE_MAX_LENGTH. Any other name is ignored, its value not even decoded: the route is
 * rebuilt from the names read, so nothing else in the link reaches it. A value whose escape is
 * malformed is left out (the entry opens as if it were absent), its name still counted. Names are
 * keys of a Map, so '__proto__' or 'constructor' is only a name.
 */
export function readQuery(search: string, reads: readonly string[]): Query | null {
  if (pairCount(search) > QUERY_PAIRS_MAX) return null;
  const read = (search === '' ? [] : search.split('&'))
    .map(pairOf)
    .filter((pair): pair is NamedPair => pair.name !== null && reads.includes(pair.name));
  if (new Set(read.map((pair) => pair.name)).size !== read.length) return null;
  const values = new Map<string, string>();
  for (const { name, raw } of read) {
    const value = decode(raw);
    if (value !== null && value.length > PARAM_VALUE_MAX_LENGTH) return null;
    if (value !== null) values.set(name, value);
  }
  return values;
}

function splitLink(link: string): SplitLink {
  const withoutHash = link.split('#', 1)[0];
  const at = withoutHash.indexOf('?');
  const rawPath = at < 0 ? withoutHash : withoutHash.slice(0, at);
  const search = at < 0 ? '' : withoutHash.slice(at + 1);
  return { path: withoutTrailingSlash(rawPath) || '/', search };
}

/** /command-center?tab=board&task_id=<row id>[&question=<grant id>], or a question by id alone. */
function boardRoute(query: Query): string {
  const taskId = idParam(query, 'task_id');
  const questionId = idParam(query, 'question');
  if (taskId && isTaskId(taskId)) return routes.cc.ticket(taskId, questionId);
  // the web's board finds a question's ticket by itself; the phone lists it with the others
  return questionId ? routes.cc.questions : routes.cc.board;
}

function commandCentreRoute({ query }: ReadLink): string | null {
  const tab = query.get('tab') || 'summary';
  if (BOARD_TABS.has(tab)) return boardRoute(query);
  return TAB_ROUTES.get(tab) ?? null;
}

/** /deliverables?deliverable=<id> (DELIVERABLE_PARAM), or the gallery. */
function deliverablesRoute({ query }: ReadLink): string {
  const id = idParam(query, 'deliverable');
  return id ? routes.cc.deliverable(id) : routes.cc.deliverables;
}

/** /chat?ticket=<row id> (D31), /chat?chatId=<id> (chatHref), or just the chat: home. */
function chatRoute({ query }: ReadLink): string {
  const ticket = idParam(query, 'ticket');
  if (ticket && isTaskId(ticket)) return chatWithTicket(ticket);
  const chatId = idParam(query, 'chatId');
  return chatId ? routes.chat(chatId) : routes.home;
}

/**
 * The pairing link (US-006g): its screen with the server and the code, once parsePairLink reads
 * the query as a pairing link's; the bare screen when not, which says the link cannot be used.
 */
function pairRoute({ search }: ReadLink): string {
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
  [
    '/command-center',
    { open: commandCentreRoute, from: EVERYWHERE, reads: ['tab', 'task_id', 'question'] },
  ],
  ['/deliverables', { open: deliverablesRoute, from: EVERYWHERE, reads: ['deliverable'] }],
  ['/chat', { open: chatRoute, from: EVERYWHERE, reads: ['ticket', 'chatId'] }],
  ['/', { open: () => routes.home, from: FROM_THE_OS, reads: [] }],
  [
    PAIR_LINK_PATH,
    { open: pairRoute, from: FROM_THE_OS, reads: [PAIR_LINK_API_PARAM, PAIR_LINK_CODE_PARAM] },
  ],
]);

function routeFor(link: SplitLink, from: From): Answer {
  const entry = LINKS.get(link.path);
  if (entry === undefined || !entry.from.includes(from)) return 'unmapped';
  const query = readQuery(link.search, entry.reads);
  if (query === null) return 'refused';
  const route = entry.open({ ...link, query });
  return route === null ? 'unmapped' : { route };
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
  const answer = routeFor(splitLink(trimmed), 'app');
  if (answer === 'refused') return null;
  if (answer !== 'unmapped') return { app: answer.route };
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
  if (path === null || !isInternalPath(path)) return null;
  const answer = routeFor(splitLink(path), 'system');
  return typeof answer === 'string' ? null : answer.route;
}

/**
 * The development client's own launch form: any scheme, then the host expo-development-client
 * (expo-dev-launcher's isDevLauncherURL reads the host alone; its QR code says
 * exp+<slug>://expo-development-client/?url=<bundler>, and Android hands that intent to the app
 * once the bundle loads). expo-router reads the bundler address out of it. Nothing else is one.
 */
const DEVELOPMENT_CLIENT_LINK = /^[a-z][a-z0-9+.-]*:\/\/expo-development-client(?:[/?#]|$)/i;

/**
 * Where a link the OS hands the app opens (expo-router's redirectSystemPath): the route the table
 * builds for it, by the same mapping as a link inside the app, with the app's root at home and a
 * pairing link at its screen. Anything else opens Lost (routes.lost): a link longer than
 * LINK_MAX_LENGTH, a scheme but https and automatos (exp://, exps:// and their '/--/' paths
 * included), a host app.json does not claim, a page with no screen here, a query the table refuses,
 * a malformed link, anything that is not text. An automatos:// link is held to the table in every
 * build. Only in a development build does the development client's own launch form
 * (DEVELOPMENT_CLIENT_LINK) go on as it came; a release build returns nothing but a table's route
 * or Lost. Opens nothing by itself, reads no server state and never throws.
 */
export function appPathForSystemLink(
  link: string,
  development: boolean = DEVELOPMENT_BUILD,
): string {
  try {
    const route = systemRoute(link);
    if (route !== null) return route;
    const launch = development && isReadable(link) && DEVELOPMENT_CLIENT_LINK.test(link.trim());
    return launch ? link : routes.lost;
  } catch {
    return routes.lost; // expo-router crashes the app on a throw here
  }
}
