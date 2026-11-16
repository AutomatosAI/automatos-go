// The two headers every call carries (D-ONE-CLIENT): `Authorization: Bearer <token>` from the active
// sign-in provider and `X-Workspace-ID` once the workspace is known. The client sends them, and
// headersFor(url) hands the same pair to a native load that cannot go through the client's fetch
// (an expo-image source), and only for an address on the client's own server (url.ts isOnServer,
// the test the transfer module uses): for any other address, nothing. Signed out, there are none:
// a workspace id without a credential means nothing to the server.

import { logger } from '../lib/logger';
import { ApiError, isApiError } from './errors';
import { isOnServer } from './url';

export const AUTHORIZATION_HEADER = 'Authorization';
export const WORKSPACE_HEADER = 'X-Workspace-ID';

export type TokenGetter = () => Promise<string | null>;
export type WorkspaceIdGetter = () => string | null;
export type AuthHeaders = Readonly<Record<string, string>>;

/** Visible ASCII, no spaces: anything else (CR, LF) could split or forge a header. */
const HEADER_SAFE = /^[\x21-\x7E]+$/;

/** The provider's token; a getter that fails without an ApiError of its own is a network failure. */
export async function resolveToken(getToken: TokenGetter): Promise<string | null> {
  try {
    return await getToken();
  } catch (error) {
    throw isApiError(error) ? error : new ApiError('network', { cause: error });
  }
}

export function buildAuthHeaders(token: string | null, workspaceId: string | null): AuthHeaders {
  if (!token) return {};
  if (!HEADER_SAFE.test(token)) throw new ApiError('auth', { cause: new Error('unusable token') });
  const bearer = { [AUTHORIZATION_HEADER]: `Bearer ${token}` };
  if (!workspaceId) return bearer;
  if (!HEADER_SAFE.test(workspaceId)) {
    logger.warn('[api] workspace id is not header-safe; the server will resolve the workspace');
    return bearer;
  }
  return { ...bearer, [WORKSPACE_HEADER]: workspaceId };
}

/**
 * headersFor(url) over the same server, provider getToken and workspace the client uses: the
 * headers for an address on that server, and none for any other (no token is even asked for).
 */
export function createHeadersFor(
  apiUrl: string,
  getToken: TokenGetter,
  getWorkspaceId: WorkspaceIdGetter,
): (url: string) => Promise<AuthHeaders> {
  return async (url) => {
    if (!isOnServer(apiUrl, url)) return {};
    return buildAuthHeaders(await resolveToken(getToken), getWorkspaceId());
  };
}
