// The hosted sign-in provider (D-AUTH-PROVIDER): Clerk's session behind the AuthProvider seam. Pure
// over a port (AuthRoot.tsx adapts @clerk/expo's useAuth to it), so its contract runs in vitest.
//
// getToken asks for the "mobile" JWT template and only that one (D39, src/auth/config.ts); it never
// retries without a template. Clerk only calls the template endpoint for a live session (signed
// out, getToken answers null without a request), so a 404 there means the server's Clerk has no
// "mobile" template yet: an auth error whose words say sign-in is not set up for Automatos Go on
// this server. A 401 means Clerk no longer accepts the session: the expiry signal hears it. Every
// failure leaves as an ApiError of the taxonomy (src/api/errors.ts).

import { z } from 'zod';

import { ApiError, APP_ERROR_CODES, isApiError } from '../../api/errors';
import type { SecureKeyRegistry } from '../../lib/secure-keys';
import { MOBILE_TOKEN_TEMPLATE } from '../config';
import type { ExpirySignal } from './expiry';
import type { AuthProvider } from './types';

const NOT_FOUND = 404;
const UNAUTHORIZED = 401;

const TOKEN_OPTIONS = Object.freeze({ template: MOBILE_TOKEN_TEMPLATE });

/** The two calls of @clerk/expo's useAuth the provider needs. */
export type ClerkSessionPort = {
  readonly getToken: (options: { readonly template: string }) => Promise<string | null>;
  readonly signOut: () => Promise<void>;
};

export type ClerkProviderDeps = {
  readonly expiry: ExpirySignal;
  /** Sign-out deletes every keychain item the app holds (src/lib/secure-keys.ts). */
  readonly secureKeys: Pick<SecureKeyRegistry, 'wipe'>;
};

/** A ClerkAPIResponseError carries the FAPI status; a ClerkRuntimeError (offline) has none. */
const ClerkFailureSchema = z.object({ status: z.number().int() });

function statusOf(error: unknown): number | undefined {
  const parsed = ClerkFailureSchema.safeParse(error);
  return parsed.success ? parsed.data.status : undefined;
}

/** Clerk unreachable: network; Clerk refusing the session: auth; any other refusal: server. */
function clerkFailure(error: unknown): ApiError {
  if (isApiError(error)) return error;
  const status = statusOf(error);
  if (status === undefined) return new ApiError('network', { cause: error });
  return new ApiError(status === UNAUTHORIZED ? 'auth' : 'server', { cause: error });
}

function tokenFailure(error: unknown, expiry: ExpirySignal): ApiError {
  const status = statusOf(error);
  if (status === NOT_FOUND) {
    return new ApiError('auth', { code: APP_ERROR_CODES.signInNotSetUp, cause: error });
  }
  if (status === UNAUTHORIZED) expiry.notify();
  return clerkFailure(error);
}

export function createClerkProvider(
  clerk: ClerkSessionPort,
  { expiry, secureKeys }: ClerkProviderDeps,
): AuthProvider {
  return Object.freeze({
    kind: 'clerk' as const,
    getToken: async () => {
      try {
        return await clerk.getToken(TOKEN_OPTIONS);
      } catch (error) {
        throw tokenFailure(error, expiry);
      }
    },
    /** Clerk first (it still needs its client item); the keychain is wiped only once it is done. */
    signOut: async () => {
      try {
        await clerk.signOut();
      } catch (error) {
        throw clerkFailure(error);
      }
      await secureKeys.wipe();
    },
    onExpired: expiry.subscribe,
  });
}
