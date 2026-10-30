// Readiness@1 as the phone reads it (PRD-268 §6.11.3): core's answer parses whole; unknown fields
// are ignored; an item the app cannot draw is dropped, never drawn as a placeholder; a fix that is
// not an app path is dropped and its item kept; GET and Check again go through the one client to
// core's paths, and a 429 keeps the server's code and words. The route table is pendingUpstream
// until the core pin carries it.

import { describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { isPersistableKey } from '../../api/query-keys';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import { checkReadiness, fetchReadiness } from '../api';
import { readinessQueryKeys } from '../query-keys';
import { READINESS_ROUTES, READINESS_UPSTREAM } from '../routes';
import { ReadinessSchema, isAppPath } from '../schema';
import { CHECKED_AT, CORE_ITEM, MODEL_ITEM, READINESS_BODY } from './fixtures';

const WORKSPACE_ID = '7f1c2a54-0000-4000-8000-000000000001';

function parse(items: readonly unknown[]) {
  return ReadinessSchema.parse({ v: 1, checked_at: CHECKED_AT, items });
}

describe('ReadinessSchema', () => {
  it("reads core's answer whole, frozen", () => {
    const readiness = ReadinessSchema.parse(READINESS_BODY);
    expect(readiness.checked_at).toBe(CHECKED_AT);
    expect(readiness.items.map((item) => item.id)).toEqual([
      'core',
      'model_route',
      'web_search',
      'push',
    ]);
    expect(readiness.items[1]?.fix).toEqual(MODEL_ITEM.fix);
    expect(Object.isFrozen(readiness)).toBe(true);
    expect(Object.isFrozen(readiness.items)).toBe(true);
    expect(Object.isFrozen(readiness.items[1])).toBe(true);
    expect(Object.isFrozen(readiness.items[1]?.fix)).toBe(true);
  });

  it('ignores unknown fields, on the answer and on an item', () => {
    const readiness = ReadinessSchema.parse({
      ...READINESS_BODY,
      held_for: 60,
      items: [{ ...CORE_ITEM, latency_ms: 12 }],
    });
    expect(readiness.items[0]).not.toHaveProperty('latency_ms');
    expect(readiness).not.toHaveProperty('held_for');
  });

  it('drops an item with a state this version does not know, or no id or label', () => {
    const readiness = parse([
      CORE_ITEM,
      { ...CORE_ITEM, id: 'calendar', state: 'degraded' },
      { ...CORE_ITEM, id: '' },
      { ...CORE_ITEM, id: 'x', label: '  ' },
      'not an item',
    ]);
    expect(readiness.items.map((item) => item.id)).toEqual(['core']);
  });

  it('drops a fix that is not an app path and keeps its item', () => {
    for (const href of [
      'https://evil.example/x',
      '//evil.example/x',
      '/\\evil.example',
      'settings',
    ]) {
      const [item] = parse([{ ...MODEL_ITEM, fix: { label: 'Fix', href } }]).items;
      expect(item?.id).toBe('model_route');
      expect(item?.fix).toBeNull();
    }
  });

  it('keeps only the needed_by values it knows, once each', () => {
    const [item] = parse([{ ...CORE_ITEM, needed_by: ['brief', 'teleport', 'brief', 7] }]).items;
    expect(item?.needed_by).toEqual(['brief']);
  });

  it('reads a missing detail as empty, and a missing needed_by as none', () => {
    const { detail: _detail, needed_by: _needs, ...bare } = CORE_ITEM;
    const [item] = parse([bare]).items;
    expect(item?.detail).toBe('');
    expect(item?.needed_by).toEqual([]);
  });

  it('refuses another version of the contract', () => {
    expect(ReadinessSchema.safeParse({ ...READINESS_BODY, v: 2 }).success).toBe(false);
  });

  it('isAppPath: a path on this host only', () => {
    expect(isAppPath('/settings?tab=orchestrator')).toBe(true);
    expect(isAppPath('//evil.example')).toBe(false);
    expect(isAppPath('/\\evil.example')).toBe(false);
    expect(isAppPath('javascript:alert(1)')).toBe(false);
  });
});

describe('the calls', () => {
  function clientAnswering(status: number, body: unknown) {
    const transport = fakeTransport(() => jsonReply(status, body));
    const client = createApiClient({
      server: SERVER,
      getToken: async () => 'jwt.token.value',
      getWorkspaceId: () => WORKSPACE_ID,
      transport,
    });
    return { transport, client };
  }

  it('GETs /api/readiness and parses it', async () => {
    const { transport, client } = clientAnswering(200, READINESS_BODY);
    const readiness = await fetchReadiness(client);
    expect(readiness.items).toHaveLength(4);
    expect(transport.calls[0]?.method).toBe('GET');
    expect(transport.calls[0]?.url).toBe(`${SERVER.apiUrl}/api/readiness`);
  });

  it('Check again POSTs /api/readiness/check once, with no body', async () => {
    const { transport, client } = clientAnswering(200, READINESS_BODY);
    await checkReadiness(client);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.method).toBe('POST');
    expect(transport.calls[0]?.url).toBe(`${SERVER.apiUrl}/api/readiness/check`);
  });

  it("a 429 is an ApiError with the server's code and words", async () => {
    const { client } = clientAnswering(429, {
      code: 'checked_recently',
      detail: 'Checked a moment ago. Try again in a minute.',
    });
    const error = await checkReadiness(client).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      code: 'checked_recently',
      serverMessage: 'Checked a moment ago. Try again in a minute.',
    });
  });
});

describe('routes and cache', () => {
  it('both routes are pendingUpstream until the core pin carries them', () => {
    expect(READINESS_ROUTES.current).toEqual({
      method: 'GET',
      path: '/api/readiness',
      pendingUpstream: READINESS_UPSTREAM,
    });
    expect(READINESS_ROUTES.check).toEqual({
      method: 'POST',
      path: '/api/readiness/check',
      pendingUpstream: READINESS_UPSTREAM,
    });
  });

  it('the readiness key is never persisted (memory only)', () => {
    expect(isPersistableKey(readinessQueryKeys.current(SERVER.apiUrl, WORKSPACE_ID))).toBe(false);
    expect(isPersistableKey(readinessQueryKeys.all())).toBe(false);
  });
});
