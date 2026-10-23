// One X-Workspace-ID holder per server (US-006d): the same holder until the server changes, a fresh
// empty one for the next server, and clear() forgets the id and the holder with it.

import { describe, expect, it } from 'vitest';

import { hostedServerFrom, ownServerFrom, type Server } from '../../api/server';
import { createWorkspaceIdRegistry } from '../workspace-ids';

const HOSTED = hostedServerFrom({ apiUrl: 'https://api.example.test', webUrl: '' }) as Server;
const OWN = ownServerFrom({ origin: 'http://192.168.1.20:8000', webUrl: '' });
const OTHER_OWN = ownServerFrom({ origin: 'https://automatos.example.com', webUrl: '' });
const ID = '11111111-1111-4111-8111-111111111111';

describe('the workspace-id registry', () => {
  it('hands out the same holder for the same server', () => {
    const registry = createWorkspaceIdRegistry();
    const held = registry.forServer(HOSTED);
    held.set(ID);
    expect(registry.forServer({ ...HOSTED })).toBe(held);
    expect(registry.forServer(HOSTED).get()).toBe(ID);
  });

  it("starts every other server empty and clears the last one's id", () => {
    const registry = createWorkspaceIdRegistry();
    const hosted = registry.forServer(HOSTED);
    hosted.set(ID);
    const own = registry.forServer(OWN);
    expect(own).not.toBe(hosted);
    expect(own.get()).toBeNull();
    expect(hosted.get()).toBeNull();
    expect(registry.forServer(OTHER_OWN).get()).toBeNull();
  });

  it('keys on the source as well as the address', () => {
    const registry = createWorkspaceIdRegistry();
    registry.forServer(HOSTED).set(ID);
    expect(registry.forServer({ ...HOSTED, source: 'own' }).get()).toBeNull();
  });

  it('clear() forgets the id and the holder: the next one for the same server starts empty', () => {
    const registry = createWorkspaceIdRegistry();
    const held = registry.forServer(OWN);
    held.set(ID);
    registry.clear();
    expect(held.get()).toBeNull();
    const next = registry.forServer(OWN);
    expect(next).not.toBe(held);
    // a bootstrap of the last session that lands now writes only its own, orphaned holder
    held.set(ID);
    expect(next.get()).toBeNull();
  });

  it('clear() with nothing held is harmless', () => {
    expect(() => createWorkspaceIdRegistry().clear()).not.toThrow();
  });
});
