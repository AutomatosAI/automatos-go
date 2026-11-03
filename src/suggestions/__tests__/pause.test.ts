// "Pause suggestions" (PRD-268 §6.9) as the phone reads and writes it: GET /api/proactive/me
// through the one client, only the pause kept; a press PUTs {paused} once, lands the server's
// answer in the cache and reads the open list again; a refusal changes nothing and is one line
// under the switch; while paused, every surface shows no suggestion. Both routes are on the server
// at the core pin.

import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { isPersistableKey } from '../../api/query-keys';
import { API_ERROR_COPY } from '../../api/strings';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import { servedAtPin } from '../../api/__tests__/served';
import type { TransportRequest } from '../../api/transport-types';
import { OPEN_KEY } from '../cache';
import { shownSuggestions } from '../model';
import {
  applyPause,
  fetchMyProactive,
  pausedNow,
  pauseQueryKeys,
  pauseView,
  savePaused,
  type PauseInput,
} from '../pause';
import { SUGGESTION_ROUTES } from '../routes';
import { PAUSE_COPY } from '../strings';
import { suggestion } from './fixtures';

const WORKSPACE_ID = '7f1c2a54-0000-4000-8000-000000000001';
const KEY = pauseQueryKeys.mine(SERVER.apiUrl, WORKSPACE_ID);
const ME_URL = `${SERVER.apiUrl}/api/proactive/me`;

/** Core's answer (services/proactive/settings.py PersonSettings.to_dict). */
function me(paused: boolean) {
  return { paused, quiet_start: '22:00', quiet_end: '07:00', timezone: 'Europe/Lisbon' };
}

/** A server that keeps the person's pause and answers GET and PUT as core does. */
function server(initial: boolean, refuse?: { status: number; body: unknown }) {
  let paused = initial;
  const transport = fakeTransport((request: TransportRequest) => {
    if (request.method === 'PUT') {
      if (refuse) return jsonReply(refuse.status, refuse.body);
      paused = (JSON.parse(String(request.body)) as { paused: boolean }).paused;
    }
    return jsonReply(200, me(paused));
  });
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'token',
    getWorkspaceId: () => WORKSPACE_ID,
    transport,
  });
  return { client, transport };
}

const wire = (call: TransportRequest | undefined) => ({
  line: `${call?.method} ${call?.url}`,
  body: call?.body === undefined ? undefined : JSON.parse(String(call.body)),
});

const READ: PauseInput = Object.freeze({
  paused: false,
  choosing: null,
  loading: false,
  readError: null,
  failure: null,
});

describe('the pause calls', () => {
  it('reads the pause from GET /api/proactive/me and keeps only it, frozen', async () => {
    const { client, transport } = server(true);
    const mine = await fetchMyProactive(client);
    expect(mine).toEqual({ paused: true });
    expect(Object.isFrozen(mine)).toBe(true);
    expect(wire(transport.calls[0])).toEqual({ line: `GET ${ME_URL}`, body: undefined });
  });

  it('writes only {paused} with PUT, once', async () => {
    const { client, transport } = server(false);
    expect(await savePaused(client, true)).toEqual({ paused: true });
    expect(transport.calls).toHaveLength(1);
    expect(wire(transport.calls[0])).toEqual({ line: `PUT ${ME_URL}`, body: { paused: true } });
  });

  it('an answer without a true-or-false pause is an invalid response, never a guess', async () => {
    const transport = fakeTransport(() => jsonReply(200, { paused: 'yes' }));
    const client = createApiClient({
      server: SERVER,
      getToken: async () => 'token',
      getWorkspaceId: () => WORKSPACE_ID,
      transport,
    });
    const error = await fetchMyProactive(client).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'invalid_response' });
  });

  it('both routes are on the server at the core pin, so neither is pendingUpstream', () => {
    for (const route of [SUGGESTION_ROUTES.me, SUGGESTION_ROUTES.saveMe]) {
      expect({ route, served: servedAtPin(route) }).toEqual({ route, served: true });
      expect(route).not.toHaveProperty('pendingUpstream');
    }
  });

  it('keeps the pause in memory only, one key per server and workspace', () => {
    expect(isPersistableKey(KEY)).toBe(false);
    expect(KEY).not.toEqual(pauseQueryKeys.mine(SERVER.apiUrl, 'another-workspace'));
    expect(KEY.slice(0, 2)).toEqual(pauseQueryKeys.all());
  });
});

