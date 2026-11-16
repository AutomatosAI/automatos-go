// The server a client is made over (createApiClient): a plain origin, whoever built it, and plain
// http only to a home network, as pairing allows it (host-text.ts httpAllowedTo). The one client's
// other rules: client.test.ts.

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

  it('refuses plain http to a public name, a public quad or a look-alike, whoever built it', () => {
    for (const apiUrl of [
      'http://api.example.test',
      'http://52.95.110.1:8000',
      'http://100.64.1.1',
      'http://169.254.169.254',
      'http://192.168.1.20.example.test',
      'http://nas.local.example.test',
      'http://nas',
      'http://[fd00::1]:8000',
      // the phone itself: loopback http is a development build's only, and a test run is not one
      'http://localhost:8000',
      'http://127.0.0.1:8000',
    ]) {
      expect(made(apiUrl), apiUrl).toThrow(TypeError);
    }
  });

  it('takes plain http to a private quad or a .local name, as pairing does', () => {
    for (const apiUrl of [
      'http://192.168.1.20:8000',
      'http://10.0.0.2',
      'http://172.16.4.1:8080',
      'http://automatos.local:8000',
    ]) {
      expect(made(apiUrl), apiUrl).not.toThrow();
    }
  });

  it('takes https to any plain origin, as before', () => {
    for (const apiUrl of [
      'https://api.example.test',
      'https://52.95.110.1',
      'https://192.168.1.20:8443',
      'https://automatos.local',
      'https://localhost:8443',
      'https://[2600::1]',
    ]) {
      expect(made(apiUrl), apiUrl).not.toThrow();
    }
  });
});
