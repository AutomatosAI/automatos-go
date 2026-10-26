// The look sync running over the style store and a fake server (US-017d): a HUD look saved on the
// web paints the phone, a HUD change on the phone is sent, HUD not installed keeps its looks on the
// phone with no words; Play's first meeting merges and sends once, a change made before it is only
// marked, a change made offline is sent after the next read (also after a relaunch), one PUT at a
// time, and an answer for another workspace is dropped; a read that overlaps a save (queued, in
// flight or answered while it ran) changes nothing, and a read with no save outstanding is applied.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../../api/client';
import { SERVER, fakeTransport, jsonReply } from '../../../api/__tests__/fake-transport';
import type { StreamingResponse, TransportRequest } from '../../../api/transport-types';
import { AURORA, DEFAULT_LOOK, EMBER, OBSIDIAN } from '../../../core/frozen/lib/looks/presets';
import type { Look } from '../../../core/frozen/lib/looks/types';
import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import { HUD_THEME_ID, setKnob } from '../../hud/hud-looks';
import { HUD_DEFAULT_LOOK, HUD_PRESET_LOOKS } from '../../hud/look-schema';
import { lookSyncNotice } from '../../play/look-sync';
import { PLAY_THEME_ID } from '../../play/play-looks';
import { appStyleSources, createStyleStore } from '../../provider/store';
import { LOOK_MARKS_KEYS } from '../look-marks';
import { lookOwner, lookSyncRunners, type LookSyncTarget } from '../look-sync-run';
import { NOT_INSTALLED_COPY } from '../look-themes';

const NOVA = HUD_PRESET_LOOKS.find((look) => look.id === 'nova') ?? HUD_DEFAULT_LOOK;
const SAVED: Look = { ...OBSIDIAN, id: 'look-1', name: 'My look 1', sub: 'Your look' };

type Kept = { looks: unknown[]; active: unknown };

/** A server holding each installed theme's looks; a theme it lacks answers 404. */
function fakeServer(installed: Partial<Record<string, Kept>>, delayMs = 0) {
  const kept: Record<string, Kept | undefined> = { ...installed };
  const puts: { themeId: string; body: Kept }[] = [];
  let offline = false;
  const answer = async (request: TransportRequest) => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (offline) throw new TypeError('Network request failed');
    const themeId = request.url.slice(`${SERVER.apiUrl}/api/themes/looks/`.length);
    const set = kept[themeId];
    if (!set) return jsonReply(404, { detail: "This theme isn't installed in this workspace." });
    if (request.method === 'PUT') {
      const body = JSON.parse(String(request.body)) as Kept;
      puts.push({ themeId, body });
      kept[themeId] = body;
    }
    const now = kept[themeId] ?? set;
    return jsonReply(200, { themeId, ...now, defaultLook: null, dropped: 0 });
  };
  const transport = fakeTransport(answer);
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'tok',
    getWorkspaceId: () => 'ws-1',
    transport,
  });
  return {
    client,
    puts,
    kept,
    calls: transport.calls,
    setOffline: (value: boolean) => {
      offline = value;
    },
  };
}

type Held = {
  readonly request: TransportRequest;
  readonly resolve: (reply: StreamingResponse) => void;
};

/** A Play server that answers each GET and PUT only when the test says, in the order it says. */
function handServer() {
  let held: readonly Held[] = [];
  const transport = fakeTransport(
    (request) =>
      new Promise((resolve) => {
        held = [...held, { request, resolve }];
      }),
  );
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'tok',
    getWorkspaceId: () => 'ws-1',
    transport,
  });
  /** Answers the oldest waiting request of `method` with what `reply` makes of it. */
  const respond = async (method: string, reply: (request: TransportRequest) => StreamingResponse) => {
    const entry = held.find((waiting) => waiting.request.method === method);
    if (!entry) throw new Error(`no ${method} is waiting`);
    held = held.filter((waiting) => waiting !== entry);
    entry.resolve(reply(entry.request));
    await settle();
  };
  const served = (kept: Kept) =>
    jsonReply(200, { themeId: PLAY_THEME_ID, ...kept, defaultLook: null, dropped: 0 });
  return {
    client,
    /** A GET answered with `kept`, a PUT with its own body. */
    answer: (method: 'GET' | 'PUT', kept?: Kept) =>
      respond(method, (request) => served(kept ?? (JSON.parse(String(request.body)) as Kept))),
    fail: (method: 'GET' | 'PUT') => respond(method, () => jsonReply(503, { detail: 'Down.' })),
    waiting: () => held.map((entry) => entry.request.method),
    puts: () => transport.calls.filter((call) => call.method === 'PUT'),
  };
}

