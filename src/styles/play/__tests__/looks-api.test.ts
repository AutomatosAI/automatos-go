// The looks routes over the one client (US-017d): the theme id as two path segments (never '%2F'),
// both fields on every PUT, the answer read by zod with each look through the theme's check, and a
// failure as the taxonomy's ApiError (a 404 is 'not installed').

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../../api/client';
import { isApiError } from '../../../api/errors';
import { SERVER, fakeTransport, jsonReply } from '../../../api/__tests__/fake-transport';
import type { TransportRequest } from '../../../api/transport-types';
import { AURORA, OBSIDIAN } from '../../../core/web/lib/looks/presets';
import { logger } from '../../../lib/logger';
import { HUD_LOOK_RULES } from '../../hud/hud-looks';
import { HUD_DEFAULT_LOOK } from '../../hud/look-schema';
import { STYLE_ROUTES } from '../../routes';
import {
  HUD_THEME_ID,
  PLAY_THEME_ID,
  fetchLooks,
  fetchPlayLooks,
  looksRoute,
  savePlayLooks,
} from '../looks-api';

const SAVED = { ...OBSIDIAN, id: 'look-1', name: 'My look 1', sub: 'Your look' };

function clientAnswering(status: number, value: unknown) {
  const transport = fakeTransport(() => jsonReply(status, value));
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'tok',
    getWorkspaceId: () => 'ws-1',
    transport,
  });
  return { client, calls: transport.calls };
}

function pathOf(request: TransportRequest | undefined): string {
  return request ? request.url.slice(SERVER.apiUrl.length) : '';
}

beforeEach(() => {
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the route', () => {
  it('sends the theme id as two path segments', () => {
    expect(PLAY_THEME_ID).toBe('automatos/play');
    expect(HUD_THEME_ID).toBe('automatos/hud');
    expect(looksRoute(STYLE_ROUTES.looks.read, PLAY_THEME_ID)).toEqual({
      method: 'GET',
      path: '/api/themes/looks/automatos/play',
    });
    expect(looksRoute(STYLE_ROUTES.looks.save, HUD_THEME_ID).path).toBe(
      '/api/themes/looks/automatos/hud',
    );
  });

  it('encodes each segment on its own and refuses an id a resolver would collapse', () => {
    expect(looksRoute(STYLE_ROUTES.looks.read, 'acme/a b?').path).toBe(
      '/api/themes/looks/acme/a%20b%3F',
    );
    for (const id of ['', 'acme/', '/play', 'acme/../x', './play']) {
      expect(() => looksRoute(STYLE_ROUTES.looks.read, id)).toThrow(TypeError);
    }
  });
});

describe('a read', () => {
  it('reads the looks under the two segments and checks each one', async () => {
    const { client, calls } = clientAnswering(200, {
      themeId: PLAY_THEME_ID,
      looks: [SAVED, { ...SAVED, id: 'look-2', glow: 99 }],
      active: AURORA,
      defaultLook: 'ember',
      dropped: 0,
      extra: 'ignored',
    });
    const served = await fetchPlayLooks(client);
    expect(calls[0]?.method).toBe('GET');
    expect(pathOf(calls[0])).toBe('/api/themes/looks/automatos/play');
    expect(served.saved).toEqual([SAVED]);
    expect(served.active).toEqual(AURORA);
    expect(served.dropped).toBe(1);
  });

  it("reads HUD's looks with HUD's check, and a null defaultLook", async () => {
    const { client, calls } = clientAnswering(200, {
      themeId: HUD_THEME_ID,
      looks: [],
      active: HUD_DEFAULT_LOOK,
      defaultLook: null,
      dropped: 0,
    });
    const served = await fetchLooks(client, HUD_LOOK_RULES);
    expect(pathOf(calls[0])).toBe('/api/themes/looks/automatos/hud');
    expect(served.active).toEqual(HUD_DEFAULT_LOOK);
    expect(served.defaultLook).toBeNull();
  });

  it("is the taxonomy's not_found when the theme isn't installed", async () => {
    const { client } = clientAnswering(404, {
      detail: "This theme isn't installed in this workspace.",
    });
    const error = await fetchPlayLooks(client).catch((caught: unknown) => caught);
    expect(isApiError(error) && error.kind === 'not_found' && error.status === 404).toBe(true);
  });

  it('is an invalid_response when the answer is not a set of looks', async () => {
    const { client } = clientAnswering(200, { looks: 'nope' });
    const error = await fetchPlayLooks(client).catch((caught: unknown) => caught);
    expect(isApiError(error) && error.kind === 'invalid_response').toBe(true);
  });
});

describe('a save', () => {
  it('PUTs both fields under the two segments', async () => {
    const { client, calls } = clientAnswering(200, {});
    await savePlayLooks(client, { looks: [SAVED], active: null });
    expect(calls[0]?.method).toBe('PUT');
    expect(pathOf(calls[0])).toBe('/api/themes/looks/automatos/play');
    expect(JSON.parse(String(calls[0]?.body))).toEqual({ looks: [SAVED], active: null });
  });
});
