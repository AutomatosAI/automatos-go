// The signed-in session push runs in (PRD-001 §4.8, KP3): what PushRoot (US-014g) takes from the
// shell, bound in phase 2 (US-014h) from the connect kit's current server, its ONE install id, the
// active sign-in provider and the server's discovery document. Pure: the session as data, and the
// two views of it the push modules read — the registration's (registration/register.ts) and the
// action handler's (inbound/handler.ts). The workspace is the shell's (useAppSession), read where
// PushRoot is mounted; the role is read when a response arrives, so a re-read workspace counts.

import type { WorkspaceRole } from '../api/workspace';
import type { AuthProvider } from '../auth/providers/types';
import { PUSH_CAPABILITY } from './config';
import type { ResponseSession } from './inbound/handler';
import type { RegistrationSession } from './registration/register';
import type { PushSource } from './registration/state';

export type PushSession = Readonly<{
  /** The server's API origin: the push record's serverOrigin. */
  serverOrigin: string;
  /** The server in words (the hosted name, or an own server's name and address). */
  serverName: string;
  source: PushSource;
  /** The connect kit's install id (src/connect/install-id.ts), never a second one. */
  getInstallId: () => Promise<string | null>;
  /** Discovery's push.expo: the server sends push through Expo. */
  pushExpo: boolean;
  /** Discovery's capabilities. */
  capabilities: readonly string[];
  /** The foundation's sign-in provider (US-014i listens to its onExpired). */
  provider: AuthProvider;
}>;

/** The registration's view: this server, this workspace, and its gates. */
export function registrationSessionOf(
  session: PushSession,
  workspaceId: string,
): RegistrationSession {
  return Object.freeze({
    source: session.source,
    serverOrigin: session.serverOrigin,
    workspaceId,
    capabilityPush: session.capabilities.includes(PUSH_CAPABILITY),
    pushExpo: session.pushExpo,
    getInstallId: session.getInstallId,
  });
}

/** The action handler's view: the workspace the app acts in now, and the person's role there. */
export function responseSessionOf(
  session: Pick<PushSession, 'serverOrigin'>,
  workspaceId: () => string | null,
  role: () => WorkspaceRole | null,
): ResponseSession {
  return Object.freeze({ serverOrigin: session.serverOrigin, workspaceId, role });
}

/**
 * What makes a session another one for push: the server, its source and its push gates. PushRoot
 * wires push again only when this changes, so a session object rebuilt with the same content (a
 * discovery refetch) keeps the registrar, the listeners and the handled store.
 */
export function sessionKeyOf(session: PushSession): string {
  return JSON.stringify([
    session.serverOrigin,
    session.source,
    session.pushExpo,
    [...session.capabilities].sort(),
  ]);
}
