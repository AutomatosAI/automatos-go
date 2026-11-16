// A choice the person makes while a registration call is out (registrar.ts, register.ts,
// bind/remove-phone.ts, bind/leave.ts): each awaited call is held open, the choice changes, the
// call is released, and the person's last choice wins. Notifications off in the phone's Settings
// during a POST; Remove this phone during a POST; a 'Turn on' that waited behind a run, then Remove
// this phone; 'Turn on' while the removal's DELETE is out; on again in Settings while the OS
// switch-off PATCH is out; sign-out or a new pairing during a first POST; two runs at once. Over
// the real registrar, key store and removal hold, and a client on the foundation's fake transport.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { jsonReply } from '../../api/__tests__/fake-transport';
import { RECORD } from '../../connect/__tests__/paired-record';
import { revokeDevice } from '../api';
import { removePhone, type RemovalDeps } from '../bind/remove-phone';
import { createRegistrar } from '../registration/registrar';
import { removalHoldOver } from '../registration/removal-hold';
import { phoneLinks } from '../settings/phone-link';
import { DEVICE_ID, DEVICE_ROW, WS } from './data-fixtures';
import { leavingPhone, serverSwitchOver, teardownOver } from './leave-fixtures';
import {
  DENIED,
  GRANTED,
  KEY,
  NEW_KEY,
  NEW_TOKEN,
  ORIGIN,
  answering,
  holding,
  minted,
  ok,
  phone,
  setup,
  storedRecord,
  type Answer,
  type Script,
} from './registration-fixtures';

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const POST = 'POST /api/v1/mobile/devices';
const PATCH = `PATCH /api/v1/mobile/devices/${DEVICE_ID}`;
const DELETE = `DELETE /api/v1/mobile/devices/${DEVICE_ID}`;
const SCOPE = Object.freeze({ serverOrigin: ORIGIN, workspaceId: WS });

let detach: (() => void) | null = null;

afterEach(() => {
  detach?.();
  detach = null;
  vi.restoreAllMocks();
});

/** An answer the server gives only once released: until then the call is out. */
function heldAnswer(then: Answer) {
  let release = () => undefined as void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const answer: Answer = () => gate.then(then);
  return { answer, release: () => release() };
}

const TURNS = 50;

