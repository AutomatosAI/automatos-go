import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApiClient, type ApiClientOptions } from '../client';
import { ApiError, isAbortError, userMessage } from '../errors';
import type { Route } from '../routes';
import {
  SERVER,
  fakeTransport,
  hangUntilAborted,
  jsonReply,
  reply,
  type FakeTransport,
} from './fake-transport';

const GET_CHAT: Route = { method: 'GET', path: '/api/chat/{chatId}' };
const POST_ATTACHMENT: Route = { method: 'POST', path: '/api/attachments' };
const WORKSPACE: Route = { method: 'GET', path: '/api/workspaces/current' };
const WorkspaceSchema = z.object({ id: z.string(), role: z.string() });
const WORKSPACE_ID = '7f1c2a54-0000-4000-8000-000000000001';

function clientWith(transport: FakeTransport, overrides: Partial<ApiClientOptions> = {}) {
  return createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => WORKSPACE_ID,
    transport,
    ...overrides,
  });
}

async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ApiError)) throw new Error(`expected an ApiError, got ${String(error)}`);
  return error;
}

describe('headers', () => {
  it('sends the bearer and the workspace header', async () => {
    const transport = fakeTransport(() => reply(204));
    await clientWith(transport).request(WORKSPACE);
    expect(transport.calls[0]?.headers).toEqual({
      Authorization: 'Bearer jwt.token.value',
      'X-Workspace-ID': WORKSPACE_ID,
    });
  });

  it('leaves the workspace header out until the workspace is known', async () => {
    const transport = fakeTransport(() => reply(204));
    await clientWith(transport, { getWorkspaceId: () => null }).request(WORKSPACE);
    expect(transport.calls[0]?.headers).toEqual({ Authorization: 'Bearer jwt.token.value' });
  });

  it('sends neither header when signed out', async () => {
    const transport = fakeTransport(() => reply(204));
    await clientWith(transport, { getToken: async () => null }).request(WORKSPACE);
    expect(transport.calls[0]?.headers).toEqual({});
  });

  it('reads the workspace id at call time, so a bootstrap applies to the next call', async () => {
    let workspaceId: string | null = null;
    const transport = fakeTransport(() => reply(204));
    const client = clientWith(transport, { getWorkspaceId: () => workspaceId });
    await client.request(WORKSPACE);
    workspaceId = WORKSPACE_ID;
    await client.request(WORKSPACE);
    expect(transport.calls.map((call) => call.headers['X-Workspace-ID'])).toEqual([
      undefined,
      WORKSPACE_ID,
    ]);
  });

  it('refuses a token that could forge a header', async () => {
    const transport = fakeTransport(() => reply(204));
    const client = clientWith(transport, { getToken: async () => 'abc\r\nX-Evil: 1' });
    expect((await failureOf(client.request(WORKSPACE))).kind).toBe('auth');
    expect(transport.calls).toHaveLength(0);
  });

  it('maps a failing token getter to a network error and keeps an ApiError as it is', async () => {
    const transport = fakeTransport(() => reply(204));
    const offline = clientWith(transport, { getToken: () => Promise.reject(new Error('offline')) });
    expect((await failureOf(offline.request(WORKSPACE))).kind).toBe('network');
    const typed = clientWith(transport, { getToken: () => Promise.reject(new ApiError('auth')) });
    expect((await failureOf(typed.request(WORKSPACE))).kind).toBe('auth');
  });
});

