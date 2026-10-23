// The connect step machine (US-006e): every transition, each nextStepFor branch, KC5's reached
// origin, KC8's confirm-before-pair. Every state and action is deep-frozen before it is reduced,
// so any mutation throws.

import { describe, expect, it } from 'vitest';

import { DiscoverySchema, hostedDefaults, type Discovery } from '../../api/discovery';
import { ApiError } from '../../api/errors';
import { hostedServerFrom, ownServerFrom } from '../../api/server';
import type { PairRefusal } from '../api';
import { withoutToken, type ConnectedRecord } from '../confirm';
import {
  connectReducer,
  startConnect,
  typedFields,
  type ConnectAction,
  type ConnectState,
  type PairFailure,
} from '../flow';
import {
  discoveryFailureFor,
  discoveryServerFor,
  isSameOrigin,
  nextStepFor,
  type NextStep,
} from '../next-step';
import { RECORD } from './paired-record';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Every step deep-frozen: state and action both. */
function run(start: ConnectState, ...actions: readonly ConnectAction[]): ConnectState {
  return actions.reduce(
    (state, action) => connectReducer(deepFreeze(state), deepFreeze(action)),
    deepFreeze(start),
  );
}

const LAN = 'http://192.168.1.20:8000';
const HTTPS = 'https://automatos.example.com';
const HOSTED_API = 'https://api.automatos.app';
const HTTP_TYPED = Object.freeze({ origin: 'http://192.168.1.20:8000', code: 'abcd efgh' });

const LOCAL_DOCUMENT = {
  schema: 'automatos-discovery/v1',
  name: 'Automatos',
  edition: 'local',
  api_url: LAN,
  web_url: 'http://192.168.1.20:3000',
  auth: { modes: ['device'], clerk: null },
  pairing: { enabled: true },
  push: { expo: false },
  capabilities: [],
};

function local(overrides: Record<string, unknown> = {}): Discovery {
  return DiscoverySchema.parse({ ...LOCAL_DOCUMENT, ...overrides });
}

function modes(list: readonly string[], enabled = true): Discovery {
  return local({ auth: { modes: list, clerk: null }, pairing: { enabled } });
}

const submitted = (fields: { origin: string; code: string } = HTTP_TYPED): ConnectAction => ({
  type: 'submit',
  origin: fields.origin,
  code: fields.code,
});
const discovered = (
  discovery: Discovery = local(),
  origin = LAN,
  next: NextStep = 'pair',
): ConnectAction => ({ type: 'discovered', origin, discovery, next });

const CHECKING = run(startConnect(), submitted());
const CONFIRM = run(CHECKING, discovered());
const PAIRING = run(CONFIRM, { type: 'confirm' });
const CONNECTED_RECORD: ConnectedRecord = withoutToken({ ...RECORD, origin: LAN });

/** Every action, for "does not apply" sweeps. */
const EVERY_ACTION: readonly ConnectAction[] = [
  { type: 'edit', field: 'origin', value: 'x' },
  submitted(),
  discovered(),
  { type: 'discoveryFailed', origin: LAN, kind: 'unreachable' },
  { type: 'confirm' },
  { type: 'back' },
  { type: 'paired', record: CONNECTED_RECORD },
  { type: 'pairFailed', kind: 'busy' },
];

function unchangedBy(state: ConnectState, applies: readonly ConnectAction['type'][]) {
  for (const action of EVERY_ACTION.filter((each) => !applies.includes(each.type))) {
    expect(run(state, action), action.type).toBe(state);
  }
}