function storeOn(storage: KeyValueStorage = memoryStorage()) {
  return createStyleStore(appStyleSources(() => storage));
}

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

function target(client: LookSyncTarget['client'], session = 'api|ws-1|user_1'): LookSyncTarget {
  return { client, session };
}

beforeEach(() => {
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HUD in step with the web', () => {
  it('paints the phone with the HUD look saved on the web', async () => {
    const server = fakeServer({ [HUD_THEME_ID]: { looks: [], active: NOVA } });
    const store = storeOn();
    await lookSyncRunners(store).hud.refresh(target(server.client));
    expect(store.getState().hudLooks.active).toEqual(NOVA);
    expect(store.getState().lookSync.hud.synced).toBe('server');
    expect(server.puts).toEqual([]);
  });

  it('sends a HUD change made on the phone, both fields', async () => {
    const server = fakeServer({ [HUD_THEME_ID]: { looks: [], active: NOVA } });
    const store = storeOn();
    const { hud } = lookSyncRunners(store);
    const at = target(server.client);
    hud.attach(at);
    await hud.refresh(at);
    const state = store.getState();
    state.setHudLooks(setKnob(state.hudLooks, 'grid', 3));
    expect(store.getState().lookSync.hud.lookChanged).toBe(true);
    await settle();
    expect(server.puts).toHaveLength(1);
    expect(server.puts[0]?.themeId).toBe(HUD_THEME_ID);
    expect(server.puts[0]?.body).toEqual({ looks: [], active: { ...NOVA, grid: 3 } });
    expect(store.getState().lookSync.hud).toMatchObject({ lookChanged: false, synced: 'server' });
  });

  it('keeps HUD looks on the phone with no words where HUD is not installed (404)', async () => {
    const server = fakeServer({});
    const store = storeOn();
    const { hud } = lookSyncRunners(store);
    const at = target(server.client);
    hud.attach(at);
    await hud.refresh(at);
    const state = store.getState();
    state.setHudLooks(setKnob(state.hudLooks, 'glow', 2));
    await settle();
    expect(store.getState().hudLooks.active.glow).toBe(2);
    expect(store.getState().lookSync.hud).toMatchObject({ synced: 'local-only', lookChanged: true });
    expect(lookSyncNotice(store.getState().lookSync.hud, NOT_INSTALLED_COPY.hud)).toBeNull();
    expect(server.puts).toEqual([]);
  });
});

