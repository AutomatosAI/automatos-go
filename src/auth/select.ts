// Which sign-in provider a server gets (D-AUTH-PROVIDER): the first mode in the discovery document's
// auth.modes (the server's order of preference) that this app has registered. A server that offers
// none of them (only modes still to come, modes this version has never heard of, or no modes at
// all) is told it needs a newer Automatos Go.

import type { Discovery } from '../api/discovery';
import { isRegisteredMode, type RegisteredMode } from './providers/registry';
import { AUTH_COPY } from './strings';

export type ProviderSelection =
  | { readonly unsupported: false; readonly mode: RegisteredMode }
  | { readonly unsupported: true; readonly message: string };

const UNSUPPORTED: ProviderSelection = Object.freeze({
  unsupported: true,
  message: AUTH_COPY.unsupportedServer,
});

export function selectProvider(discovery: Pick<Discovery, 'auth'>): ProviderSelection {
  const mode = discovery.auth.modes.find(isRegisteredMode);
  return mode ? Object.freeze({ unsupported: false, mode }) : UNSUPPORTED;
}
