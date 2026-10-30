// Candy's looks in step with the web over the style store and a fake server (D-CAN-3), as Arcade's
// are in arcade-look-sync.test.ts: a Candy look saved on the web paints the phone; a look saved on
// the phone is PUT once to /api/themes/looks/automatos/candy (the theme id as path segments, never
// '%2F'), both fields; Candy not installed (404) keeps it on the phone and the look page shows
// Candy's words; a server look failing the schema (roundness '41', glow 6.5, palette 'mint') is
// dropped and counted; the marks stay beside the looks across a relaunch; and Candy's runner never
// touches Play's, HUD's or Arcade's looks.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../../api/client';
import { SERVER, fakeTransport, jsonReply } from '../../../api/__tests__/fake-transport';
import type { TransportRequest } from '../../../api/transport-types';
import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import {
  CANDY_LOOK_RULES,
  CANDY_THEME_ID,
  pickLook,
  saveAsNew,
  setKnob,
  setNumber,
} from '../../candy/candy-looks';
import { CANDY_PRESET_LOOKS, type CandyLook } from '../../candy/look-schema';
import { lookSyncNotice } from '../../play/look-sync';
import { fetchLooks } from '../../play/looks-api';
import { appStyleSources, createStyleStore } from '../../provider/store';
import { LOOK_MARKS_KEYS, LOOK_THEME_KEYS } from '../look-marks';
import { lookSyncRunners, type LookSyncTarget } from '../look-sync-run';
import { NOT_INSTALLED_COPY } from '../look-themes';

const LILAC = CANDY_PRESET_LOOKS[1] as CandyLook;
const LOOKS_PATH = '/api/themes/looks/';
const MINE: CandyLook = Object.freeze({
  ...LILAC,
  id: 'mine-1',
  name: 'My look 1',
  sub: 'From Lilac',
  glow: 9,
});

type Kept = { looks: unknown[]; active: unknown; dropped?: number };

/** A server holding each installed theme's looks; a theme it lacks answers 404. */
function fakeServer(installed: Partial<Record<string, Kept>>) {
  const kept: Record<string, Kept | undefined> = { ...installed };
  const answer = async (request: TransportRequest) => {
    const themeId = request.url.slice(`${SERVER.apiUrl}${LOOKS_PATH}`.length);
    const set = kept[themeId];
    if (!set) return jsonReply(404, { detail: "This theme isn't installed in this workspace." });
    if (request.method === 'PUT') kept[themeId] = JSON.parse(String(request.body)) as Kept;
    const { looks, active, dropped = 0 } = kept[themeId] ?? set;
    return jsonReply(200, { themeId, looks, active, defaultLook: null, dropped });
  };
  const transport = fakeTransport(answer);
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'tok',
    getWorkspaceId: () => 'ws-1',
    transport,
  });
  const puts = () => transport.calls.filter((call) => call.method === 'PUT');
  return { client, puts, calls: () => transport.calls };
}

function pathOf(request: TransportRequest | undefined): string {
  return request ? request.url.slice(SERVER.apiUrl.length) : '';
}

function storeOn(storage: KeyValueStorage = memoryStorage()) {
  return createStyleStore(appStyleSources(() => storage));
}

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

