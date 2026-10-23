// Where a Deliverable's file is loaded from, pure but for the client's headers (D-ONE-CLIENT). The
// link is resolved the way the web's Open does (deliverable-open-button.tsx): preview_url, else
// content_url; an http(s) link to another site stays a link (the system browser, and never with the
// bearer), and anything else is an API route behind auth (/api/workspaces/{id}/files/raw?path=…),
// loaded with the client's bearer and X-Workspace-ID, never opened in a browser. A workspace file's
// content route answers JSON for the web's code viewer, so it becomes the same file's raw route
// (the web's download.ts, M49): the phone always wants the bytes.

import type { ApiClient } from '../../api/client';
import type { AuthHeaders } from '../../api/auth-headers';
import { buildUrl, withoutTrailingSlash } from '../../api/url';
import { CC_ROUTES } from '../routes';
import type { ViewerFormat } from './file-kind';
import type { DeliverableDetail } from './schemas';

export type FileLink =
  /** On the API: loaded with the bearer and the workspace. */
  | { readonly kind: 'api'; readonly url: string }
  /** Another site: the system browser, with nothing of the session. */
  | { readonly kind: 'external'; readonly url: string };

export type ApiFileLink = Extract<FileLink, { readonly kind: 'api' }>;

/** What a native load (expo-file-system, React Native's Image) sends. */
export type AuthenticatedRequest = { readonly url: string; readonly headers: AuthHeaders };

const ABSOLUTE_HTTP = /^(https?:\/\/[^/?#]+)/i;
/** Whitespace or a control character: not a link the server built. */
const UNSAFE_CHARACTERS = /[\s\u0000-\u001f\u007f]/;
/** A workspace file's JSON content route: the workspace id, then the path as the query encodes it. */
const CONTENT_ROUTE = /^\/api\/workspaces\/([^/?#]+)\/files\/content\?path=([^&#]*)/;
const UNSAFE_NAME = /[^A-Za-z0-9._-]+/g;
const NAME_MAX_CHARS = 96;
const DEFAULT_NAME = 'deliverable';

/** The file's link as the web's Open picks it: preview_url, else content_url; null when neither. */
export function fileHref(
  file: Pick<DeliverableDetail, 'preview_url' | 'content_url'>,
): string | null {
  return file.preview_url?.trim() || file.content_url?.trim() || null;
}

function originOf(url: string): string | null {
  return ABSOLUTE_HTTP.exec(url)?.[1]?.toLowerCase() ?? null;
}

function decoded(text: string): string | null {
  try {
    return decodeURIComponent(text);
  } catch {
    return null; // not valid percent-encoding: the route is kept as the server sent it
  }
}

/** A content route as the same file's raw route; any other API path unchanged. */
function rawRoute(apiUrl: string, path: string): string {
  const match = CONTENT_ROUTE.exec(path);
  const workspaceId = match ? decoded(match[1]) : null;
  const filePath = match ? decoded(match[2]) : null;
  if (!workspaceId || filePath === null) return `${withoutTrailingSlash(apiUrl)}${path}`;
  return buildUrl(
    apiUrl,
    CC_ROUTES.deliverables.rawFile.path,
    { workspace_id: workspaceId },
    { path: filePath },
  );
}

/** Where the file loads from on this server, or null for a link the phone does not follow. */
export function fileLink(href: string | null, apiUrl: string): FileLink | null {
  const link = href?.trim() ?? '';
  if (!link || UNSAFE_CHARACTERS.test(link)) return null;
  const origin = originOf(link);
  if (origin !== null) {
    return origin === originOf(apiUrl)
      ? { kind: 'api', url: link }
      : { kind: 'external', url: link };
  }
  const apiPath = link.startsWith('/') && !link.startsWith('//');
  return apiPath ? { kind: 'api', url: rawRoute(apiUrl, link) } : null;
}

/** The URL and the client's own bearer and workspace headers, for a load outside its fetch. */
export async function authenticatedRequest(
  client: ApiClient,
  link: ApiFileLink,
): Promise<AuthenticatedRequest> {
  return { url: link.url, headers: await client.authHeaders() };
}

/**
 * The name the downloaded copy is saved under: the file's own, made safe for a path, with the
 * format's extension (QuickLook reads the type from it); 'deliverable.pdf' when it has none.
 */
export function viewerFileName(name: string | null | undefined, format: ViewerFormat): string {
  const base = (name ?? '').split('/').pop() ?? '';
  const stem = base.toLowerCase().endsWith(`.${format}`) ? base.slice(0, -format.length - 1) : base;
  const safe = stem
    .replace(UNSAFE_NAME, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, NAME_MAX_CHARS);
  return `${safe || DEFAULT_NAME}.${format}`;
}
