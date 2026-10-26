// A URL as a crash report carries it (R01, KR7): no host, no query, and only the app's own route
// words, read from every route table (src/**/routes.ts, as scripts/check-routes.ts reads them).
// A table paths.ts does not import would only turn its words into ':id', but this keeps them in
// step, so a crash still names the route it happened on.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { productFiles, readRepoFile } from '../../release/__tests__/support/tree';
import { framePath, hasHost, reducePath, ROUTE_WORDS, routeWordsOf, stripHost } from '../paths';

const PATH_LITERAL = /path:\s*'([^']+)'/g;

/** Every route table file the app has: src/**\/routes.ts, not the app's own navigation table. */
function routeTableFiles(): string[] {
  return productFiles().filter(
    (file) => file.endsWith('/routes.ts') && !file.startsWith('src/navigation/'),
  );
}

function literalSegments(source: string): string[] {
  return [...source.matchAll(PATH_LITERAL)]
    .flatMap((match) => (match[1] ?? '').split('/'))
    .filter((segment) => segment !== '' && !segment.startsWith('{'));
}

describe('ROUTE_WORDS', () => {
  it('holds every literal segment of every route table in the app', () => {
    const files = routeTableFiles();
    expect(files.length).toBeGreaterThanOrEqual(6);
    const missing = files.flatMap((file) =>
      literalSegments(readRepoFile(file))
        .filter((word) => !ROUTE_WORDS.has(word))
        .map((word) => `${file}: ${word}`),
    );
    expect(missing).toEqual([]);
  });

  it('holds no parameter and no id', () => {
    for (const word of ROUTE_WORDS) {
      expect(word).not.toMatch(/[{}]/);
      expect(word).not.toMatch(/^\d+$/);
    }
  });

  it('reads nested tables and leaves parameters out', () => {
    const words = routeWordsOf([
      { a: { method: 'GET', path: '/api/x/{id}' }, b: { c: { method: 'GET', path: '/api/y' } } },
    ]);
    expect([...words].sort()).toEqual(['api', 'x', 'y']);
  });

  it('is read from this module, not from a copy (the check above reads the files on disk)', () => {
    const source = readFileSync(path.resolve(__dirname, '../paths.ts'), 'utf8');
    expect(source).toMatch(/routeWordsOf\(ROUTE_TABLES\)/);
  });
});

describe('stripHost and hasHost', () => {
  it('drops the scheme, host, port, query and fragment', () => {
    expect(stripHost('https://srv.example.com:8443/api/chat?x=1#y')).toBe('/api/chat');
    expect(stripHost('http://192.168.1.20:8081/index.bundle?platform=ios')).toBe('/index.bundle');
  });

  it('keeps a bare path and turns nothing into /', () => {
    expect(stripHost('/api/chat?limit=50')).toBe('/api/chat');
    expect(stripHost('https://srv.example.com')).toBe('/');
    expect(stripHost('')).toBe('/');
  });

  it('tells a URL with a host from a bundle path', () => {
    expect(hasHost('https://srv.example.com/x')).toBe(true);
    expect(hasHost('app:///main.jsbundle')).toBe(false);
    expect(hasHost('/var/containers/main.jsbundle')).toBe(false);
  });
});

describe('framePath', () => {
  it('keeps the bundle path a source map is matched on', () => {
    expect(framePath('app:///main.jsbundle')).toBe('app:///main.jsbundle');
  });

  it("drops a dev server's address and a home folder's user name", () => {
    expect(framePath('http://192.168.1.20:8081/index.bundle?platform=ios')).toBe('/index.bundle');
    expect(framePath('/Users/someone/Library/Developer/main.jsbundle')).toBe(
      '/Users/:id/Library/Developer/main.jsbundle',
    );
    expect(framePath('/home/someone/app/index.js')).toBe('/home/:id/app/index.js');
  });

  it("drops the id iOS gives the app's install folder", () => {
    expect(
      framePath(
        '/private/var/containers/Bundle/Application/0B7E3C1A-5D2F-4E8A-9C6B-7A1D2E3F4A5B/Go.app/Go',
      ),
    ).toBe('/private/var/containers/Bundle/Application/:id/Go.app/Go');
  });
});

describe('reducePath', () => {
  it.each([
    [
      'https://srv.example.com/api/chat/0b7e3c1a-5d2f-4e8a-9c6b-7a1d2e3f4a5b/messages?l=5',
      '/api/chat/:id/messages',
    ],
    ['/api/v1/tasks/0419/rebrief', '/api/v1/tasks/:id/rebrief'],
    ['/api/v1/approval-grants/42/grant', '/api/v1/approval-grants/:id/grant'],
    ['/api/socials/posts/p1/media/board-notes', '/api/socials/posts/:id/media/:id'],
    ['/api/themes/looks/automatos/play', '/api/themes/looks/:id/:id'],
    ['/api/people/someone@example.com', '/api/:id/:id'],
    ['/api/chat/acme_merger_notes', '/api/chat/:id'],
    ['/.well-known/automatos.json', '/.well-known/automatos.json'],
    ['/api/chat/:id', '/api/chat/:id'],
  ])('%s → %s', (url, expected) => {
    expect(reducePath(url)).toBe(expected);
  });

  it('keeps a trailing slash and the root', () => {
    expect(reducePath('https://srv.example.com/')).toBe('/');
    expect(reducePath('/api/chat/')).toBe('/api/chat/');
  });

  it('takes its words from the caller when given', () => {
    expect(reducePath('/a/b/c', new Set(['a', 'c']))).toBe('/a/:id/c');
  });
});
