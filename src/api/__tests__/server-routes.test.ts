import { describe, expect, it } from 'vitest';

import { routes } from '../routes';
import { builtInServer, hostedServerFrom, ownServerFrom } from '../server';

describe('hostedServerFrom', () => {
  it('is the hosted server from the build values, without trailing slashes', () => {
    expect(
      hostedServerFrom({ apiUrl: 'https://api.example.test/', webUrl: 'https://ui.example.test/' }),
    ).toEqual({
      apiUrl: 'https://api.example.test',
      webUrl: 'https://ui.example.test',
      source: 'hosted',
    });
  });

  it('is null when the build has no API URL', () => {
    expect(hostedServerFrom({ apiUrl: '', webUrl: 'https://ui.example.test' })).toBeNull();
  });

  it('keeps a blank web URL blank', () => {
    expect(hostedServerFrom({ apiUrl: 'https://api.example.test', webUrl: '' })?.webUrl).toBe('');
  });

  it('reads the environment for the built-in server (blank in tests)', () => {
    expect(builtInServer()).toBeNull();
  });
});

describe('ownServerFrom (KC4, KC5)', () => {
  it('is the origin that answered discovery and Studio on the web, source own', () => {
    expect(
      ownServerFrom({ origin: 'http://192.168.1.20:8000', webUrl: 'http://192.168.1.20:3000/' }),
    ).toEqual({
      apiUrl: 'http://192.168.1.20:8000',
      webUrl: 'http://192.168.1.20:3000',
      source: 'own',
    });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ownServerFrom({ origin: 'https://a.example', webUrl: '' }))).toBe(true);
  });
});

describe('routes', () => {
  it('holds the foundation routes as {method, path}', () => {
    expect(routes).toEqual({
      workspaceCurrent: { method: 'GET', path: '/api/workspaces/current' },
      discovery: { method: 'GET', path: '/.well-known/automatos.json' },
      tasksStream: { method: 'GET', path: '/api/v1/tasks/stream' },
      needsYou: { method: 'GET', path: '/api/activity/needs-you' },
      reports: { method: 'POST', path: '/api/v1/reports' },
    });
  });
});
