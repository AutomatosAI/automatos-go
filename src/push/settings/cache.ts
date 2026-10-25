// What the Notifications screen's cached reads become once a write has succeeded, pure: the server
// answered, so the cache shows what it now holds without a second read. A preference PUT answers
// only a count, so the named events' rows are replaced by exactly the rows sent (KP12: the PUT
// replaced all of them); a digest time PATCH answers the device row, which takes its place. The
// cached values are never changed: every answer is a new object.

import type { Device, Devices, Preferences } from '../schemas/server';
import { setPushType } from './prefs';

/** GET's answer after a PUT turned those events' push on or off. */
export function preferencesAfter(
  response: Preferences,
  events: readonly string[],
  enabled: boolean,
): Preferences {
  const named = new Set(events);
  const kept = response.preferences.filter((row) => !named.has(row.event_type));
  return {
    ...response,
    preferences: [...kept, ...setPushType(response.preferences, events, enabled)],
  };
}

/** GET /devices's answer with one row as the server now has it. */
export function devicesWith(response: Devices, device: Device): Devices {
  return {
    ...response,
    devices: response.devices.map((row) => (row.id === device.id ? device : row)),
  };
}
