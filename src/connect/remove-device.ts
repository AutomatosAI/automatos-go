// Remove this phone and forget this server (US-006i, PRD-001 §4.7, PRD-266 §4.3): first DELETE
// /api/v1/mobile/devices/{device_id} with the device's own token, so the server revokes this phone's
// own row (its next call would be 401 device_revoked); then switch.forgetServer() clears everything
// of the server on the phone (US-006d). The DELETE is best effort: a refusal, no network or a
// keychain that will not read still forgets on the phone, and the result says so, so the shell can
// say Studio may still list the phone. It revokes only this phone's device row and deletes no
// account or workspace (D63).
//
// The call goes through the one client, to the record's own origin with no X-Workspace-ID (the
// device lane's workspace is its row's) and a no-op expiry callback: its 401 must not end the
// pairing as a refusal (the gate would open Connect), since forgetting it is what comes next.

import { createApiClient } from '../api/client';
import { isApiError } from '../api/errors';
import { ownServerFrom } from '../api/server';
import type { Transport } from '../api/transport-types';
import { logger } from '../lib/logger';
import { DEVICE_REVOKED, REMOVE_DEVICE_TIMEOUT_MS } from './config';
import type { DeviceStore, PairedRecord } from './device-store';
import { serverInWords } from './edges';
import { CONNECT_ROUTES } from './routes';

export type RemoveDeviceDeps = {
  readonly store: Pick<DeviceStore, 'load'>;
  /** The shell wires expoTransport (as use-connect.ts does); tests a fake. */
  readonly transport: Transport;
  /** switch.forgetServer(): the server's cache, workspace id, pairing and record go. */
  readonly forget: () => Promise<void>;
  readonly timeoutMs?: number;
};

export type RemoveDeviceResult =
  /** the server revoked this phone (or already had) */
  | { readonly removed: true }
  /** forgotten on the phone only; `server` names it in words, null when nothing was paired */
  | { readonly removed: false; readonly server: string | null };

const UNAUTHORIZED = 401;
const REMOVED: RemoveDeviceResult = Object.freeze({ removed: true });

/** The server already revoked this phone: its token answers 401 device_revoked. */
function alreadyRevoked(error: unknown): boolean {
  return isApiError(error) && error.status === UNAUTHORIZED && error.code === DEVICE_REVOKED;
}

/** A failure in words for the dev log: the client's kind and status, never a body. */
function failureOf(error: unknown): string {
  if (isApiError(error)) return `${error.kind} ${error.status ?? '-'}`;
  return error instanceof Error ? error.name : typeof error;
}

/** Revokes this phone's own row; true when the server says it is revoked. Never rejects. */
async function revokeOnServer(
  record: PairedRecord,
  transport: Transport,
  timeoutMs: number,
): Promise<boolean> {
  const client = createApiClient({
    server: ownServerFrom({ origin: record.origin, webUrl: record.webUrl }),
    getToken: async () => record.token,
    getWorkspaceId: () => null,
    transport,
    onAuthExpired: () => undefined,
    timeoutMs,
  });
  try {
    await client.request(CONNECT_ROUTES.removeDevice, { params: { device_id: record.deviceId } });
    return true;
  } catch (error) {
    if (alreadyRevoked(error)) return true;
    logger.warn(`[connect] the server did not remove this phone (${failureOf(error)})`);
    return false;
  }
}

/** The paired record, or null when the keychain will not say (forgetting goes ahead). */
async function pairedRecord(store: RemoveDeviceDeps['store']): Promise<PairedRecord | null> {
  try {
    return await store.load();
  } catch (error) {
    logger.warn(`[connect] could not read the pairing to remove this phone (${failureOf(error)})`);
    return null;
  }
}

/**
 * DELETE, then forget. Only forgetting can reject (as switch.forgetServer does): the person stays
 * where they are and the shell says so.
 */
export async function removeThisPhone({
  store,
  transport,
  forget,
  timeoutMs = REMOVE_DEVICE_TIMEOUT_MS,
}: RemoveDeviceDeps): Promise<RemoveDeviceResult> {
  const record = await pairedRecord(store);
  const removed = record !== null && (await revokeOnServer(record, transport, timeoutMs));
  await forget();
  if (removed) return REMOVED;
  const server = record && serverInWords(record.serverName, record.origin);
  return Object.freeze({ removed: false, server });
}
