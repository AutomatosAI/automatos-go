// The route check's engine (K4, US-004c): find the route tables, collect their {method, path}
// routes from a loaded module, and match each against the server's route manifest at the pin.
// Pure: scripts/check-routes.ts does the reading, the loading, the printing and the exit code.
import path from 'node:path';

import { z } from 'zod';

/** Copied from automatos-ai orchestrator/reports/route-manifest.json by scripts/sync-core.ts. */
export const ROUTE_MANIFEST_PATH = 'src/core/route-manifest.json';

/** orchestrator/scripts/dump_routes.py: sorted pairs; a WebSocket or a mount has method ''. */
export const routeManifestSchema = z
  .object({
    route_count: z.number().int().nonnegative(),
    routes: z.array(z.object({ method: z.string(), path: z.string().startsWith('/') })),
  })
  .refine((manifest) => manifest.route_count === manifest.routes.length, {
    message: 'route_count does not match the number of routes listed',
  });

export type RouteManifest = z.infer<typeof routeManifestSchema>;

/** A route as the app's tables declare it (src/api/routes.ts Route). */
const appRouteSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().regex(/^\/[^?#\s]*$/, 'a server path starts with / and has no query or space'),
  pendingUpstream: z.string().min(1).optional(),
});

export type FoundRoute = z.infer<typeof appRouteSchema> & {
  /** the repo-relative routes.ts it came from */
  readonly file: string;
  /** where in the module: `routes.discovery` */
  readonly name: string;
};

export type Collected = { readonly routes: FoundRoute[]; readonly problems: string[] };

/** Every src/**\/routes.ts the app owns (not the web mirror, not a test fixture). */
export function isRouteTableFile(file: string): boolean {
  return (
    path.posix.basename(file) === 'routes.ts' &&
    file.startsWith('src/') &&
    !file.startsWith('src/core/web/') &&
    !file.split('/').includes('__tests__')
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function looksLikeRoute(value: Record<string, unknown>): boolean {
  return 'method' in value && 'path' in value;
}

/** `ancestors` (the objects above this one) stops a cycle; a shared object is walked per name. */
function walk(
  file: string,
  name: string,
  value: unknown,
  ancestors: readonly unknown[],
): Collected {
  if (!isObject(value) || ancestors.includes(value)) return { routes: [], problems: [] };
  if (looksLikeRoute(value)) {
    const parsed = appRouteSchema.safeParse(value);
    if (parsed.success) return { routes: [{ ...parsed.data, file, name }], problems: [] };
    const why = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return { routes: [], problems: [`${file} ${name} is not a route (${why.join('; ')})`] };
  }
  const children = Object.entries(value).map(([key, child]) =>
    walk(file, `${name}.${key}`, child, [...ancestors, value]),
  );
  return {
    routes: children.flatMap((child) => child.routes),
    problems: children.flatMap((child) => child.problems),
  };
}

/** Every route object reachable from a loaded routes.ts module's named exports. */
export function collectRoutes(file: string, exports: Readonly<Record<string, unknown>>): Collected {
  const results = Object.entries(exports)
    .filter(([name]) => name !== 'default')
    .map(([name, value]) => walk(file, name, value, []));
  const routes = results.flatMap((result) => result.routes);
  const problems = results.flatMap((result) => result.problems);
  if (routes.length > 0 || problems.length > 0) return { routes, problems };
  return { routes, problems: [`${file} exports no route table (an object of {method, path})`] };
}

/** `{chat_id}`, `{id}` and FastAPI's `{path:path}` are all one parameter. */
export function normalisePath(routePath: string): string {
  return routePath.replace(/\{[^}]*\}/g, '{}');
}

const routeKey = (method: string, routePath: string) =>
  `${method.toUpperCase()} ${normalisePath(routePath)}`;

export type RouteReport = {
  readonly matched: FoundRoute[];
  /** marked pendingUpstream and not on the server yet: allowed, listed */
  readonly pending: FoundRoute[];
  /** marked pendingUpstream but already on the server: allowed, the mark can go */
  readonly landed: FoundRoute[];
  /** not on the server and not marked: the check fails */
  readonly missing: FoundRoute[];
};

function bucketOf(route: FoundRoute, served: boolean): keyof RouteReport {
  if (served) return route.pendingUpstream ? 'landed' : 'matched';
  return route.pendingUpstream ? 'pending' : 'missing';
}

export function checkRoutes(
  routes: readonly FoundRoute[],
  manifest: Pick<RouteManifest, 'routes'>,
): RouteReport {
  const served = new Set(manifest.routes.map((route) => routeKey(route.method, route.path)));
  const empty: RouteReport = { matched: [], pending: [], landed: [], missing: [] };
  return routes.reduce<RouteReport>((report, route) => {
    const bucket = bucketOf(route, served.has(routeKey(route.method, route.path)));
    return { ...report, [bucket]: [...report[bucket], route] };
  }, empty);
}

const describeRoute = (route: FoundRoute) =>
  `${route.method} ${route.path} (${route.file} ${route.name})`;

/** The lines to print, and whether the check passes. */
export function formatReport(report: RouteReport): {
  readonly lines: string[];
  readonly ok: boolean;
} {
  const total = Object.values(report).reduce((sum, routes) => sum + routes.length, 0);
  const lines = [
    `${total} routes: ${report.matched.length} on the server at the pin, ` +
      `${report.pending.length + report.landed.length} pendingUpstream, ` +
      `${report.missing.length} missing`,
    ...report.pending.map((r) => `pending upstream (${r.pendingUpstream}): ${describeRoute(r)}`),
    ...report.landed.map(
      (r) => `now on the server, drop pendingUpstream '${r.pendingUpstream}': ${describeRoute(r)}`,
    ),
    ...report.missing.map((r) => `missing on the server at the pin: ${describeRoute(r)}`),
  ];
  return { lines, ok: report.missing.length === 0 };
}
