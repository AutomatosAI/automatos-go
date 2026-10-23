// Where a link in Auto's answer opens, pure (OT-C8), through the app's own link handling (never a
// WebView, D-NO-WEBVIEW): an internal path ('/command-center?tab=board&task_id=42') and a link to
// the current server's Studio are mapped by the foundation's appRouteForWebLink, so they open an
// app screen or Studio in the system browser, as a receipt's link does; any other web page (http or
// https) and a mailto: address open in the system's own app, as the web opens Auto's links in a new
// tab. Anything else (javascript:, a file, a relative path, an anchor, a link with whitespace or a
// control character) is not a link: its words show as plain text.

import { withoutTrailingSlash } from '../../api/url';
import { currentWebUrl } from '../../connect/current-server';
import { appRouteForWebLink, type WebLinkTarget } from '../../navigation/web-links';

/** http(s) with a host and no user part ('https://studio@evil.example' is not a link). */
const WEB_PAGE = /^https?:\/\/[^\s/?#@]+(?:[/?#]|$)/i;
const MAIL_ADDRESS = /^mailto:[^\s@/?#]+@[^\s@/?#]+$/i;
const UNSAFE_CHARACTERS = /[\s\u0000-\u001f\u007f]/;
const STUDIO_REST = /^[/?#]/;

/** The path of a link to the current Studio ('https://ui.example/deliverables': '/deliverables'). */
function studioPath(link: string, webUrl: string): string | null {
  const base = withoutTrailingSlash(webUrl.trim());
  if (!base || !link.toLowerCase().startsWith(base.toLowerCase())) return null;
  const rest = link.slice(base.length);
  if (rest === '') return '/';
  if (!STUDIO_REST.test(rest)) return null; // another host that merely starts with Studio's
  return rest.startsWith('/') ? rest : `/${rest}`;
}

/**
 * What tapping a link in Auto's answer opens; null when the words should not be a link at all.
 * `webUrl` is the current server's Studio (EXPO_PUBLIC_WEB_URL or the paired server's web_url).
 */
export function markdownLinkTarget(
  href: string,
  webUrl: string = currentWebUrl(),
): WebLinkTarget | null {
  const link = href.trim();
  if (!link || UNSAFE_CHARACTERS.test(link)) return null;
  if (link.startsWith('/')) return appRouteForWebLink(link, webUrl);
  const path = studioPath(link, webUrl);
  if (path !== null) return appRouteForWebLink(path, webUrl);
  return WEB_PAGE.test(link) || MAIL_ADDRESS.test(link) ? { external: link } : null;
}
