// The sign-in provider seam (D-AUTH-PROVIDER, PRD-001 §4.11): one file per provider behind this
// small interface. clerk.ts is the hosted sign-in; device.ts (a paired self-hosted install, US-006)
// and oidc.ts (enterprise sign-in, PRD-257) arrive later as added files, registered in registry.ts.
// The discovery document's auth.modes picks one (select.ts).

export const AUTH_MODES = ['clerk', 'device', 'oidc'] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

export type ExpiredListener = () => void;

export interface AuthProvider {
  readonly kind: AuthMode;
  /** The bearer for the next call, or null when signed out; a failure is an ApiError. */
  getToken(): Promise<string | null>;
  /** Ends the session and deletes what this phone holds for it. */
  signOut(): Promise<void>;
  /**
   * Called when the session is no longer accepted (a 401); returns the unsubscribe. The provider
   * only reports it: the shell's listener calls signOut() (which clears the keychain) and goes back
   * to sign-in.
   */
  onExpired(listener: ExpiredListener): () => void;
}
