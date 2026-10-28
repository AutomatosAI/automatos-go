// One server's token or workspace id is never sent to another (US-006d), over the shell's own
// pieces: each server's launch client (launch-client.ts) with that server's workspace-id holder
// (src/session/workspace-ids.ts) and the gate's bootstrap (session-cache.ts launchBootstrap). Two
// servers, a fake transport: the hosted server with a Clerk JWT, then a paired own server.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createQueryClient } from '../../api/query-client';
import { routes } from '../../api/routes';
import { ownServerFrom, type Server } from '../../api/server';
import type { TransportRequest } from '../../api/transport-types';
import type { ClientAuth } from '../../auth/providers/binding';
import { RECORD } from '../../connect/__tests__/paired-record';
import { createWorkspaceIdRegistry } from '../../session/workspace-ids';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import { createLaunchClient } from '../launch-client';
import { launchBootstrap } from '../session-cache';

const HOSTED: Server = SERVER;
const OWN: Server = ownServerFrom({ origin: RECORD.origin, webUrl: RECORD.webUrl });
const HOSTED_JWT = 'clerk.jwt.value';
const HOSTED_WORKSPACE = '11111111-1111-4111-8111-111111111111';
/** The bootstrap's answer on the own server: the device's own workspace (not the /pair answer's). */
const OWN_WORKSPACE = '22222222-2222-4222-8222-222222222222';

const workspaceOf = (id: string) => ({ id, name: 'Workspace', role: 'owner' });

const authWith = (token: string): ClientAuth => ({
  getToken: async () => token,
  onAuthExpired: () => undefined,
});

/** Answers GET /api/workspaces/current with each server's own workspace. */
function serversTransport() {
  return fakeTransport((request) =>
    jsonReply(
      200,
      workspaceOf(request.url.startsWith(OWN.apiUrl) ? OWN_WORKSPACE : HOSTED_WORKSPACE),
    ),
  );
}

const headersTo = (calls: readonly TransportRequest[], server: Server) =>
  calls.filter((call) => call.url.startsWith(`${server.apiUrl}/`)).map((call) => call.headers);

describe('the launch client: one server, its own bearer and workspace id', () => {
  it('sends the hosted id once the bootstrap stored it, as the foundation does', async () => {
    const transport = serversTransport();
    const ids = createWorkspaceIdRegistry().forServer(HOSTED);
    const client = createLaunchClient({
      server: HOSTED,
      clientAuth: authWith(HOSTED_JWT),
      workspaceIds: ids,
      transport,
    });
    await launchBootstrap(client, createQueryClient(), { store: ids });
    await launchBootstrap(client, createQueryClient(), { store: ids });
    expect(headersTo(transport.calls, HOSTED)).toEqual([
      { Authorization: `Bearer ${HOSTED_JWT}` },
      { Authorization: `Bearer ${HOSTED_JWT}`, 'X-Workspace-ID': HOSTED_WORKSPACE },
    ]);
  });
});

describe('two servers: nothing of one is ever sent to the other', () => {
  async function hostedThenOwn() {
    const transport = serversTransport();
    const registry = createWorkspaceIdRegistry();
    const hostedIds = registry.forServer(HOSTED);
    const hosted = createLaunchClient({
      server: HOSTED,
      clientAuth: authWith(HOSTED_JWT),
      workspaceIds: hostedIds,
      transport,
    });
    await launchBootstrap(hosted, createQueryClient(), { store: hostedIds });
    // the switch (src/connect/switch.ts) forgets the stored id; the shell asks for the next holder
    registry.clear();
    const ownIds = registry.forServer(OWN);
    const own = createLaunchClient({
      server: OWN,
      clientAuth: authWith(RECORD.token),
      workspaceIds: ownIds,
      transport,
    });
    return { transport, hosted, hostedIds, own, ownIds };
  }

  it("the own server's first calls send its token and no X-Workspace-ID, never the hosted id", async () => {
    const { transport, own, ownIds } = await hostedThenOwn();
    await launchBootstrap(own, createQueryClient(), { store: ownIds });
    expect(headersTo(transport.calls, OWN)[0]).toEqual({ Authorization: `Bearer ${RECORD.token}` });
  });

  it("then the own server's bootstrap id becomes its header", async () => {
    const { transport, own, ownIds } = await hostedThenOwn();
    await launchBootstrap(own, createQueryClient(), { store: ownIds });
    await own.request(routes.workspaceCurrent);
    expect(headersTo(transport.calls, OWN)[1]).toEqual({
      Authorization: `Bearer ${RECORD.token}`,
      'X-Workspace-ID': OWN_WORKSPACE,
    });
  });

  it('the device token never reaches the hosted server, nor the hosted JWT or id the own one', async () => {
    const { transport, own, ownIds } = await hostedThenOwn();
    await launchBootstrap(own, createQueryClient(), { store: ownIds });
    const hostedSent = JSON.stringify(headersTo(transport.calls, HOSTED));
    const ownSent = JSON.stringify(headersTo(transport.calls, OWN));
    expect(hostedSent).not.toContain(RECORD.token);
    expect(ownSent).not.toContain(HOSTED_JWT);
    expect(ownSent).not.toContain(HOSTED_WORKSPACE);
  });

  it("a hosted bootstrap that lands after the switch writes only the hosted server's old holder", async () => {
    const { transport, hosted, hostedIds, own, ownIds } = await hostedThenOwn();
    await launchBootstrap(hosted, createQueryClient(), { store: hostedIds });
    await launchBootstrap(own, createQueryClient(), { store: ownIds });
    expect(headersTo(transport.calls, OWN)[0]).toEqual({ Authorization: `Bearer ${RECORD.token}` });
    expect(ownIds.get()).toBe(OWN_WORKSPACE);
  });
});

describe('the launch client says the language "I speak" chose (PRD-268 §6.11)', () => {
  it('as Accept-Language on every call, read at call time; Automatic sends none', async () => {
    let choice = 'pt-BR';
    const transport = serversTransport();
    const ids = createWorkspaceIdRegistry().forServer(HOSTED);
    const client = createLaunchClient({
      server: HOSTED,
      clientAuth: authWith(HOSTED_JWT),
      workspaceIds: ids,
      transport,
      getLanguage: () => choice,
    });
    await client.request(routes.workspaceCurrent);
    choice = 'auto';
    await client.request(routes.workspaceCurrent);
    expect(headersTo(transport.calls, HOSTED)).toEqual([
      { Authorization: `Bearer ${HOSTED_JWT}`, 'Accept-Language': 'pt-BR' },
      { Authorization: `Bearer ${HOSTED_JWT}` },
    ]);
  });

  it("is wired in the shell to the voice setting's saved choice, read only", () => {
    const source = readFileSync(path.resolve(__dirname, '../use-launch.ts'), 'utf8');
    expect(source).toContain('const spokenChoice = () => speakChoiceOf(voiceSetting.get());');
    expect(source).toContain('getLanguage: spokenChoice');
    expect(source).not.toMatch(/voiceSetting\.set\(/);
  });
});