describe('URLs and bodies', () => {
  it('fills path params URI-encoded and appends the query', async () => {
    const transport = fakeTransport(() => reply(204));
    await clientWith(transport).request(GET_CHAT, {
      params: { chatId: 'a b/c?d' },
      query: { limit: 20, status: 'active', skipped: undefined },
    });
    expect(transport.calls[0]?.url).toBe(
      'https://api.example.test/api/chat/a%20b%2Fc%3Fd?limit=20&status=active',
    );
    expect(transport.calls[0]?.method).toBe('GET');
  });

  it('throws before sending when a path param is missing or a dot segment', async () => {
    const transport = fakeTransport(() => reply(204));
    const client = clientWith(transport);
    await expect(client.request(GET_CHAT)).rejects.toThrow(TypeError);
    await expect(client.request(GET_CHAT, { params: { chatId: '..' } })).rejects.toThrow(TypeError);
    expect(transport.calls).toHaveLength(0);
  });

  it('JSON-encodes a plain body with its content type', async () => {
    const transport = fakeTransport(() => reply(204));
    await clientWith(transport).request(
      { method: 'POST', path: '/api/chat' },
      { body: { message: 'hi' } },
    );
    expect(transport.calls[0]?.body).toBe('{"message":"hi"}');
    expect(transport.calls[0]?.headers['Content-Type']).toBe('application/json');
  });

  it('passes FormData through untouched, with no content type of its own', async () => {
    const form = new FormData();
    form.append('file', new Blob(['hello'], { type: 'text/plain' }), 'note.txt');
    const transport = fakeTransport(() => jsonReply(200, { attachment_id: 'att_1' }));
    const result = await clientWith(transport).request(POST_ATTACHMENT, {
      body: form,
      schema: z.object({ attachment_id: z.string() }),
    });
    expect(transport.calls[0]?.body).toBe(form);
    expect(transport.calls[0]?.headers['Content-Type']).toBeUndefined();
    expect(result).toEqual({ attachment_id: 'att_1' });
  });

  it('sends no body and no content type on a GET', async () => {
    const transport = fakeTransport(() => reply(204));
    await clientWith(transport).request(WORKSPACE);
    expect(transport.calls[0]).not.toHaveProperty('body');
  });
});

describe('responses', () => {
  it('parses with the schema and drops unknown fields', async () => {
    const transport = fakeTransport(() =>
      jsonReply(200, { id: WORKSPACE_ID, role: 'owner', plan_limits: { seats: 3 } }),
    );
    const workspace = await clientWith(transport).request(WORKSPACE, { schema: WorkspaceSchema });
    expect(workspace).toEqual({ id: WORKSPACE_ID, role: 'owner' });
  });

  it('resolves undefined without a schema, so no unparsed body leaves the client', async () => {
    const transport = fakeTransport(() => jsonReply(200, { cancelled: true }));
    await expect(clientWith(transport).request(WORKSPACE)).resolves.toBeUndefined();
  });

  it('maps a body that is not JSON to invalid_response', async () => {
    const transport = fakeTransport(() => reply(200, '<html>proxy error</html>'));
    const error = await failureOf(
      clientWith(transport).request(WORKSPACE, { schema: WorkspaceSchema }),
    );
    expect(error.kind).toBe('invalid_response');
  });

  it('maps a zod failure to invalid_response with paths, not values, in the cause', async () => {
    const transport = fakeTransport(() => jsonReply(200, { id: 42, role: 'private words' }));
    const error = await failureOf(
      clientWith(transport).request(WORKSPACE, { schema: WorkspaceSchema }),
    );
    expect(error.kind).toBe('invalid_response');
    expect(String((error.cause as Error).message)).toBe('id: invalid_type');
    expect(String((error.cause as Error).message)).not.toContain('private words');
  });
});

