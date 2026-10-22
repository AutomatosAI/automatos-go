// The sign-in providers this app version can use, one factory per mode (D-AUTH-PROVIDER): 'clerk'
// (hosted Studio) and 'device' (a phone paired to a self-hosted install, US-006). 'oidc'
// (enterprise sign-in, PRD-257) is a known mode registered only when its file lands; until then a
// server that offers only it is told it needs a newer Automatos Go (select.ts).

import { createClerkProvider } from './clerk';
import { createDeviceProvider } from './device';
import type { AuthMode } from './types';

export const PROVIDER_FACTORIES = Object.freeze({
  clerk: createClerkProvider,
  device: createDeviceProvider,
} as const satisfies Partial<Record<AuthMode, unknown>>);

export type RegisteredMode = keyof typeof PROVIDER_FACTORIES;

const REGISTERED: ReadonlySet<string> = new Set(Object.keys(PROVIDER_FACTORIES));

export function isRegisteredMode(mode: string): mode is RegisteredMode {
  return REGISTERED.has(mode);
}
