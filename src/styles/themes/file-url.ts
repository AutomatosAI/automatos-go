// Which theme files the phone may load (D-NO-CODE, App Store guideline 2.5.2,
// docs/theme-host/mobile.md 'What the phone may load'). Pure. A URL from a mobile answer is taken
// only when it is a relative path under /api/themes/files/<digest>/ (services/themes/serve.py
// module_url): no scheme, no host, no '//', no '..', no query, no percent-escape; the package
// digest is 64 lowercase hex; and the file is a font (assets/fonts/mobile/<name>.ttf or .otf) or a
// mascot file (assets/mascot/<state>.mp4 or .png), never a .js, .mjs, .css or .html file. The
// copy on the phone is named by the digest path, so one URL is always the same bytes
// (content-addressed). Fonts are at most 400 KB (core's FONT_MAX_BYTES), mascot files 2 MB each.

import { withoutTrailingSlash } from '../../api/url';
import { STYLE_ROUTES } from '../routes';

/** The one prefix a theme file URL may have: the files route up to its first parameter. */
export const THEME_FILES_PREFIX = STYLE_ROUTES.themes.file.path.slice(
  0,
  STYLE_ROUTES.themes.file.path.indexOf('{'),
);

export type ThemeFileKind = 'font' | 'mascot';

const KB = 1024;

export const THEME_FILE_MAX_BYTES: Readonly<Record<ThemeFileKind, number>> = Object.freeze({
  font: 400 * KB,
  mascot: 2 * KB * KB,
});

/** Never loaded, whatever the server lists (belt and braces over the per-kind patterns). */
const CODE_SUFFIXES: readonly string[] = Object.freeze(['.js', '.mjs', '.css', '.html', '.htm']);

/** The package paths each kind may name (core's MOBILE_FONT_PATTERN and the mascot's states). */
const KIND_PATHS: Readonly<Record<ThemeFileKind, RegExp>> = Object.freeze({
  font: /^assets\/fonts\/mobile\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.(?:ttf|otf)$/,
  mascot: /^assets\/mascot\/[a-z][a-z0-9-]{0,31}\.(?:mp4|png)$/,
});

const DIGEST = /^[0-9a-f]{64}$/;
/** Characters a served URL never needs: a query, a fragment, an escape, a backslash, whitespace. */
const UNSAFE = /[?#%\\\s\u0000-\u001f\u007f]/;

export type ThemeFile = {
  /** The URL as the answer gave it: '/api/themes/files/<digest>/<path>'. */
  readonly url: string;
  readonly kind: ThemeFileKind;
  readonly digest: string;
  /** The path inside the package: 'assets/fonts/mobile/inter-regular.ttf'. */
  readonly path: string;
  readonly maxBytes: number;
};

function hasDotSegment(path: string): boolean {
  return path.includes('..') || path.split('/').some((segment) => segment === '.');
}

/** '<digest>/<path>' after the prefix, for a URL that is plainly a files-route path; else null. */
type UrlParts = { readonly url: string; readonly digest: string; readonly path: string };

function splitUrl(url: unknown): UrlParts | null {
  if (typeof url !== 'string' || !url.startsWith(THEME_FILES_PREFIX)) return null;
  if (UNSAFE.test(url) || url.includes('//')) return null;
  const rest = url.slice(THEME_FILES_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return null;
  return { url, digest: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

/** A package path this kind may name: never code, never a dot segment. */
function allowedPath(path: string, kind: ThemeFileKind): boolean {
  const lower = path.toLowerCase();
  if (hasDotSegment(path) || CODE_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return false;
  return KIND_PATHS[kind].test(path);
}

/** The file behind a theme URL, or null when the phone must not load it. */
export function themeFile(url: unknown, kind: ThemeFileKind): ThemeFile | null {
  const parts = splitUrl(url);
  if (!parts || !DIGEST.test(parts.digest) || !allowedPath(parts.path, kind)) return null;
  return Object.freeze({ ...parts, kind, maxBytes: THEME_FILE_MAX_BYTES[kind] });
}

/** The URL kept as it was when the phone may load it, else null. */
export function allowedThemeUrl(url: unknown, kind: ThemeFileKind): string | null {
  return themeFile(url, kind)?.url ?? null;
}

/** Where the file is downloaded from: the configured API server, never another origin. */
export function themeFileSource(apiUrl: string, file: ThemeFile): string {
  return `${withoutTrailingSlash(apiUrl)}${file.url}`;
}

/** The copy's place under the phone's theme-file folder: '<digest>/<path>' as path segments. */
export function themeFileSegments(file: ThemeFile): readonly string[] {
  return Object.freeze([file.digest, ...file.path.split('/')]);
}
