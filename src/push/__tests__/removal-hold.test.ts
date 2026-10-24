// Remove this phone's hold (US-014h, KP16): W1 re-enrols a row its own person revoked, so the phone
// holds its scope (server and workspace) in one MMKV item — scope keys only, at most
// REMOVED_SCOPES_MAX, the oldest dropped — and while held its status is 'ask' and registration
// takes no step (an OS denial still says so); the in-context ask is never offered for it.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { REMOVED_SCOPES_ITEM, REMOVED_SCOPES_MAX } from '../config';
import { promptStatusOf } from '../prompt/policy';
import type { RecordScope } from '../registration/record';
import { removalHoldOver, withHeld, withoutHeld } from '../registration/removal-hold';
import { nextStep, pushStatus } from '../registration/state';
import { WS } from './data-fixtures';
import { memoryStorage } from './handler-fixtures';
import { ORIGIN, OTHER_WORKSPACE, facts } from './registration-fixtures';

// The registration fixtures build the real key store over a fake SecureStore.
vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const HERE: RecordScope = Object.freeze({ serverOrigin: ORIGIN, workspaceId: WS });
const THERE: RecordScope = Object.freeze({ serverOrigin: ORIGIN, workspaceId: OTHER_WORKSPACE });

afterEach(() => vi.restoreAllMocks());

describe('removalHoldOver: one MMKV item of scopes', () => {
  it('holds a scope until it is released; another scope is its own', () => {
    const storage = memoryStorage();
    const hold = removalHoldOver(storage);
    expect(hold.held(HERE)).toBe(false);
    hold.hold(HERE);
    expect(hold.held(HERE)).toBe(true);
    expect(hold.held(THERE)).toBe(false);
    expect(JSON.parse(storage.items.get(REMOVED_SCOPES_ITEM) ?? '[]')).toEqual([
      JSON.stringify([ORIGIN, WS]),
    ]);
    hold.release(HERE);
    expect(hold.held(HERE)).toBe(false);
  });

  it('a release of a scope not held writes nothing; a second hold keeps one entry', () => {
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    const hold = removalHoldOver(storage);
    hold.release(HERE);
    expect(setItem).not.toHaveBeenCalled();
    hold.hold(HERE);
    hold.hold(HERE);
    expect(JSON.parse(storage.items.get(REMOVED_SCOPES_ITEM) ?? '[]')).toHaveLength(1);
  });

  it('keeps at most REMOVED_SCOPES_MAX scopes, the oldest dropped; never changes its input', () => {
    const scopes = Object.freeze(
      Array.from({ length: REMOVED_SCOPES_MAX }, (_, index) => `scope-${index}`),
    );
    const next = withHeld(scopes, HERE);
    expect(next).toHaveLength(REMOVED_SCOPES_MAX);
    expect(next[0]).toBe('scope-1');
    expect(next.at(-1)).toBe(JSON.stringify([ORIGIN, WS]));
    expect(withoutHeld(next, HERE)).toHaveLength(REMOVED_SCOPES_MAX - 1);
    expect(scopes[0]).toBe('scope-0');
  });

  it('an unreadable item or a failing store reads as not held; a failed write is logged', () => {
    const corrupt = memoryStorage({ [REMOVED_SCOPES_ITEM]: '{not json' });
    expect(removalHoldOver(corrupt).held(HERE)).toBe(false);
    const wrongShape = memoryStorage({ [REMOVED_SCOPES_ITEM]: JSON.stringify({ a: 1 }) });
    expect(removalHoldOver(wrongShape).held(HERE)).toBe(false);
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const failing = removalHoldOver({
      getItem: () => {
        throw new Error('mmkv closed');
      },
      setItem: () => {
        throw new Error('mmkv closed');
      },
    });
    expect(failing.held(HERE)).toBe(false);
    failing.hold(HERE);
    expect(warn).toHaveBeenCalledWith('[push] could not keep the removal hold');
  });
});

describe('a held phone: ask, and no step (KP16)', () => {
  it('a held, granted phone is ask and takes no step, whatever its record or row', () => {
    const held = facts({ held: true });
    expect(pushStatus(held)).toEqual({ kind: 'ask' });
    expect(nextStep(held)).toBe('none');
    const keyless = facts({
      held: true,
      record: null,
      serverRow: { deviceId: WS, pushEnabled: true, disabledReason: null },
    });
    expect(pushStatus(keyless)).toEqual({ kind: 'ask' });
    expect(nextStep(keyless)).toBe('none');
  });

  it('the gates and an OS denial still say so; not held, the same facts register', () => {
    expect(pushStatus(facts({ held: true, pushExpo: false }))).toEqual({ kind: 'operator_off' });
    expect(pushStatus(facts({ held: true, permission: 'denied' }))).toEqual({ kind: 'denied' });
    expect(pushStatus(facts({ record: null }))).toEqual({ kind: 'off', reason: 'other' });
    expect(nextStep(facts({ record: null }))).toBe('register');
  });

  it('the in-context ask never offers itself to a held phone; otherwise it reads the status', () => {
    const ask = { kind: 'ask' } as const;
    expect(promptStatusOf({ status: ask, facts: facts({ held: true }) })).toBeNull();
    expect(promptStatusOf({ status: ask, facts: facts({ permission: 'undetermined' }) })).toBe(ask);
  });
});