describe('nextStepFor (KC15)', () => {
  it("pairs when 'device' is offered and pairing is on", () => {
    expect(nextStepFor(modes(['device']), LAN, HOSTED_API)).toBe('pair');
  });

  it("says pairing is off when 'device' is offered with pairing off", () => {
    expect(nextStepFor(modes(['device'], false), LAN, HOSTED_API)).toBe('pairing_off');
  });

  it("sends the build's own hosted API to sign-in", () => {
    const hosted = hostedServerFrom({ apiUrl: HOSTED_API, webUrl: '' });
    if (!hosted) throw new Error('no hosted server');
    expect(nextStepFor(hostedDefaults(hosted), HOSTED_API, HOSTED_API)).toBe('hosted');
    expect(nextStepFor(modes(['clerk']), HOSTED_API, `${HOSTED_API}/`)).toBe('hosted');
  });

  it('is unsupported for a Clerk server that is not the built-in one (D1)', () => {
    expect(nextStepFor(modes(['clerk']), HTTPS, HOSTED_API)).toBe('unsupported');
    expect(nextStepFor(modes(['clerk']), HOSTED_API, null)).toBe('unsupported');
  });

  it("is unsupported for 'oidc' (PRD-257's step goes here), unknown modes and none", () => {
    for (const list of [['oidc'], ['saml-2030'], []]) {
      expect(nextStepFor(modes(list), HTTPS, HOSTED_API)).toBe('unsupported');
    }
  });

  it('pairs a server that offers device beside other modes', () => {
    expect(nextStepFor(modes(['oidc', 'device']), HTTPS, HOSTED_API)).toBe('pair');
  });
});

describe('discoveryServerFor and discoveryFailureFor', () => {
  it('reads an own server at the origin, and the built-in one as itself (K3)', () => {
    expect(discoveryServerFor(LAN, null)).toEqual(ownServerFrom({ origin: LAN, webUrl: '' }));
    const hosted = hostedServerFrom({ apiUrl: HOSTED_API, webUrl: 'https://ui.automatos.app' });
    expect(discoveryServerFor(HOSTED_API, hosted)).toBe(hosted);
    expect(discoveryServerFor(HTTPS, hosted).source).toBe('own');
  });

  it('compares origins under the address rules', () => {
    expect(isSameOrigin('HTTPS://Automatos.Example.com:443/', HTTPS)).toBe(true);
    expect(isSameOrigin(`${HTTPS}/api`, HTTPS)).toBe(false);
    expect(isSameOrigin('not an address', HTTPS)).toBe(false);
  });

  it('names each failure', () => {
    expect(discoveryFailureFor(new ApiError('network'))).toBe('unreachable');
    expect(discoveryFailureFor(new ApiError('server', { status: 502 }))).toBe('unreachable');
    expect(discoveryFailureFor(new ApiError('not_found', { status: 404 }))).toBe('no_discovery');
    expect(discoveryFailureFor(new ApiError('invalid_response'))).toBe('not_automatos');
    expect(discoveryFailureFor(new ApiError('server', { status: 500 }))).toBe('discovery_failed');
    expect(discoveryFailureFor(new Error('boom'))).toBe('discovery_failed');
  });
});

describe('enter', () => {
  it('opens empty, or with the fields a prefill carried', () => {
    expect(startConnect()).toEqual({ step: 'enter' });
    expect(startConnect({ origin: LAN })).toEqual({ step: 'enter', origin: LAN });
  });

  it('keeps each field as typed and clears only that field’s error', () => {
    const refused = run(startConnect(), submitted({ origin: 'http://8.8.8.8', code: 'O0' }));
    expect(refused).toMatchObject({ error: { origin: 'http_public', code: 'length' } });
    const typed = run(refused, { type: 'edit', field: 'code', value: 'ABCD' });
    expect(typed).toEqual({
      step: 'enter',
      origin: 'http://8.8.8.8',
      code: 'ABCD',
      error: { origin: 'http_public' },
    });
    const both = run(typed, { type: 'edit', field: 'origin', value: LAN });
    expect(both).toEqual({ step: 'enter', origin: LAN, code: 'ABCD' });
  });

  it('refuses Continue with each field’s reason and reads nothing', () => {
    expect(run(startConnect(), submitted({ origin: '', code: '' }))).toEqual({
      step: 'enter',
      origin: '',
      code: '',
      error: { origin: 'empty', code: 'empty' },
    });
    expect(run(startConnect(), submitted({ origin: 'localhost', code: 'ABCDEFGH' }))).toEqual({
      step: 'enter',
      origin: 'localhost',
      code: 'ABCDEFGH',
      error: { origin: 'loopback' },
    });
  });

  it('goes to checking with the parsed origin and the canonical code', () => {
    expect(
      run(startConnect(), submitted({ origin: 'Automatos.Example.com', code: 'abcdefgh' })),
    ).toEqual({
      step: 'checking',
      origin: HTTPS,
      insecure: false,
      code: 'ABCD-EFGH',
      fields: { origin: 'Automatos.Example.com', code: 'abcdefgh' },
    });
  });

  it('ignores every other action', () => {
    unchangedBy(startConnect({ origin: LAN }), ['edit', 'submit']);
  });
});

