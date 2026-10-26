import { describe, expect, it, vi } from 'vitest';

import { ApiError, APP_ERROR_CODES, userMessage } from '../../api/errors';
import { APP_ERROR_COPY } from '../../api/strings';
import {
  CLERK_CLIENT_ITEM,
  PUSH_RECORD_ITEM,
  STORAGE_KEY_ITEM,
} from '../../storage/secure-registry';
import { MOBILE_TOKEN_TEMPLATE } from '../config';
import { createClerkProvider, type ClerkSessionPort } from '../providers/clerk';
import { createExpirySignal } from '../providers/expiry';

/** The shape @clerk/shared's ClerkAPIResponseError carries: the FAPI status and its errors. */
function clerkApiError(status: number, longMessage: string) {
  return Object.assign(new Error(longMessage), {
    clerkError: true,
    status,
    errors: [{ code: 'resource_not_found', message: 'not found', longMessage }],
  });
}

/** ClerkRuntimeError when Clerk cannot be reached: a code, no status. */
function clerkOffline() {
  return Object.assign(new Error('Network request failed while offline'), {
    clerkRuntimeError: true,
    code: 'network_error',
  });
}

function providerWith(port: Partial<ClerkSessionPort> = {}) {
  const getToken = vi.fn<ClerkSessionPort['getToken']>(async () => 'mobile.session.jwt');
  const signOut = vi.fn<ClerkSessionPort['signOut']>(async () => undefined);
  // what the key registry lists: the store's key, Clerk's item and the push record
  const keys = vi.fn(async () => [STORAGE_KEY_ITEM, CLERK_CLIENT_ITEM, PUSH_RECORD_ITEM]);
  const remove = vi.fn(async (_key: string) => undefined);
  const expiry = createExpirySignal();
  const provider = createClerkProvider(
    { getToken: port.getToken ?? getToken, signOut: port.signOut ?? signOut },
    { expiry, secureKeys: { keys, remove } },
  );
  return { provider, getToken, signOut, remove, expiry };
}

async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ApiError)) throw new Error(`expected an ApiError, got ${String(error)}`);
  return error;
}

describe('the Clerk provider: the token', () => {
  it("is kind 'clerk'", () => {
    expect(providerWith().provider.kind).toBe('clerk');
  });

  it("asks Clerk for the 'mobile' template and nothing else", async () => {
    const { provider, getToken } = providerWith();
    expect(await provider.getToken()).toBe('mobile.session.jwt');
    await provider.getToken();
    expect(MOBILE_TOKEN_TEMPLATE).toBe('mobile');
    expect(getToken).toHaveBeenCalledTimes(2);
    for (const [options] of getToken.mock.calls) expect(options).toEqual({ template: 'mobile' });
  });

  it('passes null through when signed out', async () => {
    const getToken = vi.fn(async () => null);
    expect(await providerWith({ getToken }).provider.getToken()).toBeNull();
  });

  it('never falls back to a template-less token when the template is missing', async () => {
    const getToken = vi.fn<ClerkSessionPort['getToken']>(async (options) => {
      if (options?.template) {
        throw clerkApiError(404, `No JWT template exists with name: ${options.template}`);
      }
      return 'template-less.jwt';
    });
    const error = await failureOf(providerWith({ getToken }).provider.getToken());
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(getToken).toHaveBeenCalledWith({ template: 'mobile' });
    expect(error.kind).toBe('auth');
    expect(error.code).toBe(APP_ERROR_CODES.signInNotSetUp);
  });

  it('a missing template reads: sign-in is not set up for Automatos Go on this server yet', async () => {
    const getToken = vi.fn(async () => {
      throw clerkApiError(404, 'No JWT template exists with name: mobile');
    });
    const error = await failureOf(providerWith({ getToken }).provider.getToken());
    expect(userMessage(error)).toBe(APP_ERROR_COPY.signInNotSetUp);
    expect(userMessage(error)).toMatch(/not set up for Automatos Go on this server yet/);
  });

  it('a 401 from Clerk is an auth error and tells the expired listeners', async () => {
    const getToken = vi.fn(async () => {
      throw clerkApiError(401, 'Unauthorized');
    });
    const { provider } = providerWith({ getToken });
    const listener = vi.fn();
    provider.onExpired(listener);
    const error = await failureOf(provider.getToken());
    expect(error.kind).toBe('auth');
    expect(error.code).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Clerk offline is a network error; another Clerk refusal is a server error', async () => {
    const offline = vi.fn(async () => {
      throw clerkOffline();
    });
    expect((await failureOf(providerWith({ getToken: offline }).provider.getToken())).kind).toBe(
      'network',
    );
    const refused = vi.fn(async () => {
      throw clerkApiError(429, 'Too many requests');
    });
    expect((await failureOf(providerWith({ getToken: refused }).provider.getToken())).kind).toBe(
      'server',
    );
  });

  it('passes an ApiError through as it is', async () => {
    const own = new ApiError('network');
    const getToken = vi.fn(async () => {
      throw own;
    });
    expect(await failureOf(providerWith({ getToken }).provider.getToken())).toBe(own);
  });
});

describe('the Clerk provider: sign-out', () => {
  it("signs out of Clerk, then deletes the person's keychain items, never the store's key", async () => {
    const order: string[] = [];
    const { provider, signOut, remove } = providerWith();
    signOut.mockImplementation(async () => {
      order.push('clerk');
    });
    remove.mockImplementation(async (key: string) => {
      order.push(`remove:${key}`);
    });
    await provider.signOut();
    expect(order).toEqual(['clerk', `remove:${CLERK_CLIENT_ITEM}`, `remove:${PUSH_RECORD_ITEM}`]);
  });

  it('keeps the keychain when Clerk could not sign out, and says why', async () => {
    const signOut = vi.fn(async () => {
      throw clerkOffline();
    });
    const { provider, remove } = providerWith({ signOut });
    expect((await failureOf(provider.signOut())).kind).toBe('network');
    expect(remove).not.toHaveBeenCalled();
  });

  it('reports a keychain item it could not delete, after trying every one', async () => {
    const { provider, remove } = providerWith();
    remove.mockImplementation(async (key: string) => {
      if (key === CLERK_CLIENT_ITEM) throw new Error('keychain delete failed');
    });
    await expect(provider.signOut()).rejects.toThrow('could not delete 1 keychain item(s)');
    expect(remove).toHaveBeenCalledWith(PUSH_RECORD_ITEM);
  });
});
