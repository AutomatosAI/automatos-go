import { describe, expect, it } from 'vitest';

import {
  AUTHORIZATION_HEADER,
  buildAuthHeaders,
  createAuthHeaders,
  resolveToken,
  WORKSPACE_HEADER,
} from '../auth-headers';
import { ApiError } from '../errors';

describe('buildAuthHeaders', () => {
  it('gives the bearer and the workspace header', () => {
    expect(buildAuthHeaders('jwt.token', 'ws-1')).toEqual({
      [AUTHORIZATION_HEADER]: 'Bearer jwt.token',
      [WORKSPACE_HEADER]: 'ws-1',
    });
    expect(AUTHORIZATION_HEADER).toBe('Authorization');
    expect(WORKSPACE_HEADER).toBe('X-Workspace-ID');
  });

  it('gives only the bearer until the workspace is known', () => {
    expect(buildAuthHeaders('jwt.token', null)).toEqual({ Authorization: 'Bearer jwt.token' });
  });

  it('gives none when signed out, even with a workspace id', () => {
    expect(buildAuthHeaders(null, 'ws-1')).toEqual({});
    expect(buildAuthHeaders('', 'ws-1')).toEqual({});
  });

  it('refuses a token with a space, CR or LF', () => {
    for (const token of ['two words', 'a\r\nX-Injected: 1', 'tab\there']) {
      expect(() => buildAuthHeaders(token, null)).toThrow(ApiError);
    }
  });

  it('drops a workspace id that is not header-safe, keeping the bearer', () => {
    expect(buildAuthHeaders('jwt.token', 'ws\r\nX-Injected: 1')).toEqual({
      Authorization: 'Bearer jwt.token',
    });
  });
});

describe('resolveToken', () => {
  it('keeps an ApiError from the provider and wraps anything else as network', async () => {
    await expect(resolveToken(() => Promise.reject(new ApiError('auth')))).rejects.toMatchObject({
      kind: 'auth',
    });
    await expect(resolveToken(() => Promise.reject(new Error('offline')))).rejects.toMatchObject({
      kind: 'network',
    });
  });
});

describe('createAuthHeaders', () => {
  it('asks the provider each time, so a refreshed token is used', async () => {
    let token: string | null = 'first';
    const authHeaders = createAuthHeaders(
      async () => token,
      () => 'ws-1',
    );
    expect(await authHeaders()).toEqual({
      Authorization: 'Bearer first',
      'X-Workspace-ID': 'ws-1',
    });
    token = null;
    expect(await authHeaders()).toEqual({});
  });
});
