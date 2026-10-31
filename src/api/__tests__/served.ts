// Test helper: is a route on the server at the core pin? It reads src/core/route-manifest.json (the
// server's {method, path} pairs, vendored by scripts/sync-core.ts) and compares paths with every
// `{param}` as one parameter, as scripts/check-routes.ts does.

import manifest from '../../core/route-manifest.json';
import type { Route } from '../routes';

const routeKey = (method: string, path: string): string =>
  `${method.toUpperCase()} ${path.replace(/\{[^}]*\}/g, '{}')}`;

const SERVED: ReadonlySet<string> = new Set(
  manifest.routes.map((route) => routeKey(route.method, route.path)),
);

/** True when the pinned route manifest has this route's method and path. */
export function servedAtPin(route: Pick<Route, 'method' | 'path'>): boolean {
  return SERVED.has(routeKey(route.method, route.path));
}
