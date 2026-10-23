// Web links into the app (K5): receipts, ticket links and notification links carry the web's paths
// (automatos-ai frontend/lib/ticket-links.ts at the pinned SHA). The ones the phone has a screen for
// open that screen; every other internal path (an agent, a mission, the Watchlist) opens Studio in
// the system browser (no WebView, D-NO-WEBVIEW). Only an internal path is followed, as the web's
// own safeLink rule says: never another site, never a scheme. Studio is the CURRENT server's
// (src/connect/current-server.ts): an own server's links open its web_url, the hosted server's
// EXPO_PUBLIC_WEB_URL (US-006d). A web link the OS hands the app (an iOS universal link or an
// Android App Link, app.json K9) goes through appPathForSystemLink from app/+native-intent.tsx
// (P001N-SEAM-3). Parsed by hand, not with URL: React Native's URL is a partial polyfill.

import { withoutTrailingSlash } from '../api/url';
import { currentWebUrl } from '../connect/current-server';
import { chatWithTicket, isTaskId, isUsableId, routes } from './routes';

export type WebLinkTarget =
  /** A route in this app (routes.ts), for router.push. */
  | { readonly app: string }
  /** A page of Studio, for the system browser. */
  | { readonly external: string };

type Query = ReadonlyMap<string, string>;
type Mapper = (query: Query) => string | null;

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
const TRAILING_SLASHES = /\/+$/;

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

function splitLink(link: string): { readonly path: string; readonly query: Query } {
  const withoutHash = link.split('#', 1)[0];
  const at = withoutHash.indexOf('?');
  const rawPath = at < 0 ? withoutHash : withoutHash.slice(0, at);
  const path = rawPath.replace(TRAILING_SLASHES, '') || '/';
  return { path, query: parseQuery(at < 0 ? '' : withoutHash.slice(at + 1)) };
}

/** /command-center?tab=board&task_id=<row id>[&question=<grant id>], or a question by id alone. */
function boardRoute(query: Query): string {
  const taskId = idParam(query, 'task_id');
  const questionId = idParam(query, 'question');
  if (taskId && isTaskId(taskId)) return routes.cc.ticket(taskId, questionId);
  // the web's board finds a question's ticket by itself; the phone lists it with the others
  return questionId ? routes.cc.questions : routes.cc.board;
}

function commandCentreRoute(query: Query): string | null {
  const tab = query.get('tab') || 'summary';
  if (BOARD_TABS.has(tab)) return boardRoute(query);
  return TAB_ROUTES.get(tab) ?? null;
}

/** /deliverables?deliverable=<id> (DELIVERABLE_PARAM), or the gallery. */
function deliverablesRoute(query: Query): string {
  const id = idParam(query, 'deliverable');
  return id ? routes.cc.deliverable(id) : routes.cc.deliverables;
}

/** /chat?ticket=<row id> (D31), /chat?chatId=<id> (chatHref), or just the chat: home. */
function chatRoute(query: Query): string {
  const ticket = idParam(query, 'ticket');
  if (ticket && isTaskId(ticket)) return chatWithTicket(ticket);
  const chatId = idParam(query, 'chatId');
  return chatId ? routes.chat(chatId) : routes.home;
}

const MAPPERS: ReadonlyMap<string, Mapper> = new Map<string, Mapper>([
  ['/command-center', commandCentreRoute],
  ['/deliverables', deliverablesRoute],
  ['/chat', chatRoute],
]);

/** Studio's page for a path, or null when the current server has no web URL to open it on. */
export function studioUrl(path: string, webUrl: string = currentWebUrl()): string | null {
  const base = withoutTrailingSlash(webUrl.trim());
  return base && isInternalPath(path) ? `${base}${path}` : null;
}

/**
 * Where a web link opens: an app route when the phone has the screen, Studio in the system browser
 * for any other internal path, and null for anything that is not an internal path (or an
 * external page when the current server has no Studio address).
 */
export function appRouteForWebLink(
  link: string,
  webUrl: string = currentWebUrl(),
): WebLinkTarget | null {
  const trimmed = link.trim();
  if (!isInternalPath(trimmed)) return null;
  const { path, query } = splitLink(trimmed);
  const app = MAPPERS.get(path)?.(query) ?? null;
  if (app !== null) return { app };
  const external = studioUrl(trimmed, webUrl);
  return external === null ? null : { external };
}

/** A universal link or App Link: https and its host (app.json K9: https://ui.automatos.app/…). */
const APP_LINK_ORIGIN = /^https:\/\/[^/?#]*/i;
/** app/go/** opens these itself (the pairing link, US-006g): never rewritten. */
const OWN_ROUTE_PREFIX = '/go';
/** No Studio address: a page the phone has no screen for is not sent to the browser from here. */
const NO_STUDIO = '';

/** The path and query of an https link, or a bare internal path as it is; null for anything else. */
function systemLinkPath(link: string): string | null {
  const origin = APP_LINK_ORIGIN.exec(link);
  if (origin === null) return isInternalPath(link) ? link : null;
  const rest = link.slice(origin[0].length);
  return rest.startsWith('/') ? rest : `/${rest}`;
}

function isOwnRoute(path: string): boolean {
  return path === OWN_ROUTE_PREFIX || path.startsWith(`${OWN_ROUTE_PREFIX}/`);
}

/**
 * Where a link the OS hands the app opens (expo-router's redirectSystemPath): a web link the phone
 * has a screen for opens that screen, by the same mapping as a link inside the app. /go and every
 * /go/* path, an automatos:// link, a page with no screen and anything malformed go on exactly as
 * they came. Opens nothing by itself, reads no server state and never throws. The OS hands over
 * only the hosts app.json names, and any app can already open automatos:// paths, so the host is
 * not checked: the result is only ever an app route.
 */
export function appPathForSystemLink(link: string): string {
  try {
    const path = systemLinkPath(link.trim());
    if (path === null || isOwnRoute(splitLink(path).path)) return link;
    const target = appRouteForWebLink(path, NO_STUDIO);
    return target !== null && 'app' in target ? target.app : link;
  } catch {
    return link; // expo-router crashes the app on a throw here: the link goes on as it came
  }
}
