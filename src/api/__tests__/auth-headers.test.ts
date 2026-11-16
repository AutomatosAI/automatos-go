import { describe, expect, it } from 'vitest';

import {
  AUTHORIZATION_HEADER,
  buildAuthHeaders,
  createHeadersFor,
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

describe('createHeadersFor', () => {
  const API = 'https://api.example.test';

  it('asks the provider each time, so a refreshed token is used', async () => {
    let token: string | null = 'first';
    const headersFor = createHeadersFor(
      API,
      async () => token,
      () => 'ws-1',
    );
    expect(await headersFor(`${API}/x`)).toEqual({
      Authorization: 'Bearer first',
      'X-Workspace-ID': 'ws-1',
    });
    token = null;
    expect(await headersFor(`${API}/x`)).toEqual({});
  });

  it('gives nothing for another host, a look-alike, another scheme or a relative address', async () => {
    const headersFor = createHeadersFor(
      API,
      async () => 'tok',
      () => 'ws-1',
    );
    for (const url of [
      'https://elsewhere.example.test/x',
      'https://api.example.test.evil.example/x',
      'https://api.example.testx/x',
      'http://api.example.test/x',
      '/x',
      'api.example.test/x',
    ]) {
      expect(await headersFor(url), url).toEqual({});
    }
  });
});
