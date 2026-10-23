// Where a link in Auto's answer opens, pure (OT-C8), through the app's own link handling (never a
// WebView, D-NO-WEBVIEW): an internal path ('/command-center?tab=board&task_id=42') and a link to
// the current server's Studio are mapped by the foundation's appRouteForWebLink, so they open an
// app screen or Studio in the system browser with one tap, as a receipt's link does; any other web
// page (http or https) and a mailto: address open in the system's own app, as the web opens Auto's
// links in a new tab, but only after the reader has seen where they go (markdownLink's `site`: its
// host and full address, which InlineText asks about first). A phone has no hover to show a link's
// address, and Auto's words can carry a link from a document or an email it read. Anything else
// (javascript:, a file, a relative path, an anchor, a link with whitespace or a control character)
// is not a link: its words show as plain text.

import { withoutTrailingSlash } from '../../api/url';
import { currentWebUrl } from '../../connect/current-server';
import { appRouteForWebLink, type WebLinkTarget } from '../../navigation/web-links';

/** http(s) with a host and no user part ('https://studio@evil.example' is not a link). */
const WEB_PAGE = /^https?:\/\/[^\s/?#@]+(?:[/?#]|$)/i;
const MAIL_ADDRESS = /^mailto:[^\s@/?#]+@[^\s@/?#]+$/i;
const UNSAFE_CHARACTERS = /[\s\u0000-\u001f\u007f]/;
const STUDIO_REST = /^[/?#]/;
const WEB_SCHEME = /^https?:\/\//i;
const MAIL_SCHEME = /^mailto:/i;
const HOST_END = /[/?#]/;

/** Another site a link in Auto's answer opens: the reader sees its host and address first. */
export type OtherSite = { readonly host: string; readonly address: string };

/** A link in Auto's answer: where it opens, and the other site it is, if it is one. */
export type MarkdownLink = { readonly target: WebLinkTarget; readonly site: OtherSite | null };

/** The path of a link to the current Studio ('https://ui.example/deliverables': '/deliverables'). */
function studioPath(link: string, webUrl: string): string | null {
  const base = withoutTrailingSlash(webUrl.trim());
  if (!base || !link.toLowerCase().startsWith(base.toLowerCase())) return null;
  const rest = link.slice(base.length);
  if (rest === '') return '/';
  if (!STUDIO_REST.test(rest)) return null; // another host that merely starts with Studio's
  return rest.startsWith('/') ? rest : `/${rest}`;
}

/** The host of a web page ('https://Evil.example:8443/x': 'evil.example:8443'), or the address. */
function siteOf(link: string): OtherSite {
  const host = MAIL_SCHEME.test(link)
    ? link.replace(MAIL_SCHEME, '')
    : link.replace(WEB_SCHEME, '').split(HOST_END, 1)[0].toLowerCase();
  return { host, address: link };
}

/** An app screen or a Studio page: one tap; null when the foundation maps it nowhere. */
function inApp(target: WebLinkTarget | null): MarkdownLink | null {
  return target === null ? null : { target, site: null };
}

/**
 * A link in Auto's answer: where tapping it opens, and the other site it is (shown to the reader
 * before it opens); null when the words should not be a link at all. `webUrl` is the current
 * server's Studio (EXPO_PUBLIC_WEB_URL or the paired server's web_url).
 */
export function markdownLink(href: string, webUrl: string = currentWebUrl()): MarkdownLink | null {
  const link = href.trim();
  if (!link || UNSAFE_CHARACTERS.test(link)) return null;
  if (link.startsWith('/')) return inApp(appRouteForWebLink(link, webUrl));
  const path = studioPath(link, webUrl);
  if (path !== null) return inApp(appRouteForWebLink(path, webUrl));
  if (!WEB_PAGE.test(link) && !MAIL_ADDRESS.test(link)) return null;
  return { target: { external: link }, site: siteOf(link) };
}

/** What tapping a link in Auto's answer opens; null when the words should not be a link at all. */
export function markdownLinkTarget(
  href: string,
  webUrl: string = currentWebUrl(),
): WebLinkTarget | null {
  return markdownLink(href, webUrl)?.target ?? null;
}
