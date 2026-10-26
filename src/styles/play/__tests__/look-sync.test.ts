// The look sync, pure (US-017d; behaviour reference play-look-state.ts and play-look-store.ts): the
// first meeting merges (the server's saved looks first, then each phone-only one, a clashing id
// renamed by the editor's rule; the server's active look, else the phone's), afterwards the server
// is the truth except for a part changed on the phone, which wins until it is kept; the outbox
// sends one save at a time in order and a newer waiting save replaces an older one; both fields
// are always sent; a 404 is 'local-only'; invalid looks are dropped and counted.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../api/errors';
import { API_ERROR_COPY } from '../../../api/strings';
import { AURORA, DEFAULT_LOOK, OBSIDIAN } from '../../../core/frozen/lib/looks/presets';
import type { Look } from '../../../core/frozen/lib/looks/types';
import { logger } from '../../../lib/logger';
import { LOOK_SYNC_COPY } from '../../strings';
import { createLookOutbox } from '../../sync/look-outbox';
import {
  NO_MARKS,
  initialLookSync,
  lookSyncNotice,
  mergeLooks,
  reduceLookSync,
  sameLook,
  type LookSyncAction,
  type LookSyncState,
} from '../look-sync';
import { MAX_SAVED_LOOKS, keptLooks, lookBody, servedLooks } from '../looks-schemas';
import { PLAY_LOOK_RULES } from '../play-looks';

const RULES = PLAY_LOOK_RULES;

function mine(n: number, values: Partial<Look> = {}): Look {
  return { ...OBSIDIAN, id: `look-${n}`, name: `My look ${n}`, sub: 'Your look', ...values };
}

const PHONE_ONLY = mine(1, { glow: 3 });
const SERVER_ONE = mine(1, { glow: 9 });
const SERVER_TWO = mine(2);

function reduce(state: LookSyncState<Look>, ...actions: LookSyncAction<Look>[]) {
  return actions.reduce((next, action) => reduceLookSync(RULES, next, action), state);
}

function phone(saved: readonly Look[], active: Look, marks = NO_MARKS): LookSyncState<Look> {
  return reduce(initialLookSync(RULES), { type: 'loaded', local: { saved, active }, marks });
}

const OWNER = 'https://api.example.test|ws-1|user_1';
const MET = { owner: OWNER, serverSeen: true, lookChanged: false, savedChanged: false };

function served(saved: readonly Look[], active: Look | null): LookSyncAction<Look> {
  return { type: 'served', server: { saved, active } };
}

function failure(status: number) {
  return new ApiError(status === 404 ? 'not_found' : status === 401 ? 'auth' : 'server', {
    status,
  });
}

beforeEach(() => {
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the first meeting merges', () => {
  it("puts the server's saved looks first, then each phone-only one, a clashing id renamed", () => {
    const state = reduce(phone([PHONE_ONLY], PHONE_ONLY), served([SERVER_ONE, SERVER_TWO], null));
    expect(state.saved.map((look) => [look.id, look.glow])).toEqual([
      ['look-1', 9],
      ['look-2', OBSIDIAN.glow],
      ['look-3', 3],
    ]);
    expect(state.serverSeen).toBe(true);
    expect(state.savedChanged).toBe(true);
    expect(state.synced).toBe('pending');
  });

  it("takes the server's active look, else the phone's", () => {
    const withServer = reduce(phone([], OBSIDIAN), served([], AURORA));
    expect(withServer.active).toEqual(AURORA);
    expect(withServer.lookChanged).toBe(false);
    const withoutServer = reduce(phone([], OBSIDIAN), served([], null));
    expect(withoutServer.active).toEqual(OBSIDIAN);
    expect(withoutServer.lookChanged).toBe(true); // the server lacks it: it is sent
  });

  it('keeps a look the server already has once, by value whatever its key order', () => {
    const reordered = Object.fromEntries(Object.entries(PHONE_ONLY).reverse()) as Look;
    const state = reduce(phone([PHONE_ONLY], DEFAULT_LOOK), served([reordered], null));
    expect(state.saved).toHaveLength(1);
    expect(state.savedChanged).toBe(false);
    expect(state.lookChanged).toBe(false); // Ember on a server with no active look: nothing to send
    expect(state.synced).toBe('server');
  });

  it('never keeps more than MAX_SAVED_LOOKS, the server first', () => {
    const full = Array.from({ length: MAX_SAVED_LOOKS }, (_, n) => mine(n + 10));
    const merged = mergeLooks(RULES, { saved: full, active: null }, { saved: [PHONE_ONLY], active: DEFAULT_LOOK });
    expect(merged.saved).toHaveLength(MAX_SAVED_LOOKS);
    expect(merged.saved.some((look) => look.glow === PHONE_ONLY.glow)).toBe(false);
  });

  it('keeps a look changed on the phone before the meeting over the server one', () => {
    const changed = { ...NO_MARKS, lookChanged: true };
    const state = reduce(phone([], OBSIDIAN, changed), served([], AURORA));
    expect(state.active).toEqual(OBSIDIAN);
    expect(state.lookChanged).toBe(true);
  });
});