/** Lets pending work run until `ready` holds (or, with none, for TURNS turns of the loop). */
async function until(ready?: () => boolean): Promise<void> {
  for (let turn = 0; turn < TURNS && !ready?.(); turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (ready) expect(ready()).toBe(true);
}

/** A hosted phone with the real registrar and Remove this phone over its record and hold. */
function removable(script: Script, stored = holding(storedRecord())) {
  const world = setup({ stored, script, device: phone({}, NEW_TOKEN) });
  const registrar = createRegistrar(world.deps);
  const hold = removalHoldOver(world.storage);
  const deps: RemovalDeps = {
    scope: SCOPE,
    hold,
    registrar,
    store: world.keys.store,
    revoke: (deviceId) => revokeDevice(world.api.client, deviceId),
    teardown: teardownOver(world.keys.store, []),
  };
  return { world, registrar, hold, deps };
}

describe('notifications off, or on again, in the phone’s Settings while a call is out', () => {
  it('off during a first registration: the record is kept, then the run after it sends the PATCH', async () => {
    const post = heldAnswer(minted(KEY));
    const world = setup({
      script: { register: [post.answer], update: [answering(200, DEVICE_ROW)] },
    });
    const registrar = createRegistrar(world.deps);
    const first = registrar.run();
    await until(() => world.api.calls.length === 1);
    world.permission.answer = DENIED;
    const resume = registrar.run();
    post.release();
    await Promise.all([first, resume]);
    expect(world.api.routes()).toEqual([POST, PATCH]);
    expect(world.keys.held()).toMatchObject({ deviceId: DEVICE_ID, switchedOff: true });
    expect(registrar.latest()?.status).toEqual({ kind: 'denied' });
  });

  it('on again during the switch-off PATCH: the run after it registers, and push is on', async () => {
    const patch = heldAnswer(answering(200, DEVICE_ROW));
    const world = setup({
      permission: DENIED,
      stored: holding(storedRecord()),
      script: { update: [patch.answer], register: [minted(null)] },
    });
    const registrar = createRegistrar(world.deps);
    const first = registrar.run();
    await until(() => world.api.calls.length === 1);
    world.permission.answer = GRANTED;
    const resume = registrar.run();
    patch.release();
    await Promise.all([first, resume]);
    expect(world.api.routes()).toEqual([PATCH, POST]);
    expect(world.keys.held()).toMatchObject({ switchedOff: false, pushKey: KEY });
    expect(registrar.latest()?.status).toEqual({ kind: 'on' });
  });

  it('two runs at once: one POST, and the second reads the record the first kept', async () => {
    const post = heldAnswer(minted(KEY));
    const world = setup({ script: { register: [post.answer, minted(null)] } });
    const registrar = createRegistrar(world.deps);
    const first = registrar.run();
    await until(() => world.api.calls.length === 1);
    const second = registrar.run();
    post.release();
    const outcomes = await Promise.all([first, second]);
    expect(world.api.routes()).toEqual([POST]);
    expect(outcomes.map((outcome) => outcome?.status.kind)).toEqual(['on', 'on']);
  });
});

describe('Remove this phone while a call is out', () => {
  it('during a registration: the POST settles, then its row is revoked, and nothing registers after', async () => {
    const post = heldAnswer(minted(null));
    const { world, registrar, hold, deps } = removable({ register: [post.answer], revoke: [ok] });
    const running = registrar.run();
    await until(() => world.api.calls.length === 1);
    const removal = removePhone(deps);
    post.release();
    const [, removed] = await Promise.all([running, removal]);
    expect(removed).toEqual({ removed: true, status: { kind: 'ask' } });
    expect(world.api.routes()).toEqual([POST, DELETE]);
    expect([world.keys.held(), hold.held(SCOPE)]).toEqual([null, true]);
    expect((await registrar.run())?.status).toEqual({ kind: 'ask' });
    expect(world.api.calls).toHaveLength(2);
  });

  it('a "Turn on" tapped before it, still waiting behind a run, does not undo the removal', async () => {
    const post = heldAnswer(minted(null));
    const { world, registrar, hold, deps } = removable({
      register: [post.answer, minted(NEW_KEY), minted(NEW_KEY)],
      revoke: [ok, ok],
    });
    const running = registrar.run();
    await until(() => world.api.calls.length === 1);
    const tap = registrar.run({ force: true });
    const removal = removePhone(deps);
    post.release();
    const [, tapped, removed] = await Promise.all([running, tap, removal]);
    expect(tapped?.status).toEqual({ kind: 'ask' });
    expect(removed).toEqual({ removed: true, status: { kind: 'ask' } });
    expect(world.api.routes()).toEqual([POST, DELETE]);
    expect([world.keys.held(), hold.held(SCOPE)]).toEqual([null, true]);
  });

  it('"Turn on" while its DELETE is out: the removal ends, then the tap registers a cleared phone', async () => {
    const del = heldAnswer(ok);
    const { world, registrar, hold, deps } = removable({
      revoke: [del.answer, ok],
      register: [minted(NEW_KEY), minted(NEW_KEY)],
    });
    const removal = removePhone(deps);
    await until(() => world.api.calls.length === 1);
    const tap = registrar.run({ force: true });
    // the tap waits for the removal: nothing is sent, and no record kept, while its DELETE is out
    await until();
    expect([world.api.routes(), world.keys.held()]).toEqual([[DELETE], storedRecord()]);
    del.release();
    const [removed, tapped] = await Promise.all([removal, tap]);
    expect(world.api.routes()).toEqual([DELETE, POST]);
    expect(tapped?.status).toEqual({ kind: 'on' });
    expect(removed).toEqual({ removed: true, status: { kind: 'on' } });
    expect(world.keys.held()).toMatchObject({ deviceId: DEVICE_ID, pushKey: NEW_KEY });
    expect(hold.held(SCOPE)).toBe(false);
  });
});

describe('leaving while a first registration is out', () => {
  it('sign-out: the POST settles, its key is not kept, and the row it named is revoked', async () => {
    const post = heldAnswer(minted(KEY));
    const phoneAt = await leavingPhone({
      record: null,
      script: { register: [post.answer], revoke: [ok] },
    });
    const running = phoneAt.registrar.run();
    await until(() => phoneAt.world.api.calls.length === 1);
    const leaving = phoneAt.leave();
    post.release();
    const [, left] = await Promise.all([running, leaving]);
    expect(left).toEqual({ revoked: true, failed: [] });
    expect(phoneAt.world.api.routes()).toEqual([POST, DELETE]);
    expect(phoneAt.kept()).toBe(false);
    await phoneAt.registrar.run({ force: true });
    expect(phoneAt.world.api.calls).toHaveLength(2);
  });

  it('a new pairing that replaces the hosted server: the same row is revoked before the provider goes', async () => {
    const order: string[] = [];
    const post = heldAnswer(minted(KEY));
    const revoked: Answer = () => (order.push('DELETE'), jsonReply(200, {}));
    const phoneAt = await leavingPhone({
      order,
      record: null,
      script: { register: [post.answer], revoke: [revoked] },
    });
    detach = phoneLinks.attach(phoneAt.link);
    const running = phoneAt.registrar.run();
    await until(() => phoneAt.world.api.calls.length === 1);
    const switching = (await serverSwitchOver(order, 'clerk', null)).connectTo(RECORD);
    post.release();
    await Promise.all([running, switching]);
    expect(phoneAt.world.api.routes()).toEqual([POST, DELETE]);
    expect(order.indexOf('DELETE')).toBeLessThan(order.indexOf('provider:clerk'));
  });
});
