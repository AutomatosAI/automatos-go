// Arcade's looks in step with the web over the style store and a fake server (D-ARC-3), as HUD's
// are in look-sync-run.test.ts: an Arcade look saved on the web paints the phone; a look saved on
// the phone is PUT once to /api/themes/looks/automatos/arcade, both fields; Arcade not installed
// (404) keeps it on the phone and the look page shows Arcade's words; a look from the server that
// fails the schema is dropped and counted; the marks stay beside the looks across a relaunch; and
// Arcade's runner never touches Play's or HUD's looks.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../../api/client';
import { SERVER, fakeTransport, jsonReply } from '../../../api/__tests__/fake-transport';
import type { TransportRequest } from '../../../api/transport-types';
import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import {
  ARCADE_LOOK_RULES,
  ARCADE_THEME_ID,
  pickLook,
  saveAsNew,
  setKnob,
} from '../../arcade/arcade-looks';
import { ARCADE_PRESET_LOOKS, type ArcadeLook } from '../../arcade/look-schema';
import { lookSyncNotice } from '../../play/look-sync';
import { fetchLooks } from '../../play/looks-api';
import { appStyleSources, createStyleStore } from '../../provider/store';
import { LOOK_MARKS_KEYS, LOOK_THEME_KEYS } from '../look-marks';
import { lookSyncRunners, type LookSyncTarget } from '../look-sync-run';
import { NOT_INSTALLED_COPY } from '../look-themes';

const NEON = ARCADE_PRESET_LOOKS[2] as ArcadeLook;
const LOOKS_PATH = '/api/themes/looks/';
const MINE: ArcadeLook = Object.freeze({
  ...NEON,
  id: 'mine-1',
  name: 'Save slot 1',
  sub: 'From Neon Cabinet',
  textSpeed: 'slow',
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
  return { client, puts };
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

describe('Arcade in step with the web', () => {
  it('is one of the themes the phone keeps in step, its marks beside its looks', () => {
    expect(LOOK_THEME_KEYS).toEqual(['play', 'hud', 'arcade', 'candy']);
    expect(LOOK_MARKS_KEYS.arcade).toBe('styles.arcade.looks.sync');
  });

  it('paints the phone with the Arcade look saved on the web', async () => {
    const server = fakeServer({ [ARCADE_THEME_ID]: { looks: [MINE], active: MINE } });
    const store = storeOn();
    await lookSyncRunners(store).arcade.refresh(target(server.client));
    expect(store.getState().arcadeLooks).toEqual({ saved: [MINE], active: MINE });
    expect(store.getState().lookSync.arcade.synced).toBe('server');
    expect(server.puts()).toEqual([]);
  });

  it('PUTs a look saved on the phone once to /api/themes/looks/automatos/arcade', async () => {
    const server = fakeServer({ [ARCADE_THEME_ID]: { looks: [], active: null } });
    const store = storeOn();
    const { arcade } = lookSyncRunners(store);
    const at = target(server.client);
    arcade.attach(at);
    await arcade.refresh(at);
    const onNeon = pickLook(store.getState().arcadeLooks, 'neon');
    const saved = saveAsNew(setKnob(onNeon, 'textSpeed', 'slow'));
    if (!saved.ok) throw new Error('saved');
    store.getState().setArcadeLooks(saved.looks);
    await settle();
    expect(server.puts()).toHaveLength(1);
    expect(pathOf(server.puts()[0])).toBe('/api/themes/looks/automatos/arcade');
    expect(JSON.parse(String(server.puts()[0]?.body))).toEqual({ looks: [MINE], active: MINE });
    expect(store.getState().lookSync.arcade).toMatchObject({ lookChanged: false, synced: 'server' });
  });

  it("keeps the look on the phone and says so where Arcade isn't installed (404)", async () => {
    const server = fakeServer({});
    const store = storeOn();
    const { arcade } = lookSyncRunners(store);
    const at = target(server.client);
    arcade.attach(at);
    await arcade.refresh(at);
    const state = store.getState();
    state.setArcadeLooks(setKnob(state.arcadeLooks, 'palette', 'handheld'));
    await settle();
    expect(store.getState().arcadeLooks.active.palette).toBe('handheld');
    const status = store.getState().lookSync.arcade;
    expect(status).toMatchObject({ synced: 'local-only', lookChanged: true });
    expect(lookSyncNotice(status, NOT_INSTALLED_COPY.arcade)).toBe(
      "Arcade isn't installed in this workspace, so your looks stay on this phone.",
    );
    expect(server.puts()).toEqual([]);
  });

  it('drops and counts a look from the server that fails the schema', async () => {
    const broken = { ...MINE, id: 'mine-2', palette: 'forest' };
    const hud = { ...MINE, id: 'mine-3', interface: 'command' };
    const looks = [MINE, broken, hud];
    const server = fakeServer({ [ARCADE_THEME_ID]: { looks, active: broken, dropped: 1 } });
    const served = await fetchLooks(server.client, ARCADE_LOOK_RULES);
    expect(served.saved).toEqual([MINE]);
    expect(served.active).toBeNull();
    expect(served.dropped).toBe(4);
    const counted = '[styles] 4 automatos/arcade look(s) could not be read; left out';
    expect(warn).toHaveBeenCalledWith(counted);
    const store = storeOn();
    await lookSyncRunners(store).arcade.refresh(target(server.client));
    expect(store.getState().arcadeLooks.saved).toEqual([MINE]);
  });

  it('keeps an offline change marked across a relaunch, beside the looks', async () => {
    const storage = memoryStorage();
    const before = storeOn(storage);
    const { arcade } = lookSyncRunners(before);
    arcade.attach(target(fakeServer({}).client));
    before.getState().setArcadeLooks(pickLook(before.getState().arcadeLooks, 'dungeon'));
    const relaunched = storeOn(storage).getState();
    expect(relaunched.arcadeLooks.active.id).toBe('dungeon');
    expect(relaunched.lookSync.arcade).toMatchObject({ lookChanged: true, synced: 'pending' });
    expect(storage.getItem(LOOK_MARKS_KEYS.arcade)).not.toBeNull();
  });

  it("never touches Play's or HUD's looks", async () => {
    const server = fakeServer({ [ARCADE_THEME_ID]: { looks: [MINE], active: MINE } });
    const store = storeOn();
    const { playLooks, hudLooks, lookSync } = store.getState();
    await lookSyncRunners(store).arcade.refresh(target(server.client));
    const after = store.getState();
    expect(after.playLooks).toBe(playLooks);
    expect(after.hudLooks).toBe(hudLooks);
    expect(after.lookSync.play).toBe(lookSync.play);
    expect(after.lookSync.hud).toBe(lookSync.hud);
  });
});
