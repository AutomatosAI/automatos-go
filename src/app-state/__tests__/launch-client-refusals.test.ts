// P001N-SEAM-1: the session's launch client reports its own 403s, whichever kit made the call, so
// a refusal outside the TanStack caches (a chat turn, a card's Approve, an upload) still reaches the
// role refresher. A request's and a stream's 403 are reported before the caller gets the same
// ApiError; the workspace read's own 403 is not (it IS the read); nothing else is reported. A fake
// transport, a recording channel.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SERVER, fakeTransport, jsonReply, reply } from '../../api/__tests__/fake-transport';
import { ApiError } from '../../api/errors';
import { routes, type Route } from '../../api/routes';
import type { ClientAuth } from '../../auth/providers/binding';
import { sessionRefusals } from '../../session/refusals';
import { createLaunchClient } from '../launch-client';

/** A screen's read. */
const BOARD: Route = { method: 'GET', path: '/api/test/board' };
/** A chat-shaped turn: a streamed POST, the way chat's turn runner opens it. */
const CHAT_TURN: Route = { method: 'POST', path: '/api/test/chat' };
/** A card's Approve: a plain POST whose answer is not needed. */
const APPROVE: Route = { method: 'POST', path: '/api/test/approve' };

const AUTH: ClientAuth = { getToken: async () => 'token', onAuthExpired: () => undefined };
const NOT_ALLOWED = JSON.stringify({ detail: 'Not allowed' });

function launchClient(answer: Parameters<typeof fakeTransport>[0]) {
  const reported: unknown[] = [];
  const client = createLaunchClient({
    server: SERVER,
    clientAuth: AUTH,
    workspaceIds: { get: () => null },
    transport: fakeTransport(answer),
    refusals: {
      report: (error) => {
        reported.push(error);
        return true;
      },
    },
  });
  return { client, reported };
}

const refusingAll = () => launchClient(() => reply(403, NOT_ALLOWED));

describe('the launch client reports its refusals', () => {
  it("a request's 403 is reported once, and the caller gets that same ApiError", async () => {
    const { client, reported } = refusingAll();
    const caught = await client.request(APPROVE, { body: { approve: true } }).catch((e) => e);
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).kind).toBe('forbidden');
    expect(reported).toEqual([caught]);
    expect(reported[0]).toBe(caught);
  });

  it("a stream's 403 (a chat turn) is reported once, and the caller gets that same ApiError", async () => {
    const { client, reported } = refusingAll();
    const caught = await client.stream(CHAT_TURN, { body: { message: 'hi' } }).catch((e) => e);
    expect((caught as ApiError).kind).toBe('forbidden');
    expect(reported).toHaveLength(1);
    expect(reported[0]).toBe(caught);
  });

  it("the workspace read's own 403 is never reported: it is the read, so it cannot loop", async () => {
    const { client, reported } = refusingAll();
    const caught = await client.request(routes.workspaceCurrent).catch((e) => e);
    expect((caught as ApiError).kind).toBe('forbidden');
    expect(reported).toEqual([]);
  });

  it('every other failure reaches the caller unreported', async () => {
    const statuses = [401, 404, 409, 500];
    for (const status of statuses) {
      const { client, reported } = launchClient(() => reply(status));
      const caught = await client.request(BOARD).catch((e) => e);
      expect(caught).toBeInstanceOf(ApiError);
      expect(reported).toEqual([]);
    }
    const offline = launchClient(() => Promise.reject(new Error('offline')));
    const caught = await offline.client.stream(CHAT_TURN).catch((e) => e);
    expect((caught as ApiError).kind).toBe('network');
    expect(offline.reported).toEqual([]);
  });

  it('an answer passes through untouched and reports nothing', async () => {
    const { client, reported } = launchClient(() => jsonReply(200, { items: [1, 2] }));
    const parsed = await client.request(BOARD, {
      schema: z.object({ items: z.array(z.number()) }),
    });
    expect(parsed).toEqual({ items: [1, 2] });
    const opened = await client.stream(CHAT_TURN);
    expect(opened.status).toBe(200);
    expect(client.server).toBe(SERVER);
    expect(reported).toEqual([]);
  });

  it("without a channel of its own it reports into the session's, the one useSessionRefresh hears", async () => {
    const client = createLaunchClient({
      server: SERVER,
      clientAuth: AUTH,
      workspaceIds: { get: () => null },
      transport: fakeTransport(() => reply(403, NOT_ALLOWED)),
    });
    let heard = 0;
    const stop = sessionRefusals.listen(() => {
      heard += 1;
    });
    try {
      await client.request(APPROVE).catch(() => undefined);
    } finally {
      stop();
    }
    expect(heard).toBe(1);
  });
});
