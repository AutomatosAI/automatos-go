// A row on the server this phone has no record of (registration/attempts.ts, bind/leave.ts): a
// POST that reached the server but whose answer never came (a timeout after it left, the app killed
// while it was out). The attempt is noted before the POST goes and cleared once a record is kept;
// the next launch registers again and a hosted phone recovers its key; a hosted sign-out with no
// other id learns the row by registering again without the push token, then DELETEs it; nothing is
// learned where nothing was sent, where the person removed this phone, or on an own server; a 409
// or no answer in 4 s leaves it there, as an offline DELETE does. Notifications off in the phone's
// Settings then has nothing to send, and Remove this phone is not offered without a record.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { recordedDeviceId, removeShown } from '../bind/remove-phone';
import {
  REGISTRATION_ATTEMPTS_ITEM,
  REGISTRATION_ATTEMPTS_MAX,
  SIGN_OUT_DELETE_TIMEOUT_MS,
} from '../config';
import { registrationAttemptsOver, withAttempt } from '../registration/attempts';
import { register } from '../registration/register';
import { recoveryLogOver } from '../registration/recovery-log';
import { removalHoldOver } from '../registration/removal-hold';
import { DEVICE_ID, WS, sent } from './data-fixtures';
import { leavingPhone } from './leave-fixtures';
import {
  DENIED,
  INSTALL_ID,
  KEY,
  NEW_KEY,
  NEW_TOKEN,
  ORIGIN,
  T0,
  conflict,
  memoryStorage,
  minted,
  offline,
  ok,
  setup,
  type Answer,
  type Script,
} from './registration-fixtures';

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const POST = 'POST /api/v1/mobile/devices';
const DELETE = `DELETE /api/v1/mobile/devices/${DEVICE_ID}`;
const SCOPE = Object.freeze({ serverOrigin: ORIGIN, workspaceId: WS });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A hosted phone that sent its first registration and never heard back. */
async function lostPhone(script: Script = {}) {
  const phoneAt = await leavingPhone({
    record: null,
    script: { ...script, register: [offline, ...(script.register ?? [])] },
  });
  await phoneAt.registrar.run();
  const attempts = registrationAttemptsOver(phoneAt.world.storage);
  expect(attempts.noted(SCOPE)).toBe(true);
  return { phoneAt, attempts };
}

describe('the attempt: noted before the POST goes, cleared once a record is kept', () => {
  it('noted while the POST is out; an answer that never came leaves it; a kept record clears it', async () => {
    const storage = memoryStorage();
    const attempts = registrationAttemptsOver(storage);
    let notedAtSend = false;
    const lost: Answer = () => {
      notedAtSend = attempts.noted(SCOPE);
      return offline();
    };
    const run = setup({ storage, script: { register: [lost, minted(KEY)] } });
    expect((await register(run.deps)).status).toEqual({ kind: 'off', reason: 'other' });
    expect([notedAtSend, attempts.noted(SCOPE)]).toEqual([true, true]);
    expect((await register(run.deps)).status).toEqual({ kind: 'on' });
    expect(attempts.noted(SCOPE)).toBe(false);
    expect(JSON.parse(storage.items.get(REGISTRATION_ATTEMPTS_ITEM) ?? '')).toEqual([]);
  });

  it('the next launch registers again, learns its row and, hosted, recovers its key', async () => {
    const first = setup({ script: { register: [offline] } });
    await register(first.deps);
    const next = setup({
      storage: first.storage,
      script: { register: [minted(null), minted(NEW_KEY)], revoke: [ok] },
    });
    expect((await register(next.deps)).status).toEqual({ kind: 'on' });
    expect(next.api.routes()).toEqual([POST, DELETE, POST]);
    expect(registrationAttemptsOver(first.storage).noted(SCOPE)).toBe(false);
  });

  it('keeps scopes only, at most REGISTRATION_ATTEMPTS_MAX, the oldest dropped; a failing store reads none', () => {
    const scopes = Array.from(
      { length: REGISTRATION_ATTEMPTS_MAX },
      (_, index) => `scope-${index}`,
    );
    const next = withAttempt(scopes, SCOPE);
    expect([next.length, next[0], next.at(-1)]).toEqual([
      REGISTRATION_ATTEMPTS_MAX,
      'scope-1',
      JSON.stringify([ORIGIN, WS]),
    ]);
    const failing = registrationAttemptsOver({
      getItem: () => {
        throw new Error('mmkv closed');
      },
      setItem: () => {
        throw new Error('mmkv closed');
      },
    });
    failing.note(SCOPE);
    expect(failing.noted(SCOPE)).toBe(false);
    const corrupt = memoryStorage();
    corrupt.setItem(REGISTRATION_ATTEMPTS_ITEM, '{not json');
    expect(registrationAttemptsOver(corrupt).noted(SCOPE)).toBe(false);
  });
});

