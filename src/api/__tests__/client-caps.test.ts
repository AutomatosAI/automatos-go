// The one client reads every body under a cap (docs/app-standard.md rule 13.2; config.ts): a JSON
// body under JSON_MAX_BYTES, an error body under ERROR_BODY_MAX_BYTES. One over its cap is read no
// further: a JSON body is an invalid_response, and an error body gives no detail while its status
// still names the kind, so a signed-out answer still signs the person out.

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { BodyTooLargeError } from '../body';
import { createApiClient, type ApiClientOptions } from '../client';
import { ERROR_BODY_MAX_BYTES, JSON_MAX_BYTES } from '../config';
import { ApiError } from '../errors';
import type { Route } from '../routes';
import {
  SERVER,
  bytesReply,
  fakeTransport,
  jsonReply,
  reply,
  type FakeTransport,
} from './fake-transport';

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

describe('every body is read under a cap', () => {
  /** A transport that records the cap each whole read was given, and answers with `body`. */
  function recording(status: number, body: string) {
    const caps: number[] = [];
    const transport = fakeTransport(() => {
      const answer = reply(status, body);
      return {
        ...answer,
        bytes: (maxBytes: number) => {
          caps.push(maxBytes);
          return answer.bytes(maxBytes);
        },
      };
    });
    return { transport, caps };
  }

  it('reads a JSON body under the JSON cap, and an error body under the smaller one', async () => {
    const ok = recording(200, JSON.stringify({ id: WORKSPACE_ID, role: 'owner' }));
    await clientWith(ok.transport).request(WORKSPACE, { schema: WorkspaceSchema });
    expect(ok.caps).toEqual([JSON_MAX_BYTES]);

    const failed = recording(500, JSON.stringify({ detail: 'nope' }));
    await failureOf(clientWith(failed.transport).request(WORKSPACE));
    expect(failed.caps).toEqual([ERROR_BODY_MAX_BYTES]);
    expect(ERROR_BODY_MAX_BYTES).toBeLessThan(JSON_MAX_BYTES);
  });

  it('a JSON body over its cap is an invalid_response, read no further', async () => {
    const transport = fakeTransport(() => ({
      status: 200,
      bytes: (maxBytes: number) => Promise.reject(new BodyTooLargeError(maxBytes)),
      chunks: async function* () {},
      header: () => null,
    }));
    const error = await failureOf(
      clientWith(transport).request(WORKSPACE, { schema: WorkspaceSchema }),
    );
    expect(error.kind).toBe('invalid_response');
    expect(error.cause).toBeInstanceOf(BodyTooLargeError);
  });

  it('a Content-Length over the cap is refused before a byte is read', async () => {
    const body = new TextEncoder().encode(JSON.stringify({ id: WORKSPACE_ID, role: 'owner' }));
    const transport = fakeTransport(() =>
      bytesReply(200, body, { 'content-length': String(JSON_MAX_BYTES + 1) }),
    );
    const error = await failureOf(
      clientWith(transport).request(WORKSPACE, { schema: WorkspaceSchema }),
    );
    expect(error.kind).toBe('invalid_response');
  });

  it('a call with no schema still reads under the cap, and an oversized answer fails it', async () => {
    const ok = recording(200, '{"cancelled":true}');
    await expect(clientWith(ok.transport).request(WORKSPACE)).resolves.toBeUndefined();
    expect(ok.caps).toEqual([JSON_MAX_BYTES]);
  });

  it.each([
    [401, 'auth'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [500, 'server'],
  ] as const)(
    'an error body over its cap gives no detail, and %i is still %s',
    async (status, kind) => {
      const onAuthExpired = vi.fn();
      const transport = fakeTransport(() => ({
        status,
        bytes: (maxBytes: number) => Promise.reject(new BodyTooLargeError(maxBytes)),
        chunks: async function* () {},
        header: () => null,
      }));
      const error = await failureOf(clientWith(transport, { onAuthExpired }).request(WORKSPACE));
      expect(error).toMatchObject({ kind, status });
      expect(error.code).toBeUndefined();
      expect(error.serverMessage).toBeUndefined();
      expect(onAuthExpired).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    },
  );

  it('an error body just under its cap is read whole and keeps its detail', async () => {
    const message = 'x'.repeat(200);
    const padding = 'y'.repeat(ERROR_BODY_MAX_BYTES - 1024);
    const detail = { code: 'pending_invitation', message, padding };
    const transport = fakeTransport(() => jsonReply(409, { detail }));
    const error = await failureOf(clientWith(transport).request(WORKSPACE));
    expect(error).toMatchObject({ kind: 'conflict', code: 'pending_invitation' });
  });

  it('a real error body one byte over its cap is cut off by the read itself', async () => {
    const body = JSON.stringify({ detail: { code: 'x', pad: 'z'.repeat(ERROR_BODY_MAX_BYTES) } });
    const transport = fakeTransport(() => reply(409, body));
    const error = await failureOf(clientWith(transport).request(WORKSPACE));
    expect(error).toMatchObject({ kind: 'conflict', status: 409 });
    expect(error.code).toBeUndefined();
  });
});
