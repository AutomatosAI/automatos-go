// The sign-in providers this app version can use, one factory per mode (D-AUTH-PROVIDER). 'device'
// (a paired self-hosted install, US-006) and 'oidc' (enterprise sign-in, PRD-257) are known modes
// but are registered only when their files land; until then a server that offers only them is told
// it needs a newer Automatos Go (select.ts).

import { createClerkProvider } from './clerk';
import type { AuthMode } from './types';

export const PROVIDER_FACTORIES = Object.freeze({
  clerk: createClerkProvider,
} as const satisfies Partial<Record<AuthMode, unknown>>);

export type RegisteredMode = keyof typeof PROVIDER_FACTORIES;

const REGISTERED: ReadonlySet<string> = new Set(Object.keys(PROVIDER_FACTORIES));

export function isRegisteredMode(mode: string): mode is RegisteredMode {
  return REGISTERED.has(mode);
}
