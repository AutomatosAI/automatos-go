import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApiClient } from '../client';
import { ApiError, userMessage } from '../errors';
import { routes } from '../routes';
import { WORKSPACE_COPY } from '../strings';
import {
  WORKSPACE_PAUSED_DETAIL,
  WorkspaceSchema,
  bootstrapWorkspace,
  createWorkspaceIdStore,
  isWorkspacePaused,
  workspaceErrorMessage,
  type WorkspaceIdStore,
} from '../workspace';
import { SERVER, fakeTransport, jsonReply, reply, type FakeTransport } from './fake-transport';

const WORKSPACE_ID = '7f1c2a54-0000-4000-8000-000000000001';
const OTHER_WORKSPACE_ID = '7f1c2a54-0000-4000-8000-000000000002';

/** GET /api/workspaces/current as orchestrator/api/workspaces.py:120-157 builds it today. */
const CURRENT = {
  id: WORKSPACE_ID,
  name: "Gerard's workspace",
  slug: 'gerards-workspace',
  plan: 'business',
  role: 'editor',
  plan_limits: { seats: 5 },
  exposure: {
    plan: 'business',
    display_name: 'Business',
    display_price_usd: 99,
    price_label: '$99/mo',
    families: { codegraph: true, nl2sql: true, team: true, voice: true },
    marketplace_depth: 3,
    nav: { analytics: true, team: true },
  },
  onboarding: { stage: 'done', trial: null },
  socials: { available: true, enabled: false },
  webhook_url: 'https://api.example.test/api/webhooks/ws/abcd',
  webhook_key: 'abcd1234abcd1234abcd1234abcd1234',
  settings: { integrations: { telegram_token: 'abcd...wxyz' } },
};

