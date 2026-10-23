import { describe, expect, it } from 'vitest';

import { copyFiles } from '../sync-core/copy';
import { buildLock, checkLock } from '../sync-core/manifest';
import { REASON, manifest, tree } from './sync-core-helpers';

const ROUTES = '{\n  "route_count": 1,\n  "routes": [{ "method": "GET", "path": "/x" }]\n}\n';
const FROM = 'orchestrator/reports/route-manifest.json';
const TO = 'src/core/route-manifest.json';
const checkout = tree({ [FROM]: ROUTES, 'frontend/lib/a.ts': 'export const a = 1\n' });
const copying = (to = TO, from = FROM) => manifest({ copy: { [from]: { to, reason: REASON } } });

describe('sync-core copy: files from outside the root', () => {
  it('copies a checkout-relative file verbatim (no header line) to its target', () => {
    const result = copyFiles(copying(), checkout);
    expect(result).toEqual({ files: [{ path: TO, text: ROUTES }], problems: [] });
  });

  it('copies nothing when the manifest has no copy entries', () => {
    expect(copyFiles(manifest(), checkout)).toEqual({ files: [], problems: [] });
  });

  it('reports a source the checkout does not have', () => {
    const result = copyFiles(copying(TO, 'orchestrator/reports/gone.json'), checkout);
    expect(result.files).toEqual([]);
    expect(result.problems).toEqual([
      'copy source not in the checkout: orchestrator/reports/gone.json',
    ]);
  });

  it.each([
    'src/api/route-manifest.json',
    'src/core/web/route-manifest.json',
    'src/core/../api/route-manifest.json',
    '/src/core/route-manifest.json',
  ])('refuses the target %s (only under src/core/, never in the web mirror)', (to) => {
    const result = copyFiles(copying(to), checkout);
    expect(result.files).toEqual([]);
    expect(result.problems[0]).toContain(`copy target ${to} must be a plain path under src/core/`);
  });
});

describe('sync-core --check: a copied file', () => {
  const pinned = copying();
  const web = { path: 'src/core/web/lib/a.ts', text: 'export const a = 1\n' };
  const lock = buildLock(pinned, [web, { path: TO, text: ROUTES }], '2026-10-21T00:00:00.000Z');
  const onDisk = (routes: string) =>
    new Map([
      [web.path, web.text],
      [TO, routes],
    ]);

  it('is lock-listed and passes when it matches', () => {
    expect(Object.keys(lock.files)).toContain(TO);
    expect(checkLock(pinned, lock, onDisk(ROUTES))).toEqual([]);
  });

  it('catches an edit and a missing copy', () => {
    const edited = checkLock(pinned, lock, onDisk(ROUTES.replace('/x', '/y')));
    expect(edited).toEqual([`edited: ${TO} (never edit vendored files)`]);
    const missing = checkLock(pinned, lock, new Map([[web.path, web.text]]));
    expect(missing).toEqual([`missing: ${TO}`]);
  });

  it('catches a copy entry the lock does not list (the sync was not re-run)', () => {
    const before = buildLock(pinned, [web], '2026-10-21T00:00:00.000Z');
    const problems = checkLock(pinned, before, new Map([[web.path, web.text]]));
    expect(problems).toEqual([
      `not copied: ${FROM} → ${TO} is in scripts/core-manifest.json but not in core.lock.json`,
    ]);
  });
});
