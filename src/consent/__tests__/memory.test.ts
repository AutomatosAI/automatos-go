// US-007c: the consent step's memory over the real consent store and the foundation's
// memoryStorage. One snapshot per scope until it changes; a failed write still holds the yes for
// this run; the switch's two calls leave no left server's record behind, even when a listener
// reads back between them.

import { describe, expect, it } from 'vitest';

import { memoryStorage } from '../../storage/encrypted-storage';
import { createConsentMemory } from '../memory';
import { consentRecordFor } from '../policy';
import { consentKeyFor, createConsentStore, type ConsentScope, type ConsentStore } from '../store';

const OWN: ConsentScope = {
  origin: 'http://192.168.1.20:8000',
  workspaceId: '7f1c2a54-0000-4000-8000-000000000001',
};
const OWN_OTHER: ConsentScope = { ...OWN, workspaceId: '7f1c2a54-0000-4000-8000-000000000002' };
const HOSTED: ConsentScope = { ...OWN, origin: 'https://api.example.test' };
const AGREED = consentRecordFor(
  { kind: 'listed', providers: [{ id: 'retell', name: 'Retell AI' }] },
  new Date('2026-10-23T09:00:00.000Z'),
);

function setup() {
  const storage = memoryStorage();
  const store = createConsentStore({ storage: () => storage });
  return { storage, store, memory: createConsentMemory({ store }) };
}

/** The store, counting its reads. */
function counting(store: ConsentStore) {
  const reads = { count: 0 };
  const wrapped: ConsentStore = {
    ...store,
    read: (scope) => {
      reads.count += 1;
      return store.read(scope);
    },
  };
  return { reads, store: wrapped };
}

describe('the consent memory: reads', () => {
  it('reads the store once per scope and hands back the same snapshot', () => {
    const { store } = setup();
    store.write(OWN, AGREED);
    const { reads, store: watched } = counting(store);
    const memory = createConsentMemory({ store: watched });
    const first = memory.read(OWN);
    expect(first).toEqual(AGREED);
    expect(memory.read(OWN)).toBe(first);
    expect(memory.read(OWN_OTHER)).toBeNull();
    expect(memory.read(OWN_OTHER)).toBeNull();
    expect(reads.count).toBe(2);
  });

  it('a read tells no listener (it is no change)', () => {
    const { memory } = setup();
    let heard = 0;
    memory.subscribe(() => {
      heard += 1;
    });
    memory.read(OWN);
    expect(heard).toBe(0);
  });

  it('keeps scopes apart: no origin runs into a workspace id', () => {
    const { memory } = setup();
    memory.agree({ origin: 'a|b', workspaceId: 'c' }, AGREED);
    expect(memory.read({ origin: 'a', workspaceId: 'b|c' })).toBeNull();
  });
});

describe('the consent memory: agree', () => {
  it('writes the store, then holds the record and tells every listener', () => {
    const { store, memory } = setup();
    const heard: string[] = [];
    const stop = memory.subscribe(() => heard.push('one'));
    memory.subscribe(() => heard.push('two'));
    memory.read(OWN);
    memory.agree(OWN, AGREED);
    expect(store.read(OWN)).toEqual(AGREED);
    expect(memory.read(OWN)).toEqual(AGREED);
    expect(heard).toEqual(['one', 'two']);
    stop();
    memory.agree(OWN_OTHER, AGREED);
    expect(heard).toEqual(['one', 'two', 'two']);
  });

  it('a write the phone refuses still holds the yes for this run; the next launch asks again', () => {
    const { store } = setup();
    const refusing: ConsentStore = {
      ...store,
      write: () => {
        throw new Error('the encrypted store is full');
      },
    };
    const memory = createConsentMemory({ store: refusing });
    expect(() => memory.agree(OWN, AGREED)).not.toThrow();
    expect(memory.read(OWN)).toEqual(AGREED);
    expect(createConsentMemory({ store }).read(OWN)).toBeNull();
  });

  it('a listener that throws does not stop the others', () => {
    const { memory } = setup();
    let heard = 0;
    memory.subscribe(() => {
      throw new Error('a broken screen');
    });
    memory.subscribe(() => {
      heard += 1;
    });
    memory.agree(OWN, AGREED);
    expect(heard).toBe(1);
  });
});

describe('the consent memory: the switch', () => {
  it('resetMemory forgets every held record and reads the store again', () => {
    const { storage, memory } = setup();
    memory.agree(OWN, AGREED);
    storage.removeItem(consentKeyFor(OWN.origin));
    expect(memory.read(OWN)).toEqual(AGREED);
    let heard = 0;
    memory.subscribe(() => {
      heard += 1;
    });
    memory.resetMemory();
    expect(heard).toBe(1);
    expect(memory.read(OWN)).toBeNull();
  });

  it("forgetServer removes the server's records from the store and memory; the hosted one's stay", async () => {
    const { store, memory } = setup();
    memory.agree(OWN, AGREED);
    memory.agree(OWN_OTHER, AGREED);
    memory.agree(HOSTED, AGREED);
    await memory.forgetServer(OWN.origin);
    expect(memory.read(OWN)).toBeNull();
    expect(memory.read(OWN_OTHER)).toBeNull();
    expect(store.read(OWN)).toBeNull();
    expect(memory.read(HOSTED)).toEqual(AGREED);
    expect(store.read(HOSTED)).toEqual(AGREED);
  });

  it('in the switch’s order, a listener reading between the two calls leaves nothing behind', async () => {
    const { memory } = setup();
    memory.agree(OWN, AGREED);
    const seen: unknown[] = [];
    // useSyncExternalStore reads the snapshot inside the listener
    memory.subscribe(() => seen.push(memory.read(OWN)));
    memory.resetMemory();
    await memory.forgetServer(OWN.origin);
    expect(seen).toEqual([AGREED, null]);
    expect(memory.read(OWN)).toBeNull();
  });
});