function target(client: LookSyncTarget['client']): LookSyncTarget {
  return { client, session: 'api|ws-1|user_1' };
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Candy in step with the web', () => {
  it('is one of the themes the phone keeps in step, its marks beside its looks', () => {
    expect(LOOK_THEME_KEYS).toContain('candy');
    expect(LOOK_MARKS_KEYS.candy).toBe('styles.candy.looks.sync');
  });

  it('paints the phone with the Candy look saved on the web, read by path segments', async () => {
    const server = fakeServer({ [CANDY_THEME_ID]: { looks: [MINE], active: MINE } });
    const store = storeOn();
    await lookSyncRunners(store).candy.refresh(target(server.client));
    expect(store.getState().candyLooks).toEqual({ saved: [MINE], active: MINE });
    expect(store.getState().lookSync.candy.synced).toBe('server');
    expect(pathOf(server.calls()[0])).toBe('/api/themes/looks/automatos/candy');
    expect(server.puts()).toEqual([]);
  });

  it("PUTs a look saved on the phone once to /api/themes/looks/automatos/candy, never '%2F'", async () => {
    const server = fakeServer({ [CANDY_THEME_ID]: { looks: [], active: null } });
    const store = storeOn();
    const { candy } = lookSyncRunners(store);
    const at = target(server.client);
    candy.attach(at);
    await candy.refresh(at);
    const onLilac = pickLook(store.getState().candyLooks, 'lilac');
    const saved = saveAsNew(setNumber(onLilac, 'glow', 9));
    if (!saved.ok) throw new Error('saved');
    store.getState().setCandyLooks(saved.looks);
    await settle();
    expect(server.puts()).toHaveLength(1);
    expect(pathOf(server.puts()[0])).toBe('/api/themes/looks/automatos/candy');
    expect(server.puts()[0]?.url).not.toContain('%2F');
    expect(JSON.parse(String(server.puts()[0]?.body))).toEqual({ looks: [MINE], active: MINE });
    expect(store.getState().lookSync.candy).toMatchObject({ lookChanged: false, synced: 'server' });
  });

  it("keeps the look on the phone and says so where Candy isn't installed (404)", async () => {
    const server = fakeServer({});
    const store = storeOn();
    const { candy } = lookSyncRunners(store);
    const at = target(server.client);
    candy.attach(at);
    await candy.refresh(at);
    const state = store.getState();
    state.setCandyLooks(setKnob(state.candyLooks, 'palette', 'nightbloom'));
    await settle();
    expect(store.getState().candyLooks.active.palette).toBe('nightbloom');
    const status = store.getState().lookSync.candy;
    expect(status).toMatchObject({ synced: 'local-only', lookChanged: true });
    expect(lookSyncNotice(status, NOT_INSTALLED_COPY.candy)).toBe(
      "Candy isn't installed in this workspace, so your looks stay on this phone.",
    );
    expect(server.puts()).toEqual([]);
  });

  it('drops and counts a look from the server that fails the schema', async () => {
    const round = { ...MINE, id: 'mine-2', roundness: '41' };
    const half = { ...MINE, id: 'mine-3', glow: 6.5 };
    const mint = { ...MINE, id: 'mine-4', palette: 'mint' };
    const looks = [MINE, round, half, mint];
    const server = fakeServer({ [CANDY_THEME_ID]: { looks, active: mint, dropped: 1 } });
    const served = await fetchLooks(server.client, CANDY_LOOK_RULES);
    expect(served.saved).toEqual([MINE]);
    expect(served.active).toBeNull();
    expect(served.dropped).toBe(5);
    const counted = '[styles] 5 automatos/candy look(s) could not be read; left out';
    expect(warn).toHaveBeenCalledWith(counted);
    const store = storeOn();
    await lookSyncRunners(store).candy.refresh(target(server.client));
    expect(store.getState().candyLooks.saved).toEqual([MINE]);
  });

  it('keeps an offline change marked across a relaunch, beside the looks', async () => {
    const storage = memoryStorage();
    const before = storeOn(storage);
    const { candy } = lookSyncRunners(before);
    candy.attach(target(fakeServer({}).client));
    before.getState().setCandyLooks(pickLook(before.getState().candyLooks, 'nightbloom'));
    const relaunched = storeOn(storage).getState();
    expect(relaunched.candyLooks.active.id).toBe('nightbloom');
    expect(relaunched.lookSync.candy).toMatchObject({ lookChanged: true, synced: 'pending' });
    expect(storage.getItem(LOOK_MARKS_KEYS.candy)).not.toBeNull();
  });

  it("never touches Play's, HUD's or Arcade's looks", async () => {
    const server = fakeServer({ [CANDY_THEME_ID]: { looks: [MINE], active: MINE } });
    const store = storeOn();
    const { playLooks, hudLooks, arcadeLooks, lookSync } = store.getState();
    await lookSyncRunners(store).candy.refresh(target(server.client));
    const after = store.getState();
    expect(after.playLooks).toBe(playLooks);
    expect(after.hudLooks).toBe(hudLooks);
    expect(after.arcadeLooks).toBe(arcadeLooks);
    expect(after.lookSync.play).toBe(lookSync.play);
    expect(after.lookSync.hud).toBe(lookSync.hud);
    expect(after.lookSync.arcade).toBe(lookSync.arcade);
  });
});
