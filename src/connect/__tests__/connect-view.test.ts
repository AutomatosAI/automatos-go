// What Welcome and Connect show (US-006f): Welcome's choices, the fields and the code as XXXX-XXXX,
// Continue, the confirm card in words (KC5, KC16, D-HTTPS), every failure's copy and its way on,
// and when a remounted Connect goes home. States come from the real step machine (flow.ts).

import { describe, expect, it } from 'vitest';

import { DiscoverySchema, type Discovery } from '../../api/discovery';
import { authorityOf, withoutToken } from '../confirm';
import { ownServerOf, type OwnServer } from '../current-server';
import {
  connectReducer,
  startConnect,
  type ConnectAction,
  type ConnectState,
  type PairFailure,
} from '../flow';
import type { DiscoveryFailure, NextStep } from '../next-step';
import {
  codeDisplay,
  connectLanding,
  connectView,
  fieldErrorCopy,
  fieldsView,
  prefillKey,
  welcomeView,
  type ConfirmView,
  type ConnectView,
  type FormView,
} from '../screens/connect-view';
import {
  ADDRESS_COPY,
  CONFIRM_COPY,
  CONNECT_FAILURE_COPY,
  DATA_NOTE_OWN_SERVER,
  INSECURE_NOTE_COPY,
  PAIR_CODE_COPY,
  WELCOME_COPY,
  dataNoteFor,
} from '../strings';
import { OTHER_RECORD, RECORD } from './paired-record';

const LAN = 'http://192.168.1.20:8000';
const HTTPS = 'https://automatos.example.com';
const TYPED = Object.freeze({ origin: '192.168.1.20:8000', code: 'abcd efgh' });
const LAN_TYPED = Object.freeze({ origin: LAN, code: 'abcd efgh' });

