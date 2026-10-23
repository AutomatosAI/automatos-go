// The current server (KC4): an own server exactly when a paired record exists, else the built-in
// hosted server; moved only by a pairing, a forget and a refusal; never holding the token.

import { describe, expect, it, vi } from 'vitest';

import { builtInServer } from '../../api/server';
import {
  createCurrentServerStore,
  currentServer,
  ownServerOf,
  pairingOf,
  type CurrentServerSnapshot,
} from '../current-server';
import type { DeviceStore, PairedRecord } from '../device-store';
import type { DeviceRefusal } from '../expiry';
import { OTHER_RECORD, RECORD, TOKEN } from './paired-record';

const REFUSAL: DeviceRefusal = { reason: 'revoked', serverName: 'Home NAS', origin: RECORD.origin };

function storeWith(load: () => Promise<PairedRecord | null>): Pick<DeviceStore, 'load'> {
  return { load: vi.fn(load) };
}

/** A load that resolves when told to. */
function deferredStore() {
  let resolve: (record: PairedRecord | null) => void = () => undefined;
  const store = storeWith(
    () =>
      new Promise<PairedRecord | null>((done) => {
        resolve = done;
      }),
  );
  return { store, resolve: (record: PairedRecord | null) => resolve(record) };
}

const ready = (snapshot: CurrentServerSnapshot) =>
  snapshot.status === 'ready' ? snapshot : expect.fail(`not ready: ${snapshot.status}`);

describe('currentServer (KC4)', () => {
  it("is the record's origin and Studio, source own, when a record is paired", async () => {
    const servers = createCurrentServerStore();
    await servers.load(storeWith(async () => RECORD));
    expect(currentServer(servers.getSnapshot())).toEqual({
      apiUrl: RECORD.origin,
      webUrl: RECORD.webUrl,
      source: 'own',
    });
  });

  it('is the built-in hosted server otherwise (none in a test build)', async () => {
    const servers = createCurrentServerStore();
    await servers.load(storeWith(async () => null));
    expect(currentServer(servers.getSnapshot())).toBe(builtInServer());
    expect(currentServer(servers.getSnapshot())).toBeNull();
  });

  it('is nothing until the keychain has said, never a guess', () => {
    const servers = createCurrentServerStore();
    expect(servers.getSnapshot()).toEqual({ status: 'loading' });
    expect(currentServer(servers.getSnapshot())).toBeNull();
  });
});

describe('the current-server store', () => {
  it('reads the record once', async () => {
    const servers = createCurrentServerStore();
    const store = storeWith(async () => RECORD);
    await Promise.all([servers.load(store), servers.load(store)]);
    await servers.load(store);
    expect(store.load).toHaveBeenCalledTimes(1);
    expect(ready(servers.getSnapshot()).own?.server.apiUrl).toBe(RECORD.origin);
  });

  it('never holds the token: it stays in device-store.ts', async () => {
    const servers = createCurrentServerStore();
    await servers.load(storeWith(async () => RECORD));
    expect(JSON.stringify(servers.getSnapshot())).not.toContain(TOKEN);
    expect(JSON.stringify(ownServerOf(RECORD))).not.toContain(TOKEN);
  });

  it('a keychain that refuses is unreadable, and a retry reads again', async () => {
    const servers = createCurrentServerStore();
    const store = storeWith(async () => {
      throw new Error('keychain locked');
    });
    await servers.load(store);
    expect(servers.getSnapshot()).toEqual({ status: 'unreadable' });
    vi.mocked(store.load).mockResolvedValueOnce(RECORD);
    const retried = servers.load(store);
    expect(servers.getSnapshot()).toEqual({ status: 'loading' });
    await retried;
    expect(ready(servers.getSnapshot()).own?.deviceId).toBe(RECORD.deviceId);
  });

  it('moves on a pairing, a forget and a refusal, telling each listener', () => {
    const servers = createCurrentServerStore();
    const listener = vi.fn();
    servers.subscribe(listener);
    servers.connected(RECORD);
    expect(ready(servers.getSnapshot())).toEqual({
      status: 'ready',
      own: ownServerOf(RECORD),
      ended: null,
    });
    servers.refused(REFUSAL);
    expect(ready(servers.getSnapshot())).toEqual({ status: 'ready', own: null, ended: REFUSAL });
    servers.forgotten();
    expect(ready(servers.getSnapshot())).toEqual({ status: 'ready', own: null, ended: null });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('a new pairing clears the last refusal', () => {
    const servers = createCurrentServerStore();
    servers.refused(REFUSAL);
    servers.connected(OTHER_RECORD);
    expect(ready(servers.getSnapshot()).ended).toBeNull();
  });

  it('a read that started before a move never overwrites it', async () => {
    const servers = createCurrentServerStore();
    const { store, resolve } = deferredStore();
    const loading = servers.load(store);
    servers.connected(OTHER_RECORD);
    resolve(RECORD);
    await loading;
    expect(ready(servers.getSnapshot()).own?.server.apiUrl).toBe(OTHER_RECORD.origin);
  });

  it('an unsubscribed listener hears nothing, and one that throws stops no other', () => {
    const servers = createCurrentServerStore();
    const failing = vi.fn(() => {
      throw new Error('listener failed');
    });
    const heard = vi.fn();
    const gone = vi.fn();
    servers.subscribe(failing);
    servers.subscribe(heard);
    servers.subscribe(gone)();
    servers.forgotten();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(gone).not.toHaveBeenCalled();
  });

  it('the snapshot is frozen', () => {
    const servers = createCurrentServerStore();
    servers.refused(REFUSAL);
    const snapshot = ready(servers.getSnapshot());
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.ended)).toBe(true);
    servers.connected(RECORD);
    expect(Object.isFrozen(ready(servers.getSnapshot()).own)).toBe(true);
  });
});

describe('pairingOf (US-006c)', () => {
  it('is the device row, the server and the moment it paired', () => {
    expect(pairingOf(RECORD)).toBe(`${RECORD.deviceId}@${RECORD.origin}#${RECORD.pairedAt}`);
    expect(pairingOf({ ...RECORD, pairedAt: '2026-10-22T10:00:00.000Z' })).not.toBe(
      pairingOf(RECORD),
    );
    expect(ownServerOf(RECORD).pairing).toBe(pairingOf(RECORD));
  });
});
