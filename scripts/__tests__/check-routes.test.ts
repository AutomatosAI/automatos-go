import { describe, expect, it } from 'vitest';

import * as appRoutes from '../../src/navigation/routes';
import {
  APP_ROUTE_TABLE,
  checkRoutes,
  collectRoutes,
  formatReport,
  isRouteTableFile,
  normalisePath,
  routeManifestSchema,
  type FoundRoute,
} from '../check-routes/match';

const SERVER = routeManifestSchema.parse({
  route_count: 5,
  routes: [
    { method: 'GET', path: '/api/workspaces/current' },
    { method: 'GET', path: '/api/chat/{chat_id}/messages' },
    { method: 'PATCH', path: '/api/chat/{chat_id}' },
    { method: 'GET', path: '/api/themes/files/{digest}/{path:path}' },
    { method: '', path: '/api/voice/retell/llm-websocket/{call_id}' },
  ],
});

const route = (method: FoundRoute['method'], path: string, pendingUpstream?: string) =>
  ({ method, path, file: 'src/x/routes.ts', name: `routes.${path}`, pendingUpstream }) as const;

describe('check-routes: finding the route tables', () => {
  it.each([
    ['src/api/routes.ts', true],
    ['src/chat/routes.ts', true],
    ['src/cc/board/routes.ts', true],
    ['src/core/web/lib/routes.ts', false],
    ['src/api/__tests__/routes.ts', false],
    ['src/navigation/web-routes.ts', false],
    ['src/navigation/routes.ts', false],
    ['scripts/routes.ts', false],
  ])('%s is a route table: %s', (file, expected) => {
    expect(isRouteTableFile(file)).toBe(expected);
  });
});

describe("check-routes: the app's own route table", () => {
  it('holds screen paths only: no {method, path} server route hides in it', () => {
    const { routes, problems } = collectRoutes(APP_ROUTE_TABLE, appRoutes);
    expect(routes).toEqual([]);
    expect(problems).toEqual([
      `${APP_ROUTE_TABLE} exports no route table (an object of {method, path})`,
    ]);
  });
});

describe('check-routes: path parameters', () => {
  it('normalises every {name} and FastAPI converter to one parameter', () => {
    expect(normalisePath('/api/chat/{id}/messages')).toBe('/api/chat/{}/messages');
    expect(normalisePath('/api/chat/{chat_id}/messages')).toBe('/api/chat/{}/messages');
    expect(normalisePath('/api/themes/files/{digest}/{path:path}')).toBe('/api/themes/files/{}/{}');
    expect(normalisePath('/api/workspaces/current')).toBe('/api/workspaces/current');
  });
});

describe('check-routes: matching the server at the pin', () => {
  it('matches a route by method and path, whatever its parameters are called', () => {
    const report = checkRoutes(
      [
        route('GET', '/api/workspaces/current'),
        route('GET', '/api/chat/{id}/messages'),
        route('GET', '/api/themes/files/{digest}/{file}'),
      ],
      SERVER,
    );
    expect(report.matched).toHaveLength(3);
    expect(report.missing).toEqual([]);
    expect(formatReport(report).ok).toBe(true);
  });

  it('a route marked pendingUpstream passes and is listed', () => {
    const pending = route('GET', '/.well-known/automatos.json', 'PRD-266 US-001');
    const report = checkRoutes([pending], SERVER);
    expect(report.pending).toEqual([pending]);
    const { lines, ok } = formatReport(report);
    expect(ok).toBe(true);
    expect(lines).toContain(
      'pending upstream (PRD-266 US-001): GET /.well-known/automatos.json ' +
        '(src/x/routes.ts routes./.well-known/automatos.json)',
    );
  });

  it('a pendingUpstream route the server already has passes and says the mark can go', () => {
    const report = checkRoutes([route('PATCH', '/api/chat/{id}', 'PRD-266 US-009')], SERVER);
    expect(report.landed).toHaveLength(1);
    const { lines, ok } = formatReport(report);
    expect(ok).toBe(true);
    expect(lines[1]).toContain("now on the server, drop pendingUpstream 'PRD-266 US-009'");
  });

  it('a miss fails and names the route, its table and its name', () => {
    const report = checkRoutes(
      [
        route('POST', '/api/chat/{id}/messages'), // the path exists, not with this method
        route('GET', '/api/chat/{id}/messages/'), // a trailing slash is another path
        route('GET', '/api/voice/retell/llm-websocket/{id}'), // a WebSocket, not a GET
      ],
      SERVER,
    );
    expect(report.missing).toHaveLength(3);
    const { lines, ok } = formatReport(report);
    expect(ok).toBe(false);
    expect(lines[0]).toBe('3 routes: 0 on the server at the pin, 0 pendingUpstream, 3 missing');
    expect(lines[1]).toBe(
      'missing on the server at the pin: POST /api/chat/{id}/messages ' +
        '(src/x/routes.ts routes./api/chat/{id}/messages)',
    );
  });
});

describe('check-routes: collecting a loaded routes.ts', () => {
  it('collects every route in nested, frozen tables and ignores helpers', () => {
    const exports = {
      routes: Object.freeze({
        current: { method: 'GET', path: '/api/workspaces/current' },
        chat: { messages: { method: 'GET', path: '/api/chat/{id}/messages' } },
      }),
      chatPath: (id: string) => `/api/chat/${id}`,
      VERSION: 1,
    };
    const { routes, problems } = collectRoutes('src/chat/routes.ts', exports);
    expect(problems).toEqual([]);
    expect(routes.map((r) => [r.name, r.method, r.path])).toEqual([
      ['routes.current', 'GET', '/api/workspaces/current'],
      ['routes.chat.messages', 'GET', '/api/chat/{id}/messages'],
    ]);
  });

  it('refuses a malformed route instead of skipping it', () => {
    const exports = { routes: { send: { method: 'FETCH', path: 'api/chat?x=1' } } };
    const { routes, problems } = collectRoutes('src/chat/routes.ts', exports);
    expect(routes).toEqual([]);
    expect(problems[0]).toContain('src/chat/routes.ts routes.send is not a route');
    expect(problems[0]).toContain('method');
    expect(problems[0]).toContain('path');
  });

  it('a routes.ts with no route table is a problem, and a cycle does not loop', () => {
    const cyclic: Record<string, unknown> = { label: 'x' };
    cyclic.self = cyclic;
    const { problems } = collectRoutes('src/cc/routes.ts', { cyclic, default: {} });
    expect(problems).toEqual([
      'src/cc/routes.ts exports no route table (an object of {method, path})',
    ]);
  });
});

describe('check-routes: the server manifest', () => {
  it('accepts the dump_routes.py shape and ignores unknown fields', () => {
    const parsed = routeManifestSchema.parse({
      route_count: 1,
      routes: [{ method: 'GET', path: '/', extra: true }],
      generated_by: 'dump_routes.py',
    });
    expect(parsed).toEqual({ route_count: 1, routes: [{ method: 'GET', path: '/' }] });
  });

  it('refuses a route_count that does not match the routes listed', () => {
    const parsed = routeManifestSchema.safeParse({ route_count: 2, routes: [] });
    expect(parsed.success).toBe(false);
  });
});