describe('status → kind', () => {
  it.each([
    [401, 'auth'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [500, 'server'],
    [502, 'server'],
    [503, 'server'],
    [400, 'server'],
    [422, 'server'],
    [429, 'server'],
  ] as const)('%i → %s', async (status, kind) => {
    const transport = fakeTransport(() => jsonReply(status, { detail: 'nope' }));
    const error = await failureOf(
      clientWith(transport).request(WORKSPACE, { schema: WorkspaceSchema }),
    );
    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
  });

  it('keeps the 409 pending_invitation code and message as the server sent them', async () => {
    const detail = {
      code: 'pending_invitation',
      redirect: '/accept-invitation?token=tok_1',
      token: 'tok_1',
      message: 'Accept your pending invitation before continuing.',
    };
    const transport = fakeTransport(() => jsonReply(409, { detail }));
    const error = await failureOf(
      clientWith(transport).request(WORKSPACE, { schema: WorkspaceSchema }),
    );
    expect(error).toMatchObject({
      kind: 'conflict',
      status: 409,
      code: 'pending_invitation',
      serverMessage: 'Accept your pending invitation before continuing.',
    });
    expect(userMessage(error)).toBe('Accept your pending invitation before continuing.');
  });

  it('still maps the status when the error body cannot be read', async () => {
    const transport = fakeTransport(() => ({
      status: 503,
      text: () => Promise.reject(new Error('socket closed')),
      chunks: async function* () {},
    }));
    expect((await failureOf(clientWith(transport).request(WORKSPACE))).kind).toBe('server');
  });
});

describe('onAuthExpired', () => {
  it('is called once for concurrent 401s on the same token', async () => {
    const onAuthExpired = vi.fn();
    const transport = fakeTransport(() => jsonReply(401, { detail: 'Invalid token' }));
    const client = clientWith(transport, { onAuthExpired });
    const results = await Promise.allSettled([
      client.request(WORKSPACE),
      client.request(WORKSPACE),
      client.request(WORKSPACE),
    ]);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
  });

  it('is called again when a new token (signed in again) expires', async () => {
    const onAuthExpired = vi.fn();
    let token = 'first.token';
    const transport = fakeTransport(() => reply(401));
    const client = clientWith(transport, { onAuthExpired, getToken: async () => token });
    await client.request(WORKSPACE).catch(() => undefined);
    token = 'second.token';
    await client.request(WORKSPACE).catch(() => undefined);
    expect(onAuthExpired).toHaveBeenCalledTimes(2);
  });

  it('is handed the 401 as an ApiError, its detail code kept', async () => {
    const onAuthExpired = vi.fn();
    const transport = fakeTransport(() => jsonReply(401, { detail: { code: 'device_revoked' } }));
    const failure = await failureOf(clientWith(transport, { onAuthExpired }).request(WORKSPACE));
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
    const handed: unknown = onAuthExpired.mock.calls[0]?.[0];
    expect(handed).toBe(failure);
    expect(failure).toMatchObject({ kind: 'auth', status: 401, code: 'device_revoked' });
  });

  it('is not called for a 403', async () => {
    const onAuthExpired = vi.fn();
    const transport = fakeTransport(() => reply(403));
    await clientWith(transport, { onAuthExpired })
      .request(WORKSPACE)
      .catch(() => undefined);
    expect(onAuthExpired).not.toHaveBeenCalled();
  });
});

describe('network, timeout and abort', () => {
  it('maps a transport failure to network', async () => {
    const transport = fakeTransport(() => Promise.reject(new TypeError('Network request failed')));
    const error = await failureOf(clientWith(transport).request(WORKSPACE));
    expect(error.kind).toBe('network');
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it('maps a timeout to network and aborts the request', async () => {
    const transport = fakeTransport(hangUntilAborted);
    const error = await failureOf(clientWith(transport, { timeoutMs: 5 }).request(WORKSPACE));
    expect(error.kind).toBe('network');
    expect(String((error.cause as Error).message)).toContain('no answer within 5 ms');
    expect(transport.calls[0]?.signal.aborted).toBe(true);
  });

  it("rejects with an AbortError, not an ApiError, on the caller's abort", async () => {
    const transport = fakeTransport(hangUntilAborted);
    const controller = new AbortController();
    const pending = clientWith(transport).request(WORKSPACE, { signal: controller.signal });
    controller.abort();
    const error = await pending.catch((caught: unknown) => caught);
    expect(isAbortError(error)).toBe(true);
    expect(error).not.toBeInstanceOf(ApiError);
  });

  it('aborts at once when the signal is already aborted', async () => {
    const transport = fakeTransport(hangUntilAborted);
    const controller = new AbortController();
    controller.abort();
    const error = await clientWith(transport)
      .request(WORKSPACE, { signal: controller.signal })
      .catch((caught: unknown) => caught);
    expect(isAbortError(error)).toBe(true);
  });
});

describe('stream', () => {
  it('opens through transport.stream and can still read the body whole', async () => {
    const transport = fakeTransport(() => reply(200, 'whole body'));
    const response = await clientWith(transport).stream({ method: 'GET', path: '/api/x' });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('whole body');
  });
});

describe('authHeaders', () => {
  it('gives the bearer and the workspace header from the same getter the client uses', async () => {
    const getToken = vi.fn(async () => 'jwt.token.value');
    const client = clientWith(
      fakeTransport(() => reply(204)),
      { getToken },
    );
    expect(await client.authHeaders()).toEqual({
      Authorization: 'Bearer jwt.token.value',
      'X-Workspace-ID': WORKSPACE_ID,
    });
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it('gives none for a signed-out provider', async () => {
    const client = clientWith(
      fakeTransport(() => reply(204)),
      { getToken: async () => null },
    );
    expect(await client.authHeaders()).toEqual({});
  });
});
