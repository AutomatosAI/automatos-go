// The one client never follows a redirect (docs/app-standard.md rule 13.2c): the transport hands a
// 3xx back as it is, and the client turns it into an error of its status's kind that keeps where
// it pointed. Nothing is sent to that address: not the request again, not the bearer.

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApiClient, type ApiClientOptions } from '../client';
import { REDIRECT_TARGET_MAX_CHARS } from '../config';
import { ApiError, errorFromResponse, isRedirectStatus } from '../errors';
import type { Route } from '../routes';
import { SERVER, fakeTransport, reply, type FakeTransport } from './fake-transport';

const WORKSPACE: Route = { method: 'GET', path: '/api/workspaces/current' };
const WorkspaceSchema = z.object({ id: z.string() });
const ELSEWHERE = 'https://elsewhere.example.test/api/workspaces/current';

function clientWith(transport: FakeTransport, overrides: Partial<ApiClientOptions> = {}) {
  return createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => null,
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

describe('a redirect is refused, never followed', () => {
  it.each([301, 302, 303, 307, 308])(
    '%i is an error that keeps where it pointed',
    async (status) => {
      const transport = fakeTransport(() => reply(status, '', { Location: ELSEWHERE }));
      const error = await failureOf(
        clientWith(transport).request(WORKSPACE, { schema: WorkspaceSchema }),
      );
      expect(error).toMatchObject({ kind: 'server', status, redirectTo: ELSEWHERE });
    },
  );

  it('sends one request only: nothing goes to the address the redirect named', async () => {
    const transport = fakeTransport(() => reply(302, '', { Location: ELSEWHERE }));
    await failureOf(clientWith(transport).request(WORKSPACE));
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.url.startsWith(SERVER.apiUrl)).toBe(true);
  });

  it('is refused on a stream and on a binary read too', async () => {
    const transport = fakeTransport(() => reply(307, '', { Location: ELSEWHERE }));
    const client = clientWith(transport);
    expect((await failureOf(client.stream(WORKSPACE))).redirectTo).toBe(ELSEWHERE);
    expect((await failureOf(client.binary(WORKSPACE))).redirectTo).toBe(ELSEWHERE);
    expect(transport.calls).toHaveLength(2);
  });

  it("does not sign the person out, and never puts the address in the error's own words", async () => {
    const onAuthExpired = vi.fn();
    const transport = fakeTransport(() => reply(302, '', { Location: ELSEWHERE }));
    const error = await failureOf(clientWith(transport, { onAuthExpired }).request(WORKSPACE));
    expect(onAuthExpired).not.toHaveBeenCalled();
    expect(error.message).toBe('ApiError server 302');
    expect(error.message).not.toContain('elsewhere');
  });

  it('a redirect that names no address is still refused, with nothing kept', async () => {
    const transport = fakeTransport(() => reply(302));
    const error = await failureOf(clientWith(transport).request(WORKSPACE));
    expect(error).toMatchObject({ kind: 'server', status: 302 });
    expect(error.redirectTo).toBeUndefined();
  });
});

describe('errorFromResponse', () => {
  it('keeps a Location only for a redirect', () => {
    expect(errorFromResponse(302, '', ELSEWHERE).redirectTo).toBe(ELSEWHERE);
    expect(errorFromResponse(200, '', ELSEWHERE).redirectTo).toBeUndefined();
    expect(errorFromResponse(404, '', ELSEWHERE).redirectTo).toBeUndefined();
    expect(errorFromResponse(500, '', ELSEWHERE).redirectTo).toBeUndefined();
  });

  it('drops a Location longer than any real address, and an empty or missing one', () => {
    const long = `https://x.example.test/${'a'.repeat(REDIRECT_TARGET_MAX_CHARS)}`;
    expect(errorFromResponse(302, '', long).redirectTo).toBeUndefined();
    expect(errorFromResponse(302, '', '').redirectTo).toBeUndefined();
    expect(errorFromResponse(302, '', null).redirectTo).toBeUndefined();
    expect(errorFromResponse(302, '').redirectTo).toBeUndefined();
  });

  it('knows a redirect by its status', () => {
    expect([299, 300, 301, 399, 400].map(isRedirectStatus)).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });
});
