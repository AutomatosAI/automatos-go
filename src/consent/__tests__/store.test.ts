// US-007b: the consent records in the app's encrypted store, per server origin and workspace
// (KC11), over the foundation's memoryStorage. A value that does not parse reads as no record.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { QUERY_CACHE_STORAGE_KEY } from '../../api/query-client';
import { memoryStorage } from '../../storage/encrypted-storage';
import { consentRecordFor } from '../policy';
import { consentKeyFor, createConsentStore, type ConsentRecord } from '../store';

const OWN = 'http://192.168.1.20:8000';
const HOSTED = 'https://api.example.test';
const WORKSPACE = '7f1c2a54-0000-4000-8000-000000000001';
const OTHER_WORKSPACE = '7f1c2a54-0000-4000-8000-000000000002';

const AGREED = consentRecordFor(
  { kind: 'listed', providers: [{ id: 'deepseek', name: 'DeepSeek' }] },
  new Date('2026-10-23T09:00:00.000Z'),
);
const UNLISTED_AGREED = consentRecordFor({ kind: 'unlisted' }, new Date('2026-10-22T08:00:00Z'));

function setup() {
  const storage = memoryStorage();
  return { storage, store: createConsentStore({ storage: () => storage }) };
}

describe('the consent store: a round trip', () => {
  it('reads back what it wrote, for that server and workspace only', () => {
    const { store } = setup();
    store.write({ origin: OWN, workspaceId: WORKSPACE }, AGREED);
    expect(store.read({ origin: OWN, workspaceId: WORKSPACE })).toEqual(AGREED);
    expect(store.read({ origin: OWN, workspaceId: OTHER_WORKSPACE })).toBeNull();
    expect(store.read({ origin: HOSTED, workspaceId: WORKSPACE })).toBeNull();
  });

  it('keeps every workspace of a server under its one key, and replaces only its own', () => {
    const { storage, store } = setup();
    store.write({ origin: OWN, workspaceId: WORKSPACE }, UNLISTED_AGREED);
    store.write({ origin: OWN, workspaceId: OTHER_WORKSPACE }, AGREED);
    store.write({ origin: OWN, workspaceId: WORKSPACE }, AGREED);
    expect(store.read({ origin: OWN, workspaceId: WORKSPACE })).toEqual(AGREED);
    expect(store.read({ origin: OWN, workspaceId: OTHER_WORKSPACE })).toEqual(AGREED);
    expect(Object.keys(JSON.parse(storage.getItem(consentKeyFor(OWN)) ?? '{}'))).toEqual([
      WORKSPACE,
      OTHER_WORKSPACE,
    ]);
  });

  it('is empty before anything is written', () => {
    expect(setup().store.read({ origin: OWN, workspaceId: WORKSPACE })).toBeNull();
  });

  it('refuses to write a record that would not read back, naming no value', () => {
    const { store } = setup();
    const bad = { ...AGREED, agreedAt: 'yesterday' } as ConsentRecord;
    expect(() => store.write({ origin: OWN, workspaceId: WORKSPACE }, bad)).toThrow(
      'not a consent record (agreedAt: invalid_string)',
    );
  });
});

describe('the consent store: a corrupt value reads as no record', () => {
  it.each([
    ['not JSON', '{not json'],
    ['not a map', '"agreed"'],
    ['a list', '[]'],
  ])('%s → none, and a write starts the key afresh', (_label, raw) => {
    const { storage, store } = setup();
    storage.setItem(consentKeyFor(OWN), raw);
    expect(store.read({ origin: OWN, workspaceId: WORKSPACE })).toBeNull();
    store.write({ origin: OWN, workspaceId: WORKSPACE }, AGREED);
    expect(store.read({ origin: OWN, workspaceId: WORKSPACE })).toEqual(AGREED);
  });

  it("a workspace's bad record reads as none; the server's good ones still read", () => {
    const { storage, store } = setup();
    const raw = {
      [WORKSPACE]: { ...AGREED, fingerprint: '' },
      [OTHER_WORKSPACE]: { ...AGREED, extra: 'ignored' },
    };
    storage.setItem(consentKeyFor(OWN), JSON.stringify(raw));
    expect(store.read({ origin: OWN, workspaceId: WORKSPACE })).toBeNull();
    expect(store.read({ origin: OWN, workspaceId: OTHER_WORKSPACE })).toEqual(AGREED);
  });

  it('a store that throws on read reads as none', () => {
    const store = createConsentStore({
      storage: () => ({
        getItem: () => {
          throw new Error('locked');
        },
        setItem: () => undefined,
        removeItem: () => undefined,
      }),
    });
    expect(store.read({ origin: OWN, workspaceId: WORKSPACE })).toBeNull();
  });
});

describe('forgetServer: what switch.forgetServer calls (US-006d)', () => {
  it("removes every record of that server and nothing else of the app's store", async () => {
    const { storage, store } = setup();
    storage.setItem(QUERY_CACHE_STORAGE_KEY, '{"clientState":{}}');
    store.write({ origin: OWN, workspaceId: WORKSPACE }, AGREED);
    store.write({ origin: OWN, workspaceId: OTHER_WORKSPACE }, AGREED);
    store.write({ origin: HOSTED, workspaceId: WORKSPACE }, AGREED);
    await store.forgetServer(OWN);
    expect(storage.getItem(consentKeyFor(OWN))).toBeNull();
    expect(store.read({ origin: OWN, workspaceId: OTHER_WORKSPACE })).toBeNull();
    expect(store.read({ origin: HOSTED, workspaceId: WORKSPACE })).toEqual(AGREED);
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBe('{"clientState":{}}');
  });

  it('never throws: a store that refuses still lets the switch go on', async () => {
    const store = createConsentStore({
      storage: () => {
        throw new Error('locked');
      },
    });
    await expect(store.forgetServer(OWN)).resolves.toBeUndefined();
  });
});

describe('never sent to a server', () => {
  it('the consent modules import no HTTP client, route table or transport', () => {
    const folder = path.resolve(__dirname, '..');
    for (const file of ['store.ts', 'policy.ts', 'providers.ts', 'app-store.ts']) {
      const source = readFileSync(path.join(folder, file), 'utf8');
      expect(source).not.toMatch(/api\/(client|routes|transport|stream|sse)['"]|fetch\(/);
    }
  });
});
