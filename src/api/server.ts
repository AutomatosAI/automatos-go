// The server the app talks to: the build's hosted server, from EXPO_PUBLIC_API_URL /
// EXPO_PUBLIC_WEB_URL (K3), or 'own', a server the person chose by its address or a pairing link
// (US-006, KC4). The source says which server, not how one signs in to it: an own server's
// discovery names its sign-in mode (a paired device today, OIDC later).

import { env, type Env } from '../lib/env';
import { withoutTrailingSlash } from './url';

export type ServerSource = 'hosted' | 'own';

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
