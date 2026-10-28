// The discovery document (PRD-266 §4.1): GET /.well-known/automatos.json, unauthenticated, says what
// a server is before the app shows a sign-in: its edition, its URLs, the sign-in modes it takes and
// the capabilities it implements. The app gates features on `capabilities`, never on a version
// (D-CAPABILITIES), so unknown capability strings are dropped and unknown fields ignored. Unknown
// sign-in modes are KEPT: the provider selection (src/auth) must see them to say "This server needs
// a newer Automatos Go". Until PRD-266 W1 deploys, the hosted server answers 404 and the app runs on
// hostedDefaults with every gated feature off (K3); any other failure is a taxonomy error.

import { z } from 'zod';

import { isHttpUrl } from '../lib/env';
import { createApiClient } from './client';
import { isApiError } from './errors';
import { routes } from './routes';
import type { Server } from './server';
import type { Transport } from './transport-types';

export const DISCOVERY_SCHEMA_VERSION = 'automatos-discovery/v1';

/** Every capability this app version knows; anything else a server lists is ignored. */
export const CAPABILITIES = [
  'push',
  'spoken_mode',
  'voice_live',
  'mobile_theme',
  'report_content',
  'digest',
  /** Auto's server voice: POST /api/voice/speech, GET /api/voice/voices (listed only with a voice). */
  'tts',
  /** Today's brief on request: POST /api/v1/mobile/digest/now (Settings → Notifications). */
  'digest_now',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const KNOWN_CAPABILITIES: ReadonlySet<string> = new Set(CAPABILITIES);
const NOT_FOUND = 404;

function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && KNOWN_CAPABILITIES.has(value);
}

function knownCapabilities(values: readonly unknown[]): readonly Capability[] {
  return Object.freeze([...new Set(values.filter(isCapability))]);
}

function stringsOnly(values: readonly unknown[]): readonly string[] {
  return Object.freeze(values.filter((value): value is string => typeof value === 'string'));
}

const httpUrl = z.string().trim().refine(isHttpUrl, 'must be an http(s) URL');

const ClerkSchema = z.object({ publishable_key: z.string(), frontend_api: z.string() });

export const DiscoverySchema = z.object({
  schema: z.literal(DISCOVERY_SCHEMA_VERSION),
  name: z.string().optional(),
  /** 'saas' or 'local' today; kept as sent so a newer edition still shows in Settings. */
  edition: z.string().min(1),
  api_url: httpUrl,
  web_url: httpUrl,
  auth: z.object({
    /** In the server's order of preference; unknown modes kept (see the header). */
    modes: z.array(z.unknown()).transform(stringsOnly),
    /** null on a local install, which signs in with a paired device token. */
    clerk: ClerkSchema.nullable().default(null),
  }),
  pairing: z.object({ enabled: z.boolean() }).default({ enabled: false }),
  /** true when this server sends push through Expo (SaaS always; local once the operator agreed). */
  push: z.object({ expo: z.boolean() }).default({ expo: false }),
  capabilities: z.array(z.unknown()).default([]).transform(knownCapabilities),
});

export type Discovery = Readonly<z.output<typeof DiscoverySchema>>;

/**
 * What the built-in hosted server is while it has no discovery document (K3): SaaS, Clerk sign-in
 * with the build's own publishable key (US-005a reads EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, never this
 * document), and no capabilities, so every gated feature stays off.
 */
export function hostedDefaults(server: Server): Discovery {
  return Object.freeze({
    schema: DISCOVERY_SCHEMA_VERSION,
    edition: 'saas',
    api_url: server.apiUrl,
    web_url: server.webUrl,
    auth: Object.freeze({ modes: Object.freeze(['clerk']), clerk: null }),
    pairing: Object.freeze({ enabled: false }),
    push: Object.freeze({ expo: false }),
    capabilities: Object.freeze([]),
  });
}

export type FetchDiscoveryOptions = {
  readonly transport: Transport;
  readonly signal?: AbortSignal;
};

/** A 404 means "no discovery yet" only from the build's own server; from any other it is an error. */
function isHostedWithoutDiscovery(server: Server, error: unknown): boolean {
  return server.source === 'hosted' && isApiError(error) && error.status === NOT_FOUND;
}

/**
 * GET /.well-known/automatos.json with no bearer and no workspace header: the document is public
 * and is read before anyone has signed in. The one client still maps every failure and parses the
 * body with the schema (a document it cannot read is an invalid_response: "update the app").
 */
export async function fetchDiscovery(
  server: Server,
  { transport, signal }: FetchDiscoveryOptions,
): Promise<Discovery> {
  const anonymous = createApiClient({
    server,
    getToken: async () => null,
    getWorkspaceId: () => null,
    transport,
  });
  try {
    return await anonymous.request(routes.discovery, { schema: DiscoverySchema, signal });
  } catch (error) {
    if (isHostedWithoutDiscovery(server, error)) return hostedDefaults(server);
    throw error;
  }
}
