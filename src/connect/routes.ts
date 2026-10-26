// The connect wave's route table (KC3): every server path connecting to your own server calls, as
// {method, path}. Discovery and GET /api/workspaces/current stay the foundation's (src/api/routes.ts).
// scripts/check-routes.ts checks each entry against the pinned route manifest; PRD-266 W1
// (api/mobile_devices.py) serves all three.

import type { Route } from '../api/routes';

export const CONNECT_ROUTES = Object.freeze({
  /** PUBLIC: a one-time pairing code for a device token, returned exactly once (PRD-266 §4.3). */
  pair: { method: 'POST', path: '/api/v1/mobile/pair' },
  /** The device lane, on its own device: a new token once; the old one lives on briefly. */
  rotate: { method: 'POST', path: '/api/v1/mobile/devices/{device_id}/rotate' },
  /** Revokes this phone's own device row (Remove this phone); it deletes no account (D63). */
  removeDevice: { method: 'DELETE', path: '/api/v1/mobile/devices/{device_id}' },
} as const satisfies Record<string, Route>);
