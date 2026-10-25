import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../../api/client';
import { SERVER, fakeTransport, jsonReply, reply } from '../../../api/__tests__/fake-transport';
import type { TransportRequest } from '../../../api/transport-types';
import { logger } from '../../../lib/logger';
import { memoryStorage } from '../../../storage/encrypted-storage';

// sync.ts, one read applied to the style store, with the native file and font loaders replaced:
// following Studio onto a theme (its painting and its fonts in one crossfade), a read that fails
// keeps what the phone had, a withdrawn theme on screen is back on Studio with one toast, two calls
// for one session share a read, and a read finished after the workspace changed is dropped.
const loaders = vi.hoisted(() => ({
  fontsLoaded: [] as string[],
  filesFetched: [] as string[],
}));

vi.mock('../files', () => ({
  cachePaintFiles: async (_client: unknown, paint: { installId: string }, kind: string) => {
    loaders.filesFetched.push(`${kind}:${paint.installId}`);
    return true;
  },
  localThemeFile: () => null,
}));

vi.mock('../fonts', () => ({
  loadThemeFonts: async (paint: { installId: string }) => {
    loaders.fontsLoaded.push(paint.installId);
    return { installId: paint.installId, families: { sans: `theme-${paint.installId}-sans` } };
  },
  applyThemeFonts: async () => undefined,
}));

const { refreshThemes, sessionKey, watchPaintFiles } = await import('../sync');
const { appStyleSources, createStyleStore } = await import('../../provider/store');
const { FOLLOW_STUDIO, builtinChoice, themeChoice } = await import('../../registry/style-id');
const { DAY_TOKENS, FONT_URL, HARBOUR_ID, PLAY_ID, WITH_MOBILE_THEME } = await import('./fixtures');

type Routes = Readonly<Record<string, unknown>>;

const ROW = { themeId: 'acme/harbour', name: 'Harbour', version: '1.1.0', revoked: null };

function mobileAnswer(installId: string) {
  return {
    schema: 1,
    installId,
    themeId: 'acme/harbour',
    version: '1.1.0',
    mobile: {
      source: 'tokens',
      tone: null,
      tokens: { light: DAY_TOKENS, dark: null },
      fonts: { sans: FONT_URL },
      mascot: { mode: 'none', states: [] },
    },
  };
}

function activeOn(installId: string, themeId = 'acme/harbour') {
  return { choice: installId, source: 'choice', theme: { installId, themeId, version: '1.1.0' } };
}

function serverWith(routes: Routes) {
  const answer = (request: TransportRequest) => {
    const path = request.url.slice(SERVER.apiUrl.length);
    if (!(path in routes)) return reply(404);
    const value = routes[path];
    return value instanceof Error ? reply(503) : jsonReply(200, value);
  };
  return createApiClient({
    server: SERVER,
    getToken: async () => 'tok',
    getWorkspaceId: () => 'ws-1',
    transport: fakeTransport(answer),
  });
}

function harbourServer(active: unknown = activeOn(HARBOUR_ID)) {
  return serverWith({
    '/api/themes/active': active,
    '/api/themes/installed': { installs: [{ installId: HARBOUR_ID, ...ROW }] },
    [`/api/themes/mobile/${HARBOUR_ID}`]: mobileAnswer(HARBOUR_ID),
  });
}

function setup(client = harbourServer(), session = sessionKey(SERVER.apiUrl, 'ws-1')) {
  const store = createStyleStore(appStyleSources(() => memoryStorage()));
  const crossfade = vi.fn((swap: () => void) => swap());
  const onLost = vi.fn();
  const deps = {
    session,
    client,
    discovery: WITH_MOBILE_THEME,
    store,
    crossfade,
    reduceMotion: false,
    onLost,
  };
  return { store, crossfade, onLost, deps };
}

