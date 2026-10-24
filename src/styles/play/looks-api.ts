// The looks routes over the one client (D-ONE-CLIENT, STYLE_ROUTES.looks): a member's looks for one
// theme, read and replaced (orchestrator/api/themes_looks.py; gate members:read, per workspace and
// per user). The theme id is 'publisher/slug' and the route takes it as a path ('{theme_id:path}'),
// so it is sent as its own segments, 'automatos/play', never 'automatos%2Fplay'. FOUNDATION GAP:
// the client fills only '{name}' parameters and encodes the whole value (src/api/url.ts fillPath),
// so looksRoute fills this one here, each segment encoded on its own. Every failure is the
// taxonomy's ApiError: a 404 is 'This theme isn't installed in this workspace.' (look-sync.ts).

import type { ApiClient } from '../../api/client';
import type { Route } from '../../api/routes';
import { HUD_THEME_ID } from '../hud/hud-looks';
import { STYLE_ROUTES } from '../routes';
import type { LookDoc, LookRules } from './look-sync';
import {
  LooksAnswerSchema,
  servedLooks,
  type LooksBody,
  type ServedLooks,
} from './looks-schemas';
import { PLAY_LOOK_RULES, PLAY_THEME_ID } from './play-looks';

export { HUD_THEME_ID, PLAY_THEME_ID };

const THEME_ID_PARAM = '{theme_id:path}';
/** Segments a URL resolver would collapse, re-aiming the request at another path. */
const UNUSABLE_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..']);

/** `route` with the theme id in place, each of its segments encoded on its own. */
export function looksRoute(route: Route, themeId: string): Route {
  const segments = themeId.split('/');
  if (segments.some((segment) => UNUSABLE_SEGMENTS.has(segment))) {
    throw new TypeError(`"${themeId}" is not a theme id`);
  }
  const path = route.path.replace(THEME_ID_PARAM, segments.map(encodeURIComponent).join('/'));
  return { method: route.method, path };
}

/** This member's looks for the theme, each through its check (looks-schemas.ts servedLooks). */
export async function fetchLooks<L extends LookDoc>(
  client: ApiClient,
  rules: LookRules<L>,
  signal?: AbortSignal,
): Promise<ServedLooks<L>> {
  const route = looksRoute(STYLE_ROUTES.looks.read, rules.themeId);
  const answer = await client.request(route, { schema: LooksAnswerSchema, signal });
  return servedLooks(rules, answer);
}

/** Replaces this member's looks for the theme: both fields, every time (looks.py BODY_SHAPE). */
export async function saveLooks(
  client: ApiClient,
  themeId: string,
  body: LooksBody,
): Promise<void> {
  const route = looksRoute(STYLE_ROUTES.looks.save, themeId);
  await client.request(route, { body: { looks: body.looks, active: body.active } });
}

export function fetchPlayLooks(client: ApiClient, signal?: AbortSignal) {
  return fetchLooks(client, PLAY_LOOK_RULES, signal);
}

export function savePlayLooks(client: ApiClient, body: LooksBody): Promise<void> {
  return saveLooks(client, PLAY_THEME_ID, body);
}
