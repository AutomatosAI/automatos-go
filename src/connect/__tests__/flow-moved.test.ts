// The connect flow when a server asked at its http address says it has moved to its own https one
// (flow.ts `moved`, https-twin.ts): checking starts again at the https address, once at most, and
// the card still waits for Pair (KC8).

import { describe, expect, it } from 'vitest';

import { DiscoverySchema, type Discovery } from '../../api/discovery';
import { connectReducer, startConnect, type ConnectAction, type ConnectState } from '../flow';

const LAN = 'http://192.168.1.20:8000';
const TWIN = 'https://192.168.1.20';
const HTTP_TYPED = Object.freeze({ origin: LAN, code: 'abcd efgh' });

function run(start: ConnectState, ...actions: readonly ConnectAction[]): ConnectState {
  return actions.reduce((state, action) => connectReducer(state, action), start);
}

function local(): Discovery {
  return DiscoverySchema.parse({
    schema: 'automatos-discovery/v1',
    name: 'Automatos',
    edition: 'local',
    api_url: TWIN,
    web_url: 'https://192.168.1.20:3000',
    auth: { modes: ['device'], clerk: null },
    pairing: { enabled: true },
    push: { expo: false },
    capabilities: [],
  });
}

const discovered = (origin: string): ConnectAction => ({
  type: 'discovered',
  origin,
  discovery: local(),
  next: 'pair',
});

const CHECKING = run(startConnect(), { type: 'submit', ...HTTP_TYPED });
const MOVED = run(CHECKING, { type: 'moved', origin: LAN, to: TWIN });

describe('a server that has moved to its https address', () => {
  it('is checked again at that address, no longer insecure, with the code kept', () => {
    expect(CHECKING).toMatchObject({ step: 'checking', origin: LAN, insecure: true });
    expect(MOVED).toEqual({
      step: 'checking',
      origin: TWIN,
      insecure: false,
      code: 'ABCD-EFGH',
      fields: { origin: TWIN, code: HTTP_TYPED.code },
    });
    expect(Object.isFrozen(MOVED)).toBe(true);
  });

  it('then reaches the card with the https address on it, and still waits for Pair (KC8)', () => {
    const card = run(MOVED, discovered(TWIN));
    expect(card).toMatchObject({ step: 'confirm', origin: TWIN, insecure: false });
    expect(run(MOVED, discovered(LAN))).toBe(MOVED);
  });

  it('moves once at most: from https there is nowhere to move', () => {
    const again: ConnectAction = {
      type: 'moved',
      origin: TWIN,
      to: 'https://elsewhere.example.test',
    };
    expect(run(MOVED, again)).toBe(MOVED);
  });

  it('ignores a move for another origin, to another host, to http, or to no address', () => {
    const moves: readonly ConnectAction[] = [
      { type: 'moved', origin: 'http://192.168.1.99', to: TWIN },
      { type: 'moved', origin: LAN, to: 'https://elsewhere.example.test' },
      { type: 'moved', origin: LAN, to: 'https://192.168.1.21' },
      { type: 'moved', origin: LAN, to: 'http://192.168.1.20' },
      { type: 'moved', origin: LAN, to: 'not an address' },
      { type: 'moved', origin: LAN, to: `${TWIN}/login` },
    ];
    for (const move of moves) expect(run(CHECKING, move), JSON.stringify(move)).toBe(CHECKING);
  });

  it('Back from the moved check returns to the form with the https address in it', () => {
    expect(run(MOVED, { type: 'back' })).toMatchObject({ step: 'enter', origin: TWIN });
  });

  it('applies only while checking', () => {
    const start = startConnect();
    expect(run(start, { type: 'moved', origin: LAN, to: TWIN })).toBe(start);
  });
});
