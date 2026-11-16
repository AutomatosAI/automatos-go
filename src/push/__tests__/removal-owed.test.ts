// A Remove this phone the server has not confirmed (bind/remove-phone.ts, registration/removal-owed.ts):
// the phone is still cleared, but the row's id is kept as owed, the button stays offered, and the
// next tap, the next launch (while the hold stands) or the next Sign out sends the DELETE again;
// "removed" only after the server's answer, 404 included. And the yes never leaves the button busy:
// a removal that throws on its way says the honest line (removeAndTell).

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { revokeDevice } from '../api';
import { pushLeaveFor } from '../bind/leave';
import {
  finishRemoval,
  phoneRemovalFor,
  removeAndTell,
  type RemovalDeps,
} from '../bind/remove-phone';
import { REMOVALS_OWED_ITEM, REMOVALS_OWED_MAX } from '../config';
import { createRegistrar } from '../registration/registrar';
import { removalHoldOver } from '../registration/removal-hold';
import { removalOwedOver, withOwed } from '../registration/removal-owed';
import { PUSH_ACCOUNT_COPY } from '../strings';
import { DEVICE_ID, WS } from './data-fixtures';
import { teardownOver } from './leave-fixtures';
import {
  ORIGIN,
  OTHER_DEVICE_ID,
  answering,
  holding,
  memoryStorage,
  offline,
  ok,
  setup,
  storedRecord,
  type Answer,
} from './registration-fixtures';

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const SCOPE = Object.freeze({ serverOrigin: ORIGIN, workspaceId: WS });
const DELETE = `DELETE /api/v1/mobile/devices/${DEVICE_ID}`;

afterEach(() => vi.restoreAllMocks());

/** A hosted phone holding its record, with Remove this phone over the real registrar and stores. */
function removable(revoke: Answer[], stored = holding(storedRecord())) {
  const world = setup({ stored, script: { revoke } });
  const registrar = createRegistrar(world.deps);
  const owed = removalOwedOver(world.storage);
  const hold = removalHoldOver(world.storage);
  const deps: RemovalDeps = {
    scope: SCOPE,
    hold,
    registrar,
    store: world.keys.store,
    revoke: (deviceId) => revokeDevice(world.api.client, deviceId),
    teardown: teardownOver(world.keys.store, []),
    owed,
  };
  return { world, registrar, owed, hold, deps, removal: phoneRemovalFor(deps) };
}

describe('a removal the server has not confirmed is owed, and finished later', () => {
  it.each<[string, Answer]>([
    ['a refusal', answering(500, {})],
    ['no network', offline],
  ])(
    '%s: not "removed"; the row is owed and still offered; the next tap finishes it',
    async (_n, fail) => {
      const { world, owed, removal } = removable([fail, ok]);
      expect((await removal.remove()).removed).toBe(false);
      expect([world.keys.held(), owed.owed(SCOPE)]).toEqual([null, DEVICE_ID]);
      await expect(removal.deviceId()).resolves.toBe(DEVICE_ID);
      expect((await removal.remove()).removed).toBe(true);
      expect(world.api.routes()).toEqual([DELETE, DELETE]);
      expect(owed.owed(SCOPE)).toBeNull();
      await expect(removal.deviceId()).resolves.toBeNull();
    },
  );

  it('a row already gone (404) is removed: nothing is owed', async () => {
    const { owed, removal } = removable([answering(404, { detail: 'Not found' })]);
    expect((await removal.remove()).removed).toBe(true);
    expect(owed.owed(SCOPE)).toBeNull();
  });

  it('the next launch sends it again while the hold stands, and settles it when confirmed', async () => {
    const { world, owed, removal } = removable([offline, ok]);
    await removal.remove();
    expect(await removal.finish()).toBe(true);
    expect([world.api.routes(), owed.owed(SCOPE)]).toEqual([[DELETE, DELETE], null]);
    // nothing owed: the next launch sends nothing
    expect(await removal.finish()).toBe(false);
    expect(world.api.calls).toHaveLength(2);
  });

  it('the next launch, refused again: still owed, for the launch after', async () => {
    const { owed, removal } = removable([offline, offline]);
    await removal.remove();
    expect(await removal.finish()).toBe(false);
    expect(owed.owed(SCOPE)).toBe(DEVICE_ID);
  });

  it('turned on again since (the hold released): no longer wanted, settled unsent', async () => {
    const { world, owed, hold, deps } = removable([offline]);
    await phoneRemovalFor(deps).remove();
    hold.release(SCOPE);
    expect(await finishRemoval(deps)).toBe(false);
    expect([world.api.calls.length, owed.owed(SCOPE)]).toEqual([1, null]);
  });

  it('the next Sign out revokes an owed row, and settles it', async () => {
    const { world, owed, registrar, removal } = removable([offline, ok]);
    await removal.remove();
    const leave = pushLeaveFor({
      source: 'hosted',
      scope: SCOPE,
      registrar,
      store: world.keys.store,
      revoke: (deviceId, signal) => revokeDevice(world.api.client, deviceId, signal),
      teardown: teardownOver(world.keys.store, []),
      owed,
    });
    expect(await leave()).toEqual({ revoked: true, failed: [] });
    expect([world.api.routes(), owed.owed(SCOPE)]).toEqual([[DELETE, DELETE], null]);
  });
});

