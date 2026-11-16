// The server a client is made over (createApiClient): a plain origin, whoever built it. The one
// client's other rules: client.test.ts.

import { describe, expect, it } from 'vitest';

import { createApiClient } from '../client';
import { SERVER, fakeTransport, reply } from './fake-transport';

describe('the server a client is made over', () => {
  const made = (apiUrl: string) => () =>
    createApiClient({
      server: { apiUrl, webUrl: '', source: 'own' },
      getToken: async () => null,
      getWorkspaceId: () => null,
      transport: fakeTransport(() => reply(204)),
    });

  it('must be a plain origin, whoever built it: a hand-built one is refused before anything is sent', () => {
    for (const apiUrl of [
      'https://api.example.test/api',
      'https://user@api.example.test',
      'https://api.example.test?x=1',
      'https://API.example.test',
      'javascript:alert(1)',
      'https://0x7f.1',
      '',
    ]) {
      expect(made(apiUrl), apiUrl).toThrow(TypeError);
    }
  });

  it('takes the origins hostedServerFrom and ownServerFrom give', () => {
    for (const apiUrl of [SERVER.apiUrl, 'http://192.168.1.20:8000', 'https://[::1]:8443']) {
      expect(made(apiUrl), apiUrl).not.toThrow();
    }
  });
});