describe('afterwards the server is the truth', () => {
  it('takes every part the phone did not change, keeping an unchanged object', () => {
    const before = phone([SERVER_TWO], OBSIDIAN, MET);
    const state = reduce(before, served([SERVER_TWO, SERVER_ONE], AURORA));
    expect(state.active).toEqual(AURORA);
    expect(state.saved.map((look) => look.id)).toEqual(['look-2', 'look-1']);
    expect(state.synced).toBe('server');
    const again = reduce(state, served([{ ...SERVER_TWO }, { ...SERVER_ONE }], { ...AURORA }));
    expect(again.saved).toBe(state.saved);
    expect(again.active).toBe(state.active);
  });

  it('deletes on the phone what was deleted on the web', () => {
    const state = reduce(phone([SERVER_ONE, SERVER_TWO], OBSIDIAN, MET), served([SERVER_TWO], OBSIDIAN));
    expect(state.saved).toEqual([SERVER_TWO]);
    expect(state.savedChanged).toBe(false);
  });

  it('keeps a part changed on the phone until the server keeps it', () => {
    const edited = reduce(phone([], OBSIDIAN, MET), { type: 'edited', look: AURORA });
    expect(edited.synced).toBe('pending');
    const read = reduce(edited, served([SERVER_TWO], OBSIDIAN));
    expect(read.active).toEqual(AURORA); // the phone's change wins
    expect(read.saved).toEqual([SERVER_TWO]); // the unchanged part is the server's
    expect(read.lookChanged).toBe(true);
    const keptLater = reduce(read, { type: 'kept', edits: read.edits });
    expect(keptLater.lookChanged).toBe(false);
    expect(keptLater.synced).toBe('server');
  });

  it('keeps the marks when a newer change came after the save', () => {
    const first = reduce(phone([], OBSIDIAN, MET), { type: 'edited', look: AURORA });
    const sentAfter = first.edits;
    const second = reduce(first, { type: 'savedChanged', saved: [PHONE_ONLY] });
    const state = reduce(second, { type: 'kept', edits: sentAfter });
    expect(state.lookChanged).toBe(true);
    expect(state.savedChanged).toBe(true);
    expect(reduce(state, { type: 'kept', edits: second.edits }).synced).toBe('server');
  });
});

describe("the copy's owner (server, workspace, user)", () => {
  it('takes a blank copy no one owns as it is; looks made after it merge at the first meeting', () => {
    const state = reduce(phone([], DEFAULT_LOOK), { type: 'claimed', owner: OWNER });
    expect(state.owner).toBe(OWNER);
    const made = reduce(state, { type: 'savedChanged', saved: [PHONE_ONLY] });
    expect(reduce(made, served([SERVER_TWO], null)).saved).toHaveLength(2);
  });

  it('fails closed: a copy with looks whose owner cannot be read starts from the defaults', () => {
    for (const unowned of [phone([PHONE_ONLY], DEFAULT_LOOK), phone([], OBSIDIAN)]) {
      const state = reduce(unowned, { type: 'claimed', owner: OWNER });
      expect(state).toMatchObject({ owner: OWNER, saved: [], active: DEFAULT_LOOK });
    }
  });

  it("puts another owner's copy back to the defaults, unmarked, before anything is read", () => {
    const edited = reduce(phone([PHONE_ONLY], OBSIDIAN, MET), { type: 'edited', look: AURORA });
    const state = reduce(edited, { type: 'claimed', owner: 'https://api.example.test|ws-1|user_2' });
    expect(state.saved).toEqual([]);
    expect(state.active).toBe(DEFAULT_LOOK);
    expect(state).toMatchObject({ serverSeen: false, lookChanged: false, savedChanged: false });
    const met = reduce(state, served([SERVER_TWO], null));
    expect(met.saved).toEqual([SERVER_TWO]); // nothing of the other account's joins
    expect(met.synced).toBe('server');
  });

  it('changes nothing for the owner it already has', () => {
    const state = phone([PHONE_ONLY], OBSIDIAN, MET);
    expect(reduce(state, { type: 'claimed', owner: OWNER })).toBe(state);
  });
});

