// What a paired phone's own server must say for the shell to open it (US-006d): 'device' in
// auth.modes and pairing on; a 404 for the document is a server before PRD-266 W1; no answer, or a
// gateway that cannot reach it, is Not running.

import { describe, expect, it } from 'vitest';

import { DiscoverySchema, type Discovery } from '../../api/discovery';
import { ApiError } from '../../api/errors';
import { NOT_RUNNING_GATEWAY_STATUSES } from '../config';
import { isNotRunning, isWithoutDiscovery, ownDiscoveryRefusal } from '../server-support';

/** A self-hosted install taking paired phones (LOCAL_REMOTE_ACCESS=paired). */
const PAIRED: Discovery = DiscoverySchema.parse({
  schema: 'automatos-discovery/v1',
  edition: 'local',
  api_url: 'http://192.168.1.20:8000',
  web_url: 'http://192.168.1.20:3000',
  auth: { modes: ['device'], clerk: null },
  pairing: { enabled: true },
});
const withModes = (modes: string[]): Discovery => ({ ...PAIRED, auth: { ...PAIRED.auth, modes } });
const pairingOff: Discovery = { ...PAIRED, pairing: { ...PAIRED.pairing, enabled: false } };

describe('ownDiscoveryRefusal', () => {
  it('takes a server that signs phones in by pairing, with pairing on', () => {
    expect(ownDiscoveryRefusal(PAIRED)).toBeNull();
    expect(ownDiscoveryRefusal(withModes(['clerk', 'device']))).toBeNull();
  });

  it("refuses one without 'device' in auth.modes, whatever its pairing says", () => {
    expect(ownDiscoveryRefusal(withModes(['clerk']))).toBe('no_device');
    expect(ownDiscoveryRefusal({ ...pairingOff, auth: { ...PAIRED.auth, modes: [] } })).toBe(
      'no_device',
    );
  });

  it('says when its operator turned pairing off', () => {
    expect(ownDiscoveryRefusal(pairingOff)).toBe('pairing_off');
  });
});

describe('isNotRunning', () => {
  it('is no answer at all, or a gateway in front of it that cannot reach it', () => {
    expect(isNotRunning(new ApiError('network'))).toBe(true);
    for (const status of NOT_RUNNING_GATEWAY_STATUSES) {
      expect(isNotRunning(new ApiError('server', { status }))).toBe(true);
    }
  });

  it('is not a server that answers, even with an error (503 is the server itself)', () => {
    expect(isNotRunning(new ApiError('server', { status: 503 }))).toBe(false);
    expect(isNotRunning(new ApiError('server', { status: 500 }))).toBe(false);
    expect(isNotRunning(new ApiError('not_found', { status: 404 }))).toBe(false);
    expect(isNotRunning(new Error('network'))).toBe(false);
  });
});

describe('isWithoutDiscovery', () => {
  it('is a 404 for the document, and nothing else', () => {
    expect(isWithoutDiscovery(new ApiError('not_found', { status: 404 }))).toBe(true);
    expect(isWithoutDiscovery(new ApiError('server', { status: 500 }))).toBe(false);
    expect(isWithoutDiscovery(null)).toBe(false);
  });
});
