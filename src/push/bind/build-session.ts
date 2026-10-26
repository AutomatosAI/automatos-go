// US-014g's PushSession, built from the merged code (US-014h, KP3): the connect kit's current server
// (src/connect/current-server.ts: hosted, or the paired own server with its name and address), its
// ONE install id (src/connect/install-id.ts getInstallId, kept across Forget this server; never a
// second id), the active sign-in provider (useAuthSession), and push.expo and the capabilities from
// the gate's discovery query — read again each launch, so an own server's operator who later says
// 'Yes' turns push on; never the pairing record's copy of push.expo. Pure over its input: the
// hook that reads the shell is session.ts.

import type { Discovery } from '../../api/discovery';
import type { Server } from '../../api/server';
import type { AuthProvider } from '../../auth/providers/types';
import type { OwnServer } from '../../connect/current-server';
import { ownServerInWords } from '../../connect/edges';
import { getInstallId } from '../../connect/install-id';
import { SERVER_SECTION_COPY } from '../../connect/strings';
import type { PushSession } from '../session';

export type SessionInput = Readonly<{
  /** The session's server (useAppSession): its origin and source. */
  server: Pick<Server, 'apiUrl' | 'source'>;
  /** The paired own server (current-server.ts ownServer); null on the hosted server. */
  own: Pick<OwnServer, 'serverName' | 'server'> | null;
  /** The gate's discovery document for this server. */
  discovery: Pick<Discovery, 'push' | 'capabilities'>;
  provider: AuthProvider;
}>;

/** The connect kit's install id, through its own function: one stable reference for every session. */
const connectInstallId = (): Promise<string | null> => getInstallId();

/** The server in words: an own server's name and address, or the hosted server's name. */
export function serverNameOf(own: Pick<OwnServer, 'serverName' | 'server'> | null): string {
  return own ? ownServerInWords(own) : SERVER_SECTION_COPY.hostedName;
}

export function buildPushSession({ server, own, discovery, provider }: SessionInput): PushSession {
  return Object.freeze({
    serverOrigin: server.apiUrl,
    serverName: serverNameOf(server.source === 'own' ? own : null),
    source: server.source,
    getInstallId: connectInstallId,
    pushExpo: discovery.push.expo,
    capabilities: discovery.capabilities,
    provider,
  });
}