function clientWith(transport: FakeTransport, store: WorkspaceIdStore) {
  return createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: store.get,
    transport,
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

describe('WorkspaceSchema', () => {
  it('keeps what the app reads and drops the rest (keys, settings, prices)', () => {
    expect(WorkspaceSchema.parse(CURRENT)).toEqual({
      id: WORKSPACE_ID,
      name: "Gerard's workspace",
      slug: 'gerards-workspace',
      plan: 'business',
      role: 'editor',
      exposure: { plan: 'business', families: { voice: true } },
    });
  });

  it('reads ai_providers when the server sends them (PRD-266 US-017)', () => {
    const workspace = WorkspaceSchema.parse({
      ...CURRENT,
      ai_providers: [{ id: 'anthropic', name: 'Anthropic', region: 'us' }],
    });
    expect(workspace.ai_providers).toEqual([{ id: 'anthropic', name: 'Anthropic' }]);
  });

  it('reads a local install: no plan, no slug, unrestricted exposure', () => {
    const workspace = WorkspaceSchema.parse({
      ...CURRENT,
      plan: null,
      slug: null,
      role: 'owner',
      exposure: { plan: 'local', families: {}, marketplace_depth: 3 },
    });
    expect(workspace.plan).toBeNull();
    expect(workspace.exposure.families).toEqual({});
  });

  it('reads each role the server sends', () => {
    for (const role of ['owner', 'admin', 'editor', 'viewer'] as const) {
      expect(WorkspaceSchema.parse({ ...CURRENT, role }).role).toBe(role);
    }
  });

  it('reads a role it does not know as viewer (least privilege)', () => {
    expect(WorkspaceSchema.parse({ ...CURRENT, role: 'super_admin' }).role).toBe('viewer');
    const { role: _role, ...withoutRole } = CURRENT;
    expect(WorkspaceSchema.parse(withoutRole).role).toBe('viewer');
  });

  it('reads a server older than exposure as unrestricted', () => {
    const { exposure: _exposure, ...older } = CURRENT;
    expect(WorkspaceSchema.parse(older).exposure).toEqual({ families: {} });
  });

  it('refuses an id that is not a UUID (it becomes a header)', () => {
    expect(WorkspaceSchema.safeParse({ ...CURRENT, id: 'ws\r\nX-Evil: 1' }).success).toBe(false);
  });
});

describe('bootstrapWorkspace', () => {
  it('stores the returned id as the X-Workspace-ID of the next call', async () => {
    const store = createWorkspaceIdStore();
    const transport = fakeTransport((request) =>
      request.url.endsWith(routes.workspaceCurrent.path)
        ? jsonReply(200, CURRENT)
        : jsonReply(200, { total: 0 }),
    );
    const client = clientWith(transport, store);

    const workspace = await bootstrapWorkspace(client, { store });
    await client.request(routes.needsYou, { schema: z.object({ total: z.number() }) });

    expect(workspace.id).toBe(WORKSPACE_ID);
    expect(store.get()).toBe(WORKSPACE_ID);
    expect(transport.calls[0]?.headers).not.toHaveProperty('X-Workspace-ID');
    expect(transport.calls[1]?.headers['X-Workspace-ID']).toBe(WORKSPACE_ID);
  });

  it('sends the id it holds and keeps the one the server resolved instead', async () => {
    const store = createWorkspaceIdStore(OTHER_WORKSPACE_ID);
    const transport = fakeTransport(() => jsonReply(200, CURRENT));
    const onWorkspaceChange = vi.fn();

    await bootstrapWorkspace(clientWith(transport, store), { store, onWorkspaceChange });

    expect(transport.calls[0]?.headers['X-Workspace-ID']).toBe(OTHER_WORKSPACE_ID);
    expect(onWorkspaceChange).toHaveBeenCalledWith(OTHER_WORKSPACE_ID, WORKSPACE_ID);
    expect(store.get()).toBe(WORKSPACE_ID);
  });

  it('awaits the change hook before the new id is stored', async () => {
    const store = createWorkspaceIdStore(OTHER_WORKSPACE_ID);
    const seen: (string | null)[] = [];
    const onWorkspaceChange = async () => {
      await Promise.resolve();
      seen.push(store.get());
    };
    await bootstrapWorkspace(
      clientWith(
        fakeTransport(() => jsonReply(200, CURRENT)),
        store,
      ),
      {
        store,
        onWorkspaceChange,
      },
    );
    expect(seen).toEqual([OTHER_WORKSPACE_ID]);
  });

  it('does not call the change hook on a first launch or the same workspace', async () => {
    const onWorkspaceChange = vi.fn();
    for (const initial of [null, WORKSPACE_ID]) {
      const store = createWorkspaceIdStore(initial);
      const transport = fakeTransport(() => jsonReply(200, CURRENT));
      await bootstrapWorkspace(clientWith(transport, store), { store, onWorkspaceChange });
    }
    expect(onWorkspaceChange).not.toHaveBeenCalled();
  });

  it('leaves the stored id alone when the call fails', async () => {
    const store = createWorkspaceIdStore(OTHER_WORKSPACE_ID);
    const transport = fakeTransport(() => reply(503));
    const error = await failureOf(bootstrapWorkspace(clientWith(transport, store), { store }));
    expect(error.kind).toBe('server');
    expect(store.get()).toBe(OTHER_WORKSPACE_ID);
  });

  it('passes the pending-invitation 409 through with the server words', async () => {
    const store = createWorkspaceIdStore();
    const transport = fakeTransport(() =>
      jsonReply(409, {
        detail: {
          code: 'pending_invitation',
          message: 'Accept your pending invitation before continuing.',
        },
      }),
    );
    const error = await failureOf(bootstrapWorkspace(clientWith(transport, store), { store }));
    expect(error.code).toBe('pending_invitation');
    expect(workspaceErrorMessage(error)).toBe('Accept your pending invitation before continuing.');
  });

  it('clears on sign-out', () => {
    const store = createWorkspaceIdStore(WORKSPACE_ID);
    store.clear();
    expect(store.get()).toBeNull();
  });
});

describe('a paused workspace', () => {
  it('is the 403 _assert_workspace_usable sends, shown with the D8 copy', async () => {
    const store = createWorkspaceIdStore();
    const transport = fakeTransport(() => jsonReply(403, { detail: WORKSPACE_PAUSED_DETAIL }));
    const error = await failureOf(bootstrapWorkspace(clientWith(transport, store), { store }));
    expect(isWorkspacePaused(error)).toBe(true);
    expect(workspaceErrorMessage(error)).toBe(WORKSPACE_COPY.paused);
    expect(WORKSPACE_COPY.paused).toBe('Your workspace is paused; ask your workspace owner');
  });

  it('is not any other 403, which keeps the forbidden copy', () => {
    const forbidden = new ApiError('forbidden', { status: 403, serverMessage: 'Not allowed' });
    expect(isWorkspacePaused(forbidden)).toBe(false);
    expect(workspaceErrorMessage(forbidden)).toBe(userMessage(forbidden));
    expect(isWorkspacePaused(new Error(WORKSPACE_PAUSED_DETAIL))).toBe(false);
  });
});