describe('checking', () => {
  it('carries insecure for a home network over http (D-HTTPS)', () => {
    expect(CHECKING).toMatchObject({ step: 'checking', origin: LAN, insecure: true });
  });

  it('goes to confirm when the next step is pair', () => {
    expect(CONFIRM).toEqual({
      step: 'confirm',
      fields: HTTP_TYPED,
      origin: LAN,
      insecure: true,
      serverName: 'Automatos',
      edition: 'local',
      webUrl: 'http://192.168.1.20:3000',
      apiUrlDiffers: false,
      documentApiUrl: LAN,
      pushExpo: false,
      code: 'ABCD-EFGH',
    });
  });

  it.each(['pairing_off', 'hosted', 'unsupported'] as const)(
    'fails with %s when that is the next step',
    (next) => {
      expect(run(CHECKING, discovered(local(), LAN, next))).toEqual({
        step: 'failed',
        kind: next,
        fields: HTTP_TYPED,
        details: null,
      });
    },
  );

  it.each(['unreachable', 'no_discovery', 'not_automatos', 'discovery_failed'] as const)(
    'fails with %s when discovery does',
    (kind) => {
      const state = run(CHECKING, { type: 'discoveryFailed', origin: LAN, kind });
      expect(state).toEqual({ step: 'failed', kind, fields: HTTP_TYPED, details: null });
    },
  );

  it('ignores an answer for another origin (a check Back left behind)', () => {
    expect(run(CHECKING, discovered(local(), HTTPS))).toBe(CHECKING);
    expect(run(CHECKING, { type: 'discoveryFailed', origin: HTTPS, kind: 'unreachable' })).toBe(
      CHECKING,
    );
  });

  it('goes back to the fields as typed', () => {
    expect(run(CHECKING, { type: 'back' })).toEqual({ step: 'enter', ...HTTP_TYPED });
  });

  it('ignores every other action', () => {
    unchangedBy(CHECKING, ['discovered', 'discoveryFailed', 'back']);
  });
});

describe('confirm (KC5, KC8)', () => {
  it('keeps the reached origin when the document names another api_url', () => {
    const internal = local({ api_url: 'http://10.0.0.7:8000' });
    const state = run(CHECKING, discovered(internal));
    expect(state).toMatchObject({
      step: 'confirm',
      origin: LAN,
      apiUrlDiffers: true,
      documentApiUrl: 'http://10.0.0.7:8000',
    });
  });

  it('records push.expo and asks nothing about push (KC10)', () => {
    const state = run(CHECKING, discovered(local({ push: { expo: true } })));
    expect(state).toMatchObject({ step: 'confirm', pushExpo: true });
  });

  it('pairs only on confirm, with the card as it was', () => {
    expect(PAIRING).toEqual({ ...CONFIRM, step: 'pairing' });
  });

  it('goes back with the fields kept', () => {
    expect(run(CONFIRM, { type: 'back' })).toEqual({ step: 'enter', ...HTTP_TYPED });
    expect(typedFields(CONFIRM)).toEqual(HTTP_TYPED);
  });

  it('ignores every other action', () => {
    unchangedBy(CONFIRM, ['confirm', 'back']);
  });
});