describe('a hosted sign-out after an answer that never came', () => {
  it('learns the row with a registration that carries no push token, then DELETEs it', async () => {
    const { phoneAt, attempts } = await lostPhone({ register: [minted(KEY)], revoke: [ok] });
    expect(await phoneAt.leave()).toEqual({ revoked: true, failed: [] });
    expect(phoneAt.world.api.routes()).toEqual([POST, POST, DELETE]);
    const learn = sent(phoneAt.world.api.calls[1]).body as Record<string, unknown>;
    expect(learn).toMatchObject({ install_id: INSTALL_ID, timezone: 'Europe/Dublin' });
    expect(learn).not.toHaveProperty('expo_push_token');
    expect([attempts.noted(SCOPE), phoneAt.kept()]).toEqual([false, false]);
  });

  it('a row the registrar heard but holds no key for: DELETEd at once, nothing learned', async () => {
    const phoneAt = await leavingPhone({
      record: null,
      script: { register: [minted(null)], revoke: [ok] },
    });
    recoveryLogOver(phoneAt.world.storage).note(SCOPE, T0); // the once-a-day recovery is spent
    expect((await phoneAt.registrar.run())?.status).toEqual({ kind: 'key_missing' });
    expect(await phoneAt.leave()).toEqual({ revoked: true, failed: [] });
    expect(phoneAt.world.api.routes()).toEqual([POST, DELETE]);
  });

  it('a record kept from before: its row is DELETEd and nothing is learned', async () => {
    const phoneAt = await leavingPhone({ script: { register: [offline], revoke: [ok] } });
    phoneAt.world.device.state.token = NEW_TOKEN;
    await phoneAt.registrar.run();
    expect(await phoneAt.leave()).toEqual({ revoked: true, failed: [] });
    expect(phoneAt.world.api.routes()).toEqual([POST, DELETE]);
  });

  it('nothing ever sent, or this phone removed here: nothing is learned or sent', async () => {
    const never = await leavingPhone({ record: null });
    expect(await never.leave()).toEqual({ revoked: false, failed: [] });
    expect(never.world.api.calls).toHaveLength(0);
    const { phoneAt } = await lostPhone({ register: [minted(KEY)] });
    removalHoldOver(phoneAt.world.storage).hold(SCOPE);
    expect(await phoneAt.leave()).toEqual({ revoked: false, failed: [] });
    expect(phoneAt.world.api.routes()).toEqual([POST]);
  });

  it('the server refuses the learning registration (409): no DELETE, and the attempt is cleared', async () => {
    const { phoneAt, attempts } = await lostPhone({ register: [conflict('device_revoked')] });
    expect(await phoneAt.leave()).toEqual({ revoked: false, failed: [] });
    expect(phoneAt.world.api.routes()).toEqual([POST, POST]);
    expect(attempts.noted(SCOPE)).toBe(false);
  });

  it('no answer within the 4 s: leaving goes on, the attempt kept', async () => {
    const { phoneAt, attempts } = await lostPhone({
      register: [() => new Promise(() => undefined)],
    });
    vi.useFakeTimers();
    let outcome: unknown = null;
    void phoneAt.leave().then((done) => (outcome = done));
    await vi.advanceTimersByTimeAsync(SIGN_OUT_DELETE_TIMEOUT_MS - 1);
    expect([outcome, phoneAt.world.api.routes()]).toEqual([null, [POST, POST]]);
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toEqual({ revoked: false, failed: [] });
    expect(phoneAt.world.api.calls[1]?.signal?.aborted).toBe(true);
    expect(attempts.noted(SCOPE)).toBe(true);
  });

  it('an own server learns nothing: its row is the connect kit’s to revoke', async () => {
    const phoneAt = await leavingPhone({
      source: 'own',
      record: null,
      script: { register: [offline] },
    });
    await phoneAt.registrar.run();
    expect(await phoneAt.leave()).toEqual({ revoked: false, failed: [] });
    expect(phoneAt.world.api.routes()).toEqual([POST]);
  });
});

describe('off and Remove this phone, before anything is learned', () => {
  it("off in the phone's Settings: nothing to send; the screen says the phone's setting is off", async () => {
    const run = setup({ script: { register: [offline] } });
    await register(run.deps);
    run.permission.answer = DENIED;
    expect((await register(run.deps)).status).toEqual({ kind: 'denied' });
    expect(run.api.routes()).toEqual([POST]);
  });

  it('Remove this phone is offered only with a record of the row, so it never says "removed" for none', async () => {
    const { phoneAt } = await lostPhone();
    const deviceId = await recordedDeviceId(phoneAt.world.keys.store, SCOPE);
    expect(deviceId).toBeNull();
    expect(removeShown({ source: 'hosted', linked: true, deviceId })).toBe(false);
  });
});
