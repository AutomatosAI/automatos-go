import { describe, expect, it } from 'vitest';

import { routes } from '../routes';
import { currentServer, hostedServerFrom } from '../server';

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

  it('reads the environment for the current server (blank in tests)', () => {
    expect(currentServer()).toBeNull();
  });
});

describe('routes', () => {
  it('holds the foundation routes as {method, path}', () => {
    expect(routes).toEqual({
      workspaceCurrent: { method: 'GET', path: '/api/workspaces/current' },
      discovery: {
        method: 'GET',
        path: '/.well-known/automatos.json',
        pendingUpstream: 'PRD-266 US-001',
      },
      tasksStream: { method: 'GET', path: '/api/v1/tasks/stream' },
      needsYou: { method: 'GET', path: '/api/activity/needs-you' },
      reports: { method: 'POST', path: '/api/v1/reports', pendingUpstream: 'PRD-266 US-016' },
    });
  });
});
