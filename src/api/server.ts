// The server the app talks to. In this wave it is always the build's hosted server, from
// EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WEB_URL (K3); US-006 adds 'paired' (a self-hosted install
// connected by QR) as another ServerSource, read from storage instead of the environment.

import { env, type Env } from '../lib/env';
import { withoutTrailingSlash } from './url';

export type ServerSource = 'hosted';

export type Server = {
  readonly apiUrl: string;
  /** Studio on the web, for links out to the system browser ('' when the build has none). */
  readonly webUrl: string;
  readonly source: ServerSource;
};

/** The hosted server from build values; null when the build has no API URL. */
export function hostedServerFrom(values: Pick<Env, 'apiUrl' | 'webUrl'>): Server | null {
  if (!values.apiUrl) return null;
  return Object.freeze({
    apiUrl: withoutTrailingSlash(values.apiUrl),
    webUrl: withoutTrailingSlash(values.webUrl),
    source: 'hosted',
  });
}

/** The current server: the hosted one from env, or null when this build is not configured. */
export function currentServer(): Server | null {
  return hostedServerFrom(env);
}