describe('a press', () => {
  function cached(paused: boolean) {
    const queryClient = new QueryClient();
    queryClient.setQueryData(KEY, { paused });
    queryClient.setQueryData(OPEN_KEY, [suggestion('a')]);
    return queryClient;
  }

  it('reads, toggles and writes: the server answer lands in the cache, each way', async () => {
    const { client, transport } = server(false);
    const queryClient = cached(false);
    const deps = { client, queryClient, key: KEY };
    expect(await applyPause(deps, true)).toEqual({ paused: true });
    expect(queryClient.getQueryData(KEY)).toEqual({ paused: true });
    expect(await applyPause(deps, false)).toEqual({ paused: false });
    expect(queryClient.getQueryData(KEY)).toEqual({ paused: false });
    expect(transport.calls.map((call) => wire(call).body)).toEqual([
      { paused: true },
      { paused: false },
    ]);
  });

  it('reads the open suggestions again after a pause or a resume', async () => {
    const { client } = server(false);
    const queryClient = cached(false);
    expect(queryClient.getQueryState(OPEN_KEY)?.isInvalidated).toBe(false);
    await applyPause({ client, queryClient, key: KEY }, true);
    expect(queryClient.getQueryState(OPEN_KEY)?.isInvalidated).toBe(true);
  });

  it('a refusal rejects with the ApiError and changes nothing', async () => {
    const { client } = server(false, { status: 503, body: { code: 'settings_unavailable' } });
    const queryClient = cached(false);
    const error = await applyPause({ client, queryClient, key: KEY }, true).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(queryClient.getQueryData(KEY)).toEqual({ paused: false });
    expect(queryClient.getQueryState(OPEN_KEY)?.isInvalidated).toBe(false);
  });
});

describe('the switch', () => {
  it("shows the server's answer once read, and the choice while its write is out", () => {
    expect(pauseView({ ...READ, paused: true })).toEqual({
      value: true,
      disabled: false,
      line: null,
    });
    expect(pauseView({ ...READ, choosing: true })).toEqual({
      value: true,
      disabled: true,
      line: null,
    });
  });

  it('cannot be pressed before the first read lands, and says it is reading', () => {
    expect(pauseView({ ...READ, paused: undefined, loading: true })).toEqual({
      value: false,
      disabled: true,
      line: PAUSE_COPY.reading,
    });
  });

  it('a failed read shows its line, never a crash', () => {
    const view = pauseView({
      ...READ,
      paused: undefined,
      readError: new ApiError('network'),
    });
    expect(view.line).toBe(`${PAUSE_COPY.readFailed} ${API_ERROR_COPY.network}`);
    expect(view.disabled).toBe(true);
  });

  it('a refused write shows its line under the switch, which shows the server answer again', () => {
    const paused = pauseView({
      ...READ,
      failure: { paused: true, error: new ApiError('server', { status: 503 }) },
    });
    expect(paused).toEqual({
      value: false,
      disabled: false,
      line: `${PAUSE_COPY.pauseFailed} ${API_ERROR_COPY.server}`,
    });
    const resumed = pauseView({
      ...READ,
      paused: true,
      failure: { paused: false, error: new Error('boom') },
    });
    expect(resumed.line).toBe(`${PAUSE_COPY.resumeFailed} ${API_ERROR_COPY.server}`);
  });

  it('a later refetch that fails says nothing while the answer is on screen', () => {
    expect(pauseView({ ...READ, readError: new ApiError('network') }).line).toBeNull();
  });

  it('a caller with no person behind it (403) reads as a line, and the switch stays put', () => {
    const view = pauseView({
      ...READ,
      paused: undefined,
      readError: new ApiError('forbidden', { status: 403, code: 'no_person' }),
    });
    expect(view).toEqual({
      value: false,
      disabled: true,
      line: `${PAUSE_COPY.readFailed} ${API_ERROR_COPY.forbidden}`,
    });
  });
});

describe('while paused', () => {
  const list = [suggestion('a'), suggestion('b')];
  const now = Date.parse('2026-10-30T12:00:00Z');

  it('every surface shows none; on a resume the open ones come back', () => {
    expect(shownSuggestions({ offered: true, paused: true, list, now })).toEqual([]);
    expect(shownSuggestions({ offered: true, paused: false, list, now })).toHaveLength(2);
  });

  it('shows none until the pause is read, so nothing appears and then vanishes', () => {
    expect(pausedNow({ data: undefined, isError: false })).toBeUndefined();
    expect(shownSuggestions({ offered: true, paused: undefined, list, now })).toEqual([]);
  });

  it("reads the server's answer, and a failed read as not paused (core stops new ones)", () => {
    expect(pausedNow({ data: { paused: true }, isError: false })).toBe(true);
    expect(pausedNow({ data: { paused: false }, isError: false })).toBe(false);
    expect(pausedNow({ data: { paused: true }, isError: true })).toBe(true);
    expect(pausedNow({ data: undefined, isError: true })).toBe(false);
  });

  it('shows none where discovery does not list suggestions, or before the list is read', () => {
    expect(shownSuggestions({ offered: false, paused: false, list, now })).toEqual([]);
    expect(shownSuggestions({ offered: true, paused: false, list: undefined, now })).toEqual([]);
  });
});

describe('the words', () => {
  it('say what a pause stops and that the daily brief still comes', () => {
    expect(PAUSE_COPY.title).toBe('Pause suggestions');
    expect(PAUSE_COPY.detail).toMatch(/no new suggestions for you and sends no notifications/);
    expect(PAUSE_COPY.detail).toMatch(/daily brief still comes unless Daily digest is off/);
  });
});
