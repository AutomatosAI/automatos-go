// The two headers every call carries (D-ONE-CLIENT): `Authorization: Bearer <token>` from the active
// sign-in provider and `X-Workspace-ID` once the workspace is known. The client sends them, and
// authHeaders() hands the same pair to native loads that cannot go through the client's fetch
// (expo-file-system downloads, expo-image sources). Signed out, there are none: a workspace id
// without a credential means nothing to the server.

import { logger } from '../lib/logger';
import { ApiError, isApiError } from './errors';

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

/** authHeaders() over the same provider getToken and workspace the client uses. */
export function createAuthHeaders(
  getToken: TokenGetter,
  getWorkspaceId: WorkspaceIdGetter,
): () => Promise<AuthHeaders> {
  return async () => buildAuthHeaders(await resolveToken(getToken), getWorkspaceId());
}