beforeEach(() => {
  loaders.fontsLoaded.length = 0;
  loaders.filesFetched.length = 0;
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a read applied', () => {
  it('follows Studio onto a theme with its painting, rows and fonts, in one crossfade', async () => {
    const { store, crossfade, onLost, deps } = setup();
    await refreshThemes(deps);
    const state = store.getState();
    expect(state.choice).toEqual(FOLLOW_STUDIO);
    expect(state.followed).toEqual(themeChoice(HARBOUR_ID));
    expect(state.themePaint?.installId).toBe(HARBOUR_ID);
    expect(state.themes.map((theme) => theme.name)).toEqual(['Harbour']);
    expect(state.themeFonts).toEqual({
      installId: HARBOUR_ID,
      families: { sans: `theme-${HARBOUR_ID}-sans` },
    });
    expect(loaders.filesFetched).toEqual([`font:${HARBOUR_ID}`]);
    expect(crossfade).toHaveBeenCalledTimes(1);
    expect(onLost).not.toHaveBeenCalled();
  });

  it("follows Studio onto Play's web theme with Auto's hello", async () => {
    const play = serverWith({
      '/api/themes/active': activeOn(PLAY_ID, 'automatos/play'),
      '/api/themes/installed': { installs: [] },
    });
    const { store, deps } = setup(play);
    await refreshThemes(deps);
    expect(store.getState().followed).toEqual(builtinChoice('play'));
    expect(store.getState().playEntries).toBe(1);
  });

  it('keeps a style picked on the phone over what Studio uses, without a crossfade', async () => {
    const { store, crossfade, deps } = setup();
    store.getState().setChoice(builtinChoice('hud'));
    await refreshThemes(deps);
    expect(store.getState().choice).toEqual(builtinChoice('hud'));
    expect(store.getState().followed).toEqual(themeChoice(HARBOUR_ID));
    expect(crossfade).not.toHaveBeenCalled();
    expect(loaders.fontsLoaded).toEqual([]);
  });

  it('keeps what the phone had when the read fails (no fallback on a passing fault)', async () => {
    const down = serverWith({
      '/api/themes/active': new Error('down'),
      '/api/themes/installed': new Error('down'),
    });
    const { store, deps } = setup(down);
    store.getState().setFollowed(themeChoice(HARBOUR_ID));
    await refreshThemes(deps);
    expect(store.getState().followed).toEqual(themeChoice(HARBOUR_ID));
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('could not be read'),
      expect.anything(),
    );
  });
});

describe('the revoked fallback', () => {
  it('a withdrawn theme on screen is back on Studio with one toast', async () => {
    const { store, onLost, deps } = setup();
    await refreshThemes(deps);
    const withdrawn = serverWith({
      '/api/themes/active': {
        choice: 'studio',
        source: 'choice',
        theme: null,
        revoked: { installId: HARBOUR_ID, level: 'disable', reason: 'withdrawn' },
      },
      '/api/themes/installed': {
        installs: [{ installId: HARBOUR_ID, ...ROW, revoked: { level: 'disable' } }],
      },
    });
    await refreshThemes({ ...deps, client: withdrawn });
    expect(store.getState().followed).toEqual(builtinChoice('studio'));
    expect(store.getState().themePaint).toBeNull();
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('a theme picked on the phone that is uninstalled: the choice becomes Studio, one toast', async () => {
    const { store, onLost, deps } = setup(
      harbourServer({ choice: 'studio', source: 'choice', theme: null }),
    );
    await refreshThemes(deps);
    store.getState().setThemePaint(store.getState().themes[0].paint);
    store.getState().setChoice(themeChoice(HARBOUR_ID));
    const gone = serverWith({
      '/api/themes/active': { choice: 'studio', source: 'choice', theme: null },
      '/api/themes/installed': { installs: [] },
    });
    await refreshThemes({ ...deps, client: gone });
    expect(store.getState().choice).toEqual(builtinChoice('studio'));
    expect(onLost).toHaveBeenCalledTimes(1);
  });
});

describe('one read at a time per session', () => {
  it('a second call for the same session joins the read', () => {
    const { deps } = setup();
    expect(refreshThemes(deps)).toBe(refreshThemes(deps));
  });

  it('a read finished after the workspace changed is never applied', async () => {
    const { store, deps } = setup();
    const first = refreshThemes(deps);
    const next = refreshThemes({
      ...deps,
      session: sessionKey(SERVER.apiUrl, 'ws-2'),
      client: serverWith({}),
    });
    expect(next).not.toBe(first);
    await Promise.all([first, next]);
    expect(store.getState().themes).toEqual([]);
    expect(store.getState().followed).toEqual(builtinChoice('studio'));
  });
});

describe('watchPaintFiles', () => {
  it('fetches the files of the theme on screen, and of each theme the phone comes to paint', async () => {
    const { store, deps } = setup();
    await refreshThemes(deps);
    loaders.filesFetched.length = 0;
    const stop = watchPaintFiles(deps.client, store);
    await vi.waitFor(() => expect(loaders.filesFetched).toContain(`mascot:${HARBOUR_ID}`));
    store.getState().setChoice(builtinChoice('play'));
    const count = loaders.filesFetched.length;
    await Promise.resolve();
    expect(loaders.filesFetched).toHaveLength(count);
    stop();
  });
});