describe('failures', () => {
  it("is local-only on a 404 'not installed', changes kept and marked", () => {
    const state = reduce(phone([], OBSIDIAN, MET), { type: 'failed', error: failure(404) });
    expect(state.synced).toBe('local-only');
    const edited = reduce(state, { type: 'edited', look: AURORA });
    expect(edited.synced).toBe('local-only');
    expect(edited.lookChanged).toBe(true);
    expect(lookSyncNotice(edited, LOOK_SYNC_COPY.playNotInstalled)).toBe(
      'Install Play in Studio to keep your looks in step with the web.',
    );
    expect(lookSyncNotice(edited, null)).toBeNull();
  });

  it("keeps 401, 403, 5xx and no answer on the phone, marked, with the taxonomy's words", () => {
    const edited = reduce(phone([], OBSIDIAN, MET), { type: 'edited', look: AURORA });
    const errors = [failure(401), new ApiError('forbidden', { status: 403 }), failure(503)];
    for (const error of [...errors, new Error('offline')]) {
      const state = reduce(edited, { type: 'failed', error });
      expect(state.synced).toBe('pending');
      expect(state.lookChanged).toBe(true);
      expect(lookSyncNotice(state, null)).toBe(API_ERROR_COPY[state.failure ?? 'network']);
    }
  });

  it('drops the marks of a save the server refused, so the next read takes its copy', () => {
    const edited = reduce(phone([], OBSIDIAN, MET), { type: 'edited', look: AURORA });
    const state = reduce(edited, { type: 'failed', error: failure(400) });
    expect(state.lookChanged).toBe(false);
    expect(state.failure).toBe('server');
    expect(reduce(state, served([], OBSIDIAN)).active).toEqual(OBSIDIAN);
  });
});

describe('invalid looks are dropped and counted', () => {
  const answer = (looks: unknown[], active: unknown) => ({
    themeId: 'automatos/play',
    looks,
    active,
    defaultLook: 'ember',
    dropped: 1,
  });

  it('drops an invalid look, a preset id and a second look with an id already kept', () => {
    const broken = { ...SERVER_TWO, id: 'look-9', glow: 99 };
    const answerRead = servedLooks(
      RULES,
      answer([SERVER_ONE, broken, OBSIDIAN, { ...SERVER_ONE, glow: 1 }, SERVER_TWO], { x: 1 }),
    );
    expect(answerRead.saved.map((look) => look.id)).toEqual(['look-1', 'look-2']);
    expect(answerRead.active).toBeNull();
    expect(answerRead.dropped).toBe(1 + 3 + 1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('keeps no more than MAX_SAVED_LOOKS', () => {
    const many = Array.from({ length: MAX_SAVED_LOOKS + 2 }, (_, n) => mine(n + 1));
    expect(keptLooks(RULES, many).looks).toHaveLength(MAX_SAVED_LOOKS);
    expect(keptLooks(RULES, many).dropped).toBe(2);
  });
});

describe('the PUT body', () => {
  it('always carries both fields, active null included', () => {
    expect(lookBody({ saved: [], active: null })).toEqual({ looks: [], active: null });
    const body = lookBody({ saved: [SERVER_ONE], active: AURORA });
    expect(Object.keys(body)).toEqual(['looks', 'active']);
    expect(body.looks[0]).toEqual(SERVER_ONE);
    expect(body.looks[0]).not.toBe(SERVER_ONE);
  });

  it('compares looks by value', () => {
    expect(sameLook(SERVER_ONE, { ...SERVER_ONE })).toBe(true);
    expect(sameLook(SERVER_ONE, PHONE_ONLY)).toBe(false);
    expect(sameLook(null, SERVER_ONE)).toBe(false);
  });
});

/** A save the test answers by hand. */
function deferredSave(log: string[], name: string) {
  let answer: () => void = () => undefined;
  const send = () => {
    log.push(`start ${name}`);
    return new Promise<void>((resolve) => {
      answer = () => {
        log.push(`end ${name}`);
        resolve();
      };
    });
  };
  return { send, answer: () => answer() };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the outbox', () => {
  it('sends one save at a time, in order', async () => {
    const outbox = createLookOutbox();
    const log: string[] = [];
    const a = deferredSave(log, 'play');
    const b = deferredSave(log, 'hud');
    outbox.queue('play', a.send);
    outbox.queue('hud', b.send);
    await settle();
    expect(log).toEqual(['start play']);
    a.answer();
    await settle();
    expect(log).toEqual(['start play', 'end play', 'start hud']);
    b.answer();
    await settle();
    expect(log).toEqual(['start play', 'end play', 'start hud', 'end hud']);
  });

  it('replaces an older waiting save with a newer one under the same key', async () => {
    const outbox = createLookOutbox();
    const log: string[] = [];
    const [first, older, newer] = ['1', '2', '3'].map((name) => deferredSave(log, name));
    outbox.queue('play', first!.send);
    outbox.queue('play', older!.send);
    outbox.queue('play', newer!.send);
    await settle();
    first!.answer();
    await settle();
    newer!.answer();
    await settle();
    expect(log).toEqual(['start 1', 'end 1', 'start 3', 'end 3']);
  });

  it('goes on after a save that throws', async () => {
    const outbox = createLookOutbox();
    const log: string[] = [];
    outbox.queue('play', () => Promise.reject(new Error('lost')));
    outbox.queue('hud', async () => {
      log.push('hud');
    });
    await settle();
    await settle();
    expect(log).toEqual(['hud']);
  });
});
