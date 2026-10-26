// The session's one registrar (KP10): runs never overlap and the triggers that arrive during one
// share ONE run after it; a tap gets its own; a 409 is kept for the launch; a new token from the OS
// is read again and registered; close() lets no run start and no record be kept after it.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PUSH_RECORD_ITEM } from '../config';
import { createRegistrar, watchPushToken } from '../registration/registrar';
import { sent } from './data-fixtures';
import { fakePort } from './platform-fixtures';
import {
  GRANTED,
  type Answer,
  KEY,
  NEW_TOKEN,
  conflict,
  holding,
  minted,
  ok,
  phone,
  setup,
  storedRecord,
} from './registration-fixtures';

// The fixtures build the real key store over a fake SecureStore.
vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

afterEach(() => vi.restoreAllMocks());

/** A permission read that waits until released, so a run stays under way. */
function heldPermission() {
  let release = () => undefined as void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  const port = {
    getPermissionsAsync: async () => {
      reads += 1;
      await held;
      return GRANTED;
    },
  };
  return { port, release: () => release(), reads: () => reads };
}

const underway = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the registrar: one run at a time; a new token registers', () => {
  it('triggers during a run share ONE run after it; a tap gets its own', async () => {
    const run = setup({ script: { register: [minted(KEY), minted(null)] } });
    const permission = heldPermission();
    const registrar = createRegistrar({ ...run.deps, port: permission.port });
    const first = registrar.run();
    await underway();
    const [second, third] = [registrar.run(), registrar.run()];
    expect(second).toBe(third);
    expect(second).not.toBe(first);
    const tap = registrar.run({ force: true });
    expect(tap).not.toBe(second);
    permission.release();
    await Promise.all([first, second, tap]);
    expect(permission.reads()).toBe(3);
    expect(run.api.calls).toHaveLength(2); // the first run, and the tap; the shared run had nothing new
    expect(registrar.latest()?.status).toEqual({ kind: 'on' });
  });

  it('keeps a 409 for the launch: the next trigger sends nothing', async () => {
    const run = setup({ script: { register: [conflict('device_revoked')] } });
    const registrar = createRegistrar(run.deps);
    expect(registrar.latest()).toBeNull();
    await registrar.run();
    expect((await registrar.run())?.status).toEqual({ kind: 'revoked_by_admin' });
    expect(run.api.calls).toHaveLength(1);
  });

  it('a new token from the OS → the Expo token read again and registered', async () => {
    const device = phone();
    const run = setup({
      device,
      stored: holding(storedRecord()),
      script: { register: [minted(null)] },
    });
    const registrar = createRegistrar(run.deps);
    await registrar.run();
    expect(run.api.calls).toHaveLength(0);
    let changed = () => undefined as void;
    const remove = vi.fn();
    const { port } = fakePort({
      addPushTokenListener: (listener) => {
        changed = listener;
        return { remove };
      },
    });
    const handle = watchPushToken(port, registrar);
    device.state.token = NEW_TOKEN;
    changed();
    await registrar.run();
    expect(sent(run.api.calls[0])).toMatchObject({ body: { expo_push_token: NEW_TOKEN } });
    expect(run.keys.held()).toMatchObject({ expoToken: NEW_TOKEN, pushKey: KEY });
    handle.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('close() before the POST: nothing is sent or kept, and it waits for the run', async () => {
    const run = setup({ script: { register: [minted(KEY)] } });
    const permission = heldPermission();
    const registrar = createRegistrar({ ...run.deps, port: permission.port });
    const first = registrar.run();
    await underway();
    let closed = false;
    const closing = registrar.close().then(() => {
      closed = true;
    });
    await underway();
    expect(closed).toBe(false);
    permission.release();
    await Promise.all([first, closing]);
    expect(run.api.calls).toHaveLength(0);
    expect(await registrar.run({ force: true })).toBe(registrar.latest());
    expect(permission.reads()).toBe(1);
  });

  it('close() with the POST in flight: its key is not kept and no recovery follows', async () => {
    let answer = () => undefined as void;
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const late: Answer = () => answered.then(minted(KEY));
    const run = setup({ script: { register: [late], revoke: [ok] } });
    const registrar = createRegistrar(run.deps);
    const first = registrar.run();
    await underway();
    expect(run.api.calls).toHaveLength(1);
    const closing = registrar.close();
    answer();
    await Promise.all([first, closing]);
    expect(run.api.routes()).toEqual(['POST /api/v1/mobile/devices']);
    expect(run.keys.secure.items.has(PUSH_RECORD_ITEM)).toBe(false);
    expect((await first)?.status.kind).not.toBe('on');
  });
});