describe('the yes never leaves the button busy (removeAndTell)', () => {
  it('says what the server answered', async () => {
    const show = vi.fn();
    await removeAndTell({ remove: async () => ({ removed: true, status: { kind: 'ask' } }) }, show);
    expect(show).toHaveBeenCalledWith(PUSH_ACCOUNT_COPY.removed);
  });

  it('a removal that throws on its way resolves, says it could not remove, and logs the kind only', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const show = vi.fn();
    const failing = { remove: () => Promise.reject(new Error(`no ${DEVICE_ID}`)) };
    await expect(removeAndTell(failing, show)).resolves.toBeNull();
    expect(show).toHaveBeenCalledWith(PUSH_ACCOUNT_COPY.removeFailed);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(DEVICE_ID);
  });
});

describe('removalOwedOver: one MMKV item of scope → row', () => {
  it('keeps at most REMOVALS_OWED_MAX, the oldest dropped; never changes its input', () => {
    const owed = Object.freeze(
      Object.fromEntries(
        Array.from({ length: REMOVALS_OWED_MAX }, (_, index) => [`scope-${index}`, DEVICE_ID]),
      ),
    );
    const next = withOwed(owed, SCOPE, OTHER_DEVICE_ID);
    expect(Object.keys(next)).toHaveLength(REMOVALS_OWED_MAX);
    expect(Object.keys(next)[0]).toBe('scope-1');
    expect(Object.values(next).at(-1)).toBe(OTHER_DEVICE_ID);
    expect(Object.keys(owed)[0]).toBe('scope-0');
  });

  it('an unreadable item, a row that is not an id, or a failing store reads as nothing owed', () => {
    const corrupt = memoryStorage();
    corrupt.setItem(REMOVALS_OWED_ITEM, '{not json');
    expect(removalOwedOver(corrupt).owed(SCOPE)).toBeNull();
    const notAnId = memoryStorage();
    notAnId.setItem(REMOVALS_OWED_ITEM, JSON.stringify({ [JSON.stringify([ORIGIN, WS])]: 'x' }));
    expect(removalOwedOver(notAnId).owed(SCOPE)).toBeNull();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const failing = removalOwedOver({
      getItem: () => {
        throw new Error('mmkv closed');
      },
      setItem: () => {
        throw new Error('mmkv closed');
      },
    });
    failing.owe(SCOPE, DEVICE_ID);
    expect(failing.owed(SCOPE)).toBeNull();
    expect(warn).toHaveBeenCalledWith('[push] could not keep the removal owed');
  });
});