describe('a prefill, a scan or a link stops at confirm (KC8)', () => {
  it('goes from a prefill with both fields to checking, then to confirm, and no further', () => {
    const opened = startConnect(HTTP_TYPED);
    expect(opened).toMatchObject({ step: 'checking', origin: LAN, insecure: true });
    const card = run(opened, discovered());
    expect(card.step).toBe('confirm');
    for (const action of EVERY_ACTION.filter((each) => !['confirm', 'back'].includes(each.type))) {
      expect(run(card, action).step).toBe('confirm');
    }
  });

  it('opens a prefill with only the server at the fields, nothing read', () => {
    expect(startConnect({ origin: LAN })).toEqual({ step: 'enter', origin: LAN });
  });

  it('shows a bad prefill as field errors', () => {
    expect(startConnect({ origin: 'http://203.0.113.9', code: 'ABCD-EFGH' })).toMatchObject({
      step: 'enter',
      error: { origin: 'http_public' },
    });
  });
});

describe('pairing', () => {
  it('is connected once the record is saved, and holds no token (KC9)', () => {
    const state = run(PAIRING, { type: 'paired', record: CONNECTED_RECORD });
    expect(state).toEqual({ step: 'connected', record: CONNECTED_RECORD });
    expect(JSON.stringify(state)).not.toContain('amd_');
  });

  it('keeps insecure from the card to the record', () => {
    const state = run(PAIRING, { type: 'paired', record: CONNECTED_RECORD });
    expect(state.step === 'connected' && state.record.insecure).toBe(true);
  });

  it('ignores a saved record for another server', () => {
    const other = { ...CONNECTED_RECORD, origin: HTTPS };
    expect(run(PAIRING, { type: 'paired', record: other })).toBe(PAIRING);
  });

  const REFUSALS: readonly PairRefusal[] = [
    'bad_code',
    'pairing_off',
    'too_many',
    'busy',
    'unreachable',
    'invalid_response',
    'refused',
  ];
  const FAILURES: readonly PairFailure[] = [...REFUSALS, 'keychain', 'not_saved'];

  it.each(FAILURES)('fails with %s, the card kept for Try again', (kind) => {
    const state = run(PAIRING, { type: 'pairFailed', kind });
    expect(state).toEqual({
      step: 'failed',
      kind,
      fields: HTTP_TYPED,
      details: { ...CONFIRM, step: undefined, fields: undefined },
    });
  });

  it('cannot be left while POST /pair is under way', () => {
    unchangedBy(PAIRING, ['paired', 'pairFailed']);
  });
});

describe('failed', () => {
  const PAIR_FAILED = run(PAIRING, { type: 'pairFailed', kind: 'busy' });
  const CHECK_FAILED = run(CHECKING, { type: 'discoveryFailed', origin: LAN, kind: 'unreachable' });

  it('tries the pairing again on confirm, from the card it failed on', () => {
    expect(run(PAIR_FAILED, { type: 'confirm' })).toEqual(PAIRING);
  });

  it('has no Try again before the card was shown', () => {
    expect(run(CHECK_FAILED, { type: 'confirm' })).toBe(CHECK_FAILED);
  });

  it('goes back, or on typing, to the fields as typed', () => {
    expect(run(PAIR_FAILED, { type: 'back' })).toEqual({ step: 'enter', ...HTTP_TYPED });
    expect(run(CHECK_FAILED, { type: 'edit', field: 'code', value: 'WXYZ' })).toEqual({
      step: 'enter',
      origin: HTTP_TYPED.origin,
      code: 'WXYZ',
    });
  });

  it('ignores every other action', () => {
    unchangedBy(PAIR_FAILED, ['back', 'edit', 'confirm']);
  });
});

describe('connected', () => {
  it('is the end: every action leaves it as it is', () => {
    const state = run(PAIRING, { type: 'paired', record: CONNECTED_RECORD });
    unchangedBy(state, []);
    expect(typedFields(state)).toEqual({});
  });
});