describe('Play in step with the web', () => {
  it('merges once at the first meeting and sends the merged set', async () => {
    const server = fakeServer({ [PLAY_THEME_ID]: { looks: [SAVED], active: null } });
    const store = storeOn();
    const mine = { ...AURORA, id: 'look-1', name: 'Phone look', sub: 'Your look' };
    const { play } = lookSyncRunners(store);
    const at = target(server.client);
    play.attach(at);
    store.getState().setPlayLooks({ saved: [mine], active: AURORA });
    await settle();
    // before the first meeting a change is only marked: a PUT would replace the server's looks
    expect(store.getState().lookSync.play).toMatchObject({ savedChanged: true, lookChanged: true });
    expect(server.puts).toEqual([]);
    await play.refresh(at);
    await settle();
    const ids = store.getState().playLooks.saved.map((look) => look.id);
    expect(ids).toEqual(['look-1', 'look-2']);
    expect(store.getState().playLook).toEqual(AURORA);
    expect(server.puts).toHaveLength(1);
    expect(server.puts[0]?.body.looks).toHaveLength(2);
    expect(store.getState().lookSync.play).toMatchObject({ serverSeen: true, synced: 'server' });
  });

  it("says how to keep Play's looks in step when Play is not installed", async () => {
    const store = storeOn();
    await lookSyncRunners(store).play.refresh(target(fakeServer({}).client));
    expect(lookSyncNotice(store.getState().lookSync.play, NOT_INSTALLED_COPY.play)).toBe(
      'Install Play in Studio to keep your looks in step with the web.',
    );
  });

  it('keeps an offline change marked across a relaunch and sends it after the next read', async () => {
    const storage = memoryStorage();
    const server = fakeServer({ [PLAY_THEME_ID]: { looks: [], active: DEFAULT_LOOK } });
    const store = storeOn(storage);
    const { play } = lookSyncRunners(store);
    const at = target(server.client);
    play.attach(at);
    await play.refresh(at);
    server.setOffline(true);
    store.getState().setPlayLook(OBSIDIAN);
    await settle();
    expect(store.getState().lookSync.play).toMatchObject({ synced: 'pending', failure: 'network' });
    expect(storage.getItem(LOOK_MARKS_KEYS.play)).toContain('"lookChanged":true');

    server.setOffline(false);
    const relaunched = storeOn(storage);
    expect(relaunched.getState().playLook).toEqual(OBSIDIAN);
    await lookSyncRunners(relaunched).play.refresh(at);
    await settle();
    expect(relaunched.getState().playLook).toEqual(OBSIDIAN); // the phone's change won
    expect(server.kept[PLAY_THEME_ID]?.active).toEqual(OBSIDIAN);
    expect(relaunched.getState().lookSync.play).toMatchObject({ lookChanged: false });
  });

  it('sends one PUT at a time, the newest set last', async () => {
    const server = fakeServer({ [PLAY_THEME_ID]: { looks: [], active: DEFAULT_LOOK } });
    const store = storeOn();
    const { play } = lookSyncRunners(store);
    const at = target(server.client);
    play.attach(at);
    await play.refresh(at);
    store.getState().setPlayLook(OBSIDIAN);
    store.getState().setPlayLook({ ...OBSIDIAN, glow: 2 });
    store.getState().setPlayLook(AURORA);
    await settle();
    expect(server.puts.map((put) => (put.body.active as Look).id)).toEqual(['obsidian', 'aurora']);
    expect(server.kept[PLAY_THEME_ID]?.active).toEqual(AURORA);
  });

  it("never sends one account's looks to another signed in on the same phone", async () => {
    const storage = memoryStorage();
    const server = fakeServer({ [PLAY_THEME_ID]: { looks: [], active: DEFAULT_LOOK } });
    const store = storeOn(storage);
    const { play } = lookSyncRunners(store);
    const first = target(server.client, lookOwner(SERVER.apiUrl, 'ws-1', 'user_1'));
    const detach = play.attach(first);
    await play.refresh(first);
    server.setOffline(true);
    store.getState().setPlayLooks({ saved: [SAVED], active: OBSIDIAN }); // unsent: offline
    await settle();
    detach();
    server.setOffline(false);
    const other = target(server.client, lookOwner(SERVER.apiUrl, 'ws-1', 'user_2'));
    play.attach(other);
    expect(store.getState().playLooks).toEqual({ saved: [], active: DEFAULT_LOOK });
    await play.refresh(other);
    await settle();
    expect(server.puts).toEqual([]);
    expect(store.getState().lookSync.play.owner).toBe(other.session);
  });

  it("drops a save still waiting when another owner claims the phone's looks", async () => {
    const server = fakeServer({ [PLAY_THEME_ID]: { looks: [], active: DEFAULT_LOOK } }, 20);
    const store = storeOn();
    const { play } = lookSyncRunners(store);
    const first = target(server.client, lookOwner(SERVER.apiUrl, 'ws-1', 'user_1'));
    play.attach(first);
    await play.refresh(first);
    store.getState().setPlayLook(OBSIDIAN); // sent at once, in flight
    store.getState().setPlayLook(AURORA); // waits behind it
    play.attach(target(server.client, lookOwner(SERVER.apiUrl, 'ws-1', 'user_2')));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(server.puts.map((put) => (put.body.active as Look).id)).toEqual(['obsidian']);
  });

  it('joins a read already running and drops an answer for another workspace', async () => {
    const slow = fakeServer({ [PLAY_THEME_ID]: { looks: [], active: AURORA } }, 20);
    const next = fakeServer({ [PLAY_THEME_ID]: { looks: [], active: OBSIDIAN } });
    const store = storeOn();
    const { play } = lookSyncRunners(store);
    const first = play.refresh(target(slow.client, 'api|ws-1|user_1'));
    expect(play.refresh(target(slow.client, 'api|ws-1|user_1'))).toBe(first);
    const other = play.refresh(target(next.client, 'api|ws-2|user_1'));
    await Promise.all([first, other]);
    expect(slow.calls).toHaveLength(1);
    // ws-2 answered first; ws-1's later answer is for a workspace the phone has left
    expect(store.getState().playLook).toEqual(OBSIDIAN);
  });
});