const DOCUMENT = {
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

function document(overrides: Record<string, unknown> = {}): Discovery {
  return DiscoverySchema.parse({ ...DOCUMENT, ...overrides });
}

function run(start: ConnectState, ...actions: readonly ConnectAction[]): ConnectState {
  return actions.reduce(connectReducer, start);
}

const ON = { hostedSignIn: true };
const OFF = { hostedSignIn: false };
const viewOf = (state: ConnectState, options = ON): ConnectView => connectView(state, options);

function asForm(view: ConnectView): FormView {
  if (view.screen !== 'form') throw new Error(`expected the form, got ${view.screen}`);
  return view;
}

function asConfirm(view: ConnectView): ConfirmView {
  if (view.screen !== 'confirm') throw new Error(`expected the card, got ${view.screen}`);
  return view;
}

const submitted = (fields: { origin: string; code: string } = LAN_TYPED): ConnectAction => ({
  type: 'submit',
  ...fields,
});
const discovered = (
  discovery = document(),
  origin = LAN,
  next: NextStep = 'pair',
): ConnectAction => ({
  type: 'discovered',
  origin,
  discovery,
  next,
});

const CHECKING = run(startConnect(), submitted());
const CONFIRM = run(CHECKING, discovered());
const PAIRING = run(CONFIRM, { type: 'confirm' });
const pairFailed = (kind: PairFailure) => run(PAIRING, { type: 'pairFailed', kind });
const checkFailed = (kind: DiscoveryFailure) =>
  run(CHECKING, { type: 'discoveryFailed', origin: LAN, kind });

describe('welcomeView', () => {
  it('waits while the session is read, and leaves for home once signed in', () => {
    expect(welcomeView({ isLoaded: false, isSignedIn: false, hostedSignIn: true })).toEqual({
      kind: 'loading',
    });
    expect(welcomeView({ isLoaded: true, isSignedIn: true, hostedSignIn: true })).toEqual({
      kind: 'home',
    });
  });

  it('offers both choices in a build that can sign in', () => {
    expect(welcomeView({ isLoaded: true, isSignedIn: false, hostedSignIn: true })).toEqual({
      kind: 'choices',
      signInEnabled: true,
      signInNote: null,
    });
  });

  it('disables hosted sign-in in a build without it, and says so', () => {
    const view = welcomeView({ isLoaded: true, isSignedIn: false, hostedSignIn: false });
    expect(view).toEqual({
      kind: 'choices',
      signInEnabled: false,
      signInNote: 'Sign-in is not configured in this build',
    });
    expect(WELCOME_COPY.signIn).toBe('Sign in to Automatos');
    expect(WELCOME_COPY.connect).toBe('Connect to your own server');
  });
});

describe('codeDisplay: XXXX-XXXX while typing, capitals', () => {
  it.each([
    ['', ''],
    ['a', 'A'],
    ['abcd', 'ABCD'],
    ['abcde', 'ABCD-E'],
    ['abcdefgh', 'ABCD-EFGH'],
    ['ab cd ef gh', 'ABCD-EFGH'],
    ['ABCD-EFGH', 'ABCD-EFGH'],
    ['abcd--efgh', 'ABCD-EFGH'],
    // backspace over the hyphen: the field hands back 'ABCD-'
    ['ABCD-', 'ABCD'],
    // nothing is dropped, so Continue can say why
    ['abc0', 'ABC0'],
    ['abcdefghij', 'ABCD-EFGHIJ'],
    ['straße', 'STRA-ßE'],
  ])('%j → %j', (typed, shown) => {
    expect(codeDisplay(typed)).toBe(shown);
  });

  it('is stable: showing what it shows changes nothing', () => {
    for (const typed of ['abcdefgh', 'ab', 'a-b c-d e']) {
      expect(codeDisplay(codeDisplay(typed))).toBe(codeDisplay(typed));
    }
  });
});

describe('the fields', () => {
  it('words each refusal from US-006a', () => {
    expect(fieldErrorCopy({ origin: 'http_public', code: 'alphabet' })).toEqual({
      origin: ADDRESS_COPY.http_public,
      code: PAIR_CODE_COPY.alphabet,
    });
    expect(fieldErrorCopy(undefined)).toEqual({});
  });

  it('can continue only with both fields and nothing being checked', () => {
    expect(fieldsView(TYPED, undefined, false).canContinue).toBe(true);
    expect(fieldsView(TYPED, undefined, true).canContinue).toBe(false);
    expect(fieldsView({ origin: TYPED.origin }, undefined, false).canContinue).toBe(false);
    expect(fieldsView({ origin: '  ', code: TYPED.code }, undefined, false).canContinue).toBe(
      false,
    );
    expect(fieldsView({}, undefined, false)).toEqual({
      origin: '',
      codeDisplay: '',
      fieldErrors: {},
      canContinue: false,
    });
  });

  it('shows the code as typed, in capitals with the hyphen', () => {
    expect(fieldsView(TYPED, undefined, false).codeDisplay).toBe('ABCD-EFGH');
  });
});

describe('connectView: the form', () => {
  it('opens empty, nothing to continue with', () => {
    expect(viewOf(startConnect())).toEqual({
      screen: 'form',
      origin: '',
      codeDisplay: '',
      fieldErrors: {},
      canContinue: false,
      checking: false,
      failure: null,
      offerSignIn: false,
    });
  });

  it('shows the field errors a refused Continue gave', () => {
    const refused = run(startConnect(), submitted({ origin: 'http://8.8.8.8', code: 'abc' }));
    expect(asForm(viewOf(refused)).fieldErrors).toEqual({
      origin: ADDRESS_COPY.http_public,
      code: PAIR_CODE_COPY.length,
    });
  });

  it('a prefill with both fields opens checking: busy, the fields as given', () => {
    const view = asForm(viewOf(startConnect(TYPED)));
    expect(view).toMatchObject({ checking: true, canContinue: false, origin: TYPED.origin });
    expect(view.codeDisplay).toBe('ABCD-EFGH');
  });

  it.each(['unreachable', 'no_discovery', 'not_automatos', 'discovery_failed'] as const)(
    'a failed check (%s) stays on the form with its copy, and Continue can try again',
    (kind) => {
      const failed = checkFailed(kind);
      const view = asForm(viewOf(failed));
      expect(view).toMatchObject({ failure: CONNECT_FAILURE_COPY[kind], canContinue: true });
      expect(run(failed, submitted())).toEqual(CHECKING);
    },
  );

  it.each(['pairing_off', 'unsupported'] as const)('next step %s: its copy on the form', (next) => {
    const failed = run(CHECKING, discovered(document(), LAN, next));
    expect(asForm(viewOf(failed))).toMatchObject({
      failure: CONNECT_FAILURE_COPY[next],
      offerSignIn: false,
    });
  });

  it('the hosted server offers Sign in to Automatos instead, when this build can', () => {
    const failed = run(CHECKING, discovered(document(), LAN, 'hosted'));
    expect(asForm(viewOf(failed, ON))).toMatchObject({
      failure: CONNECT_FAILURE_COPY.hosted,
      offerSignIn: true,
    });
    expect(asForm(viewOf(failed, OFF)).offerSignIn).toBe(false);
  });
});

describe('connectView: the confirm card (KC5, KC8, KC16)', () => {
  it('names the server, its edition in words and the address that answered', () => {
    expect(asConfirm(viewOf(CONFIRM))).toEqual({
      screen: 'confirm',
      card: {
        serverName: 'Automatos',
        edition: 'Self-hosted',
        address: LAN,
        listedAddress: null,
        insecureNote: INSECURE_NOTE_COPY,
        dataNote: dataNoteFor('192.168.1.20:8000'),
      },
      pairing: false,
      failure: null,
      primaryLabel: CONFIRM_COPY.pair,
      primaryAction: 'confirm',
      showBack: true,
    });
  });

  it('shows the address the server lists only when it names another one', () => {
    const behindProxy = run(CHECKING, discovered(document({ api_url: 'http://10.0.0.5:8000' })));
    expect(asConfirm(viewOf(behindProxy)).card).toMatchObject({
      address: LAN,
      listedAddress: 'http://10.0.0.5:8000',
    });
    const sameWithSlash = run(CHECKING, discovered(document({ api_url: `${LAN}/` })));
    expect(asConfirm(viewOf(sameWithSlash)).card.listedAddress).toBeNull();
  });

  it('has the unencrypted home network note only over http (D-HTTPS), in words', () => {
    const https = run(startConnect(), submitted({ origin: HTTPS, code: 'ABCD-EFGH' }));
    const card = asConfirm(viewOf(run(https, discovered(document({ api_url: HTTPS }), HTTPS))));
    expect(card.card.insecureNote).toBeNull();
    expect(INSECURE_NOTE_COPY.title).toBe('Unencrypted home network');
    expect(INSECURE_NOTE_COPY.message).toMatch(/not encrypted/);
  });

  it('shows an edition this version has no words for as the server sent it', () => {
    const other = run(CHECKING, discovered(document({ edition: 'enterprise' })));
    expect(asConfirm(viewOf(other)).card.edition).toBe('enterprise');
  });

  it("carries KC16's data note word for word, the server filled in", () => {
    expect(DATA_NOTE_OWN_SERVER).toBe(
      "Your chats, files and reports stay on {server}. Automatos Go itself sends crash reports to Automatos, checks Expo for app updates and, if this server's operator agrees, sends notifications through Expo and Apple or Google.",
    );
    expect(asConfirm(viewOf(CONFIRM)).card.dataNote).toBe(
      "Your chats, files and reports stay on 192.168.1.20:8000. Automatos Go itself sends crash reports to Automatos, checks Expo for app updates and, if this server's operator agrees, sends notifications through Expo and Apple or Google.",
    );
    expect(authorityOf(HTTPS)).toBe('automatos.example.com');
  });

  it('locks the card while POST /pair runs', () => {
    expect(asConfirm(viewOf(PAIRING))).toMatchObject({
      pairing: true,
      failure: null,
      primaryLabel: CONFIRM_COPY.pair,
      showBack: false,
    });
  });

  const RETRYABLE: readonly PairFailure[] = [
    'pairing_off',
    'too_many',
    'busy',
    'unreachable',
    'invalid_response',
    'refused',
    'keychain',
  ];

  it.each(RETRYABLE)(
    'a failed pairing (%s) keeps the card: its copy, Try again and Back',
    (kind) => {
      expect(asConfirm(viewOf(pairFailed(kind)))).toMatchObject({
        pairing: false,
        failure: CONNECT_FAILURE_COPY[kind],
        primaryLabel: CONFIRM_COPY.tryAgain,
        primaryAction: 'confirm',
        showBack: true,
      });
    },
  );

  it.each(['bad_code', 'not_saved'] as const)(
    'a code that cannot work again (%s): its copy and Enter a new code, back to the fields',
    (kind) => {
      const failed = pairFailed(kind);
      expect(asConfirm(viewOf(failed))).toMatchObject({
        failure: CONNECT_FAILURE_COPY[kind],
        primaryLabel: CONFIRM_COPY.newCode,
        primaryAction: 'back',
        showBack: false,
      });
      expect(run(failed, { type: 'back' })).toEqual({ step: 'enter', ...LAN_TYPED });
    },
  );
});

describe('connectView: connected', () => {
  it('has nothing to show: the screen goes home', () => {
    const record = withoutToken({ ...RECORD, origin: LAN });
    const connected = run(PAIRING, { type: 'paired', record });
    expect(viewOf(connected)).toEqual({ screen: 'connected' });
  });
});

describe('connectLanding: a remounted Connect goes home', () => {
  const own: OwnServer = ownServerOf(RECORD);

  it('stays when no own server is signed in (Welcome, the gate, the hosted server)', () => {
    expect(connectLanding({ own: null, isSignedIn: true, prefill: {} })).toBe(false);
    expect(connectLanding({ own, isSignedIn: false, prefill: {} })).toBe(false);
  });

  it('goes home once a pairing typed here, or the gate prefilled, is signed in', () => {
    expect(connectLanding({ own, isSignedIn: true, prefill: {} })).toBe(true);
    expect(connectLanding({ own, isSignedIn: true, prefill: { origin: HTTPS } })).toBe(true);
  });

  it('goes home after pairing from a link or scan, whatever form its address took', () => {
    for (const origin of [RECORD.origin, 'HTTP://192.168.1.20:8000/']) {
      expect(
        connectLanding({ own, isSignedIn: true, prefill: { origin, code: 'ABCD-EFGH' } }),
      ).toBe(true);
    }
  });

  it('stays for a link or scan to another server: that is a switch the person said yes to', () => {
    const prefill = { origin: OTHER_RECORD.origin, code: 'ABCD-EFGH' };
    expect(connectLanding({ own, isSignedIn: true, prefill })).toBe(false);
    expect(connectLanding({ own, isSignedIn: true, prefill: { origin: 'nope', code: 'X' } })).toBe(
      false,
    );
  });

  it('starts the flow again for a new prefill', () => {
    expect(prefillKey({})).toBe(prefillKey({}));
    expect(prefillKey({ origin: LAN, code: 'A' })).not.toBe(prefillKey({ origin: LAN, code: 'B' }));
    expect(prefillKey({ origin: 'a', code: '' })).not.toBe(prefillKey({ origin: '', code: 'a' }));
  });
});
