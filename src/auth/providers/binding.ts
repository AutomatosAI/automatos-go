// Binds the active provider into the one API client (D-ONE-CLIENT): the client takes its bearer from
// the provider's getToken, and its onAuthExpired (a 401) notifies the same signal the provider's
// onExpired listens on. The shell spreads clientAuth into createApiClient's options.

import type { ApiClientOptions } from '../../api/client';
import { createExpirySignal, type ExpirySignal } from './expiry';
import type { AuthProvider } from './types';

export type ClientAuth = Required<Pick<ApiClientOptions, 'getToken' | 'onAuthExpired'>>;

export type ProviderBinding = {
  readonly provider: AuthProvider;
  readonly clientAuth: ClientAuth;
};

/** Builds a provider over a fresh expiry signal and the client options bound to both. */
export function bindProvider(build: (expiry: ExpirySignal) => AuthProvider): ProviderBinding {
  const expiry = createExpirySignal();
  const provider = build(expiry);
  return Object.freeze({
    provider,
    clientAuth: Object.freeze({
      getToken: () => provider.getToken(),
      onAuthExpired: expiry.notify,
    }),
  });
}