describe('a read that overlaps a save', () => {
  const BEFORE_PUT: Kept = { looks: [], active: DEFAULT_LOOK };

  /** Play met, then a knob changed (PUT in flight) and the look page opened (GET started). */
  async function readWhileSaving() {
    const server = handServer();
    const store = storeOn();
    const { play } = lookSyncRunners(store);
    const at = target(server.client);
    play.attach(at);
    const met = play.refresh(at);
    await settle();
    await server.answer('GET', BEFORE_PUT);
    await met;
    store.getState().setPlayLook(OBSIDIAN);
    await settle();
    const read = play.refresh(at);
    await settle();
    expect(server.waiting()).toEqual(['PUT', 'GET']);
    return { server, store, play, at, read };
  }

  it("never puts the phone back on the server's copy served before the save landed", async () => {
    const { server, store, read } = await readWhileSaving();
    await server.answer('PUT');
    expect(store.getState().lookSync.play).toMatchObject({ lookChanged: false, synced: 'server' });
    await server.answer('GET', BEFORE_PUT);
    await read;
    expect(store.getState().playLook).toEqual(OBSIDIAN);
    expect(store.getState().lookSync.play).toMatchObject({ lookChanged: false, synced: 'server' });
    expect(server.puts()).toHaveLength(1);
    expect(server.waiting()).toEqual([]);
  });

  it("keeps the phone's look when the read answers first; the save lands, nothing is sent again", async () => {
    const { server, store, read } = await readWhileSaving();
    await server.answer('GET', BEFORE_PUT);
    await read;
    expect(store.getState().playLook).toEqual(OBSIDIAN);
    await server.answer('PUT');
    expect(store.getState().playLook).toEqual(OBSIDIAN);
    expect(store.getState().lookSync.play).toMatchObject({ lookChanged: false, synced: 'server' });
    expect(server.puts()).toHaveLength(1);
    expect(server.waiting()).toEqual([]);
  });

  it('sends it again after the next read when the save did not land (the server lacks it)', async () => {
    const { server, store, play, at, read } = await readWhileSaving();
    await server.answer('GET', BEFORE_PUT);
    await read;
    await server.fail('PUT');
    expect(store.getState().lookSync.play).toMatchObject({ lookChanged: true, synced: 'pending' });
    const next = play.refresh(at);
    await settle();
    await server.answer('GET', BEFORE_PUT);
    await next;
    expect(store.getState().playLook).toEqual(OBSIDIAN);
    await server.answer('PUT');
    expect(server.puts()).toHaveLength(2);
    expect(store.getState().lookSync.play).toMatchObject({ lookChanged: false, synced: 'server' });
  });

  it('applies a read with no save outstanding, and reads again after a dropped one', async () => {
    const { server, store, play, at, read } = await readWhileSaving();
    await server.answer('PUT');
    await server.answer('GET', BEFORE_PUT);
    await read;
    const next = play.refresh(at); // the next foreground, with the web's newer look
    await settle();
    await server.answer('GET', { looks: [], active: AURORA });
    await next;
    expect(store.getState().playLook).toEqual(AURORA);
    expect(store.getState().lookSync.play).toMatchObject({ lookChanged: false, synced: 'server' });
    expect(server.puts()).toHaveLength(1);
  });

  it('applies a read once a save the outbox replaced has had its turn', async () => {
    const { server, store, play, at, read } = await readWhileSaving();
    store.getState().setPlayLook({ ...OBSIDIAN, glow: 2 }); // waits behind the PUT in flight
    store.getState().setPlayLook(AURORA); // replaces it: the waiting one is never sent
    await server.answer('PUT');
    await server.answer('GET', BEFORE_PUT);
    await read;
    await server.answer('PUT');
    expect(server.puts().map((put) => (JSON.parse(String(put.body)) as Kept).active)).toEqual([
      OBSIDIAN,
      AURORA,
    ]);
    const next = play.refresh(at);
    await settle();
    await server.answer('GET', { looks: [], active: EMBER });
    await next;
    expect(store.getState().playLook).toEqual(EMBER);
  });
});
