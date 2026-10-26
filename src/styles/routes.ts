// The styles' route table (K4, KS4): every server path wave A5 calls, as {method, path}, beside the
// foundation's src/api/routes.ts and never inside it, so the parallel kits stay file-disjoint.
// scripts/check-routes.ts reads it against src/core/route-manifest.json at the pinned automatos-ai
// SHA. Themes are data only (D-NO-CODE): the phone reads which theme Studio uses, the installs, an
// install's phone painting and that painting's font and mascot files, never a theme's JS or CSS.
// Play's and HUD's looks are read and saved per member (US-017d); the theme id travels as its own
// path segments ('automatos/play', never '%2F': play/looks-api.ts looksRoute fills it).

import type { Route } from '../api/routes';

export const STYLE_ROUTES = Object.freeze({
  themes: Object.freeze({
    /** The workspace's installs (services/themes/updates.py install_row): name, version, revoked. */
    installed: { method: 'GET', path: '/api/themes/installed' },
    /** What this member sees in Studio: {choice, source, theme, revoked?} (defaults.py). */
    active: { method: 'GET', path: '/api/themes/active' },
    /** An install as data for the phone (services/themes/mobile.py): tokens, fonts, mascot. */
    mobile: { method: 'GET', path: '/api/themes/mobile/{install_id}' },
    /** A font or mascot file the mobile answer names; the one prefix a theme file URL may have. */
    file: { method: 'GET', path: '/api/themes/files/{digest}/{path:path}' },
  }),
  looks: Object.freeze({
    /** This member's looks for one theme: {themeId, looks, active, defaultLook, dropped}. */
    read: { method: 'GET', path: '/api/themes/looks/{theme_id:path}' },
    /** Replaces them: {looks, active}, both fields every time (themes_looks.py LooksUpdate). */
    save: { method: 'PUT', path: '/api/themes/looks/{theme_id:path}' },
  }),
} as const satisfies Record<string, Record<string, Route>>);
