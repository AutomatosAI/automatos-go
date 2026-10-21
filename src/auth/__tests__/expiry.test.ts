import { describe, expect, it, vi } from 'vitest';

import { SERVER, fakeTransport, jsonReply, reply } from '../../api/__tests__/fake-transport';
import { createApiClient } from '../../api/client';
import { routes } from '../../api/routes';
import { bindProvider } from '../providers/binding';
import { createClerkProvider } from '../providers/clerk';
import { createExpirySignal } from '../providers/expiry';

const WORKSPACE_ID = '7f1c2a54-0000-4000-8000-000000000001';

describe('the expired-listener contract', () => {
  it('tells every listener, and unsubscribing stops only that one', () => {
    const expiry = createExpirySignal();
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = expiry.subscribe(first);
    expiry.subscribe(second);
    expiry.notify();
    stopFirst();
    stopFirst();
    expiry.notify();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('one listener failing never stops the others hearing it', () => {
    const expiry = createExpirySignal();
    const after = vi.fn();
    expiry.subscribe(() => {
      throw new Error('listener bug');
    });
    expiry.subscribe(after);
    expect(() => expiry.notify()).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('a listener that unsubscribes while being told does not skip the next one', () => {
    const expiry = createExpirySignal();
    const next = vi.fn();
    const stop = expiry.subscribe(() => stop());
    expiry.subscribe(next);
    expiry.notify();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

function clerkBinding(token: string | null = 'mobile.session.jwt') {
  const getToken = vi.fn(async () => token);
  const binding = bindProvider((expiry) =>
    createClerkProvider(
      { getToken, signOut: async () => undefined },
      { expiry, secureKeys: { wipe: async () => undefined } },
    ),
  );
  return { ...binding, getToken };
}

describe('the provider bound into the API client', () => {
  it("the client's bearer is the provider's token", async () => {
    const { clientAuth, getToken } = clerkBinding();
    const transport = fakeTransport(() => jsonReply(200, {}));
    const client = createApiClient({
      server: SERVER,
      getWorkspaceId: () => WORKSPACE_ID,
      transport,
      ...clientAuth,
    });
    await client.request(routes.workspaceCurrent);
    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer mobile.session.jwt');
    expect(getToken).toHaveBeenCalledWith({ template: 'mobile' });
  });

  it("a 401 from the client reaches the provider's onExpired listeners (back to sign-in)", async () => {
    const { provider, clientAuth } = clerkBinding();
    const listener = vi.fn();
    provider.onExpired(listener);
    const client = createApiClient({
      server: SERVER,
      getWorkspaceId: () => null,
      transport: fakeTransport(() => reply(401)),
      ...clientAuth,
    });
    await expect(client.request(routes.workspaceCurrent)).rejects.toMatchObject({ kind: 'auth' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a 403 is not an expiry', async () => {
    const { provider, clientAuth } = clerkBinding();
    const listener = vi.fn();
    provider.onExpired(listener);
    const client = createApiClient({
      server: SERVER,
      getWorkspaceId: () => null,
      transport: fakeTransport(() => reply(403)),
      ...clientAuth,
    });
    await client.request(routes.workspaceCurrent).catch(() => undefined);
    expect(listener).not.toHaveBeenCalled();
  });

  it('a listener that unsubscribed hears nothing', () => {
    const { provider, clientAuth } = clerkBinding();
    const listener = vi.fn();
    const stop = provider.onExpired(listener);
    stop();
    clientAuth.onAuthExpired();
    expect(listener).not.toHaveBeenCalled();
  });
});
