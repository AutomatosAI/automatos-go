// The pairing link's and Connect's decisions (US-006g): a scan or a link opens Connect prefilled,
// asking first when this phone already uses another server, and Connect holds until the session
// has loaded to know whether to ask (connectEntry). Nothing here pairs: every way forward is
// Connect (KC8). The camera and the scan itself: camera-scan.test.ts.

import { describe, expect, it } from 'vitest';

import { hostedServerFrom } from '../../api/server';
import { connectPrefillFromParams, routes } from '../../navigation/routes';
import { ownServerOf } from '../current-server';
import { parsePairLink, type PairLink } from '../pair-link';
import {
  connectEntry,
  connectRouteFor,
  connectSwitchQuestion,
  prefillFor,
  pairLinkIntake,
  serverInUse,
  type ConnectEntryInput,
  type LinkIntakeInput,
} from '../scanner/scan-state';
import { PAIR_LINK_COPY, switchQuestionFor } from '../strings';
import { CODE, NEW_API, VALID, serverLink } from './pair-links';
import { OTHER_RECORD, RECORD } from './paired-record';

function linkOf(text: string): PairLink {
  return parsePairLink(text) ?? expect.fail(`not a pairing link: ${text}`);
}

const HOSTED = hostedServerFrom({
  apiUrl: 'https://api.automatos.example/',
  webUrl: 'https://ui.automatos.example',
});
const OWN = ownServerOf(RECORD);
const ownInUse = serverInUse({ own: OWN, hosted: HOSTED, isSignedIn: true });
const hostedInUse = serverInUse({ own: null, hosted: HOSTED, isSignedIn: true });

describe('connectRouteFor: a valid scan fills Connect and stops at confirm (KC8)', () => {
  it('hands Connect the server and the canonical code, nothing else', () => {
    expect(prefillFor(linkOf(serverLink('nas.local', 'abcd-efgh')))).toEqual({
      origin: 'https://nas.local',
      code: CODE,
    });
  });

  it('opens Connect with the server and the canonical code, nothing else', () => {
    const route = connectRouteFor(linkOf(serverLink('http://192.168.1.20:8000', 'abcdefgh')));
    expect(route).toBe(`${routes.connect}?origin=http%3A%2F%2F192.168.1.20%3A8000&code=${CODE}`);
  });

  it("is read back by Connect's route as the same prefill", () => {
    const [path, query] = connectRouteFor(linkOf(VALID)).split('?');
    const params: Record<string, string> = Object.fromEntries(
      query.split('&').map((pair) => pair.split('=').map(decodeURIComponent)),
    );
    expect(path).toBe(routes.connect);
    expect(connectPrefillFromParams(params)).toEqual({ origin: NEW_API, code: CODE });
  });
});

describe('serverInUse: the server this phone uses now', () => {
  it('is the paired own server, named by its address', () => {
    expect(serverInUse({ own: OWN, hosted: HOSTED, isSignedIn: true })).toEqual({
      apiUrl: RECORD.origin,
      label: '192.168.1.20:8000',
    });
  });

  it('is the hosted server only while signed in to it', () => {
    expect(serverInUse({ own: null, hosted: HOSTED, isSignedIn: true })).toEqual({
      apiUrl: 'https://api.automatos.example',
      label: PAIR_LINK_COPY.hostedServer,
    });
    expect(serverInUse({ own: null, hosted: HOSTED, isSignedIn: false })).toBeNull();
    expect(serverInUse({ own: null, hosted: null, isSignedIn: false })).toBeNull();
  });
});

describe('pairLinkIntake: what an opened pairing link does', () => {
  const input = (overrides: Partial<LinkIntakeInput>): LinkIntakeInput => ({
    link: linkOf(VALID),
    isLoaded: true,
    isSignedIn: false,
    inUse: null,
    ...overrides,
  });

  it('waits while the session is read', () => {
    expect(pairLinkIntake(input({ isLoaded: false }))).toEqual({ kind: 'loading' });
  });

  it('connected nowhere: straight to Connect, prefilled', () => {
    expect(pairLinkIntake(input({}))).toEqual({
      kind: 'connect',
      connect: connectRouteFor(linkOf(VALID)),
    });
  });

  it('asks first on a phone with its own server, and changes nothing but the way to Connect', () => {
    expect(pairLinkIntake(input({ isSignedIn: true, inUse: ownInUse }))).toEqual({
      kind: 'ask',
      question: {
        title: PAIR_LINK_COPY.switchTitle,
        message: "You're connected to 192.168.1.20:8000. Connect to automatos.example.com instead?",
        note: PAIR_LINK_COPY.switchNote,
        connectLabel: PAIR_LINK_COPY.switchConnect,
        stayLabel: PAIR_LINK_COPY.switchStay,
      },
      prefill: { origin: NEW_API, code: CODE },
      stay: routes.home,
    });
  });

  it('asks first on a phone signed in to the hosted server', () => {
    const intake = pairLinkIntake(input({ isSignedIn: true, inUse: hostedInUse }));
    expect(intake).toMatchObject({
      kind: 'ask',
      question: {
        message: "You're connected to Automatos. Connect to automatos.example.com instead?",
      },
    });
  });

  it('never puts the code in the question', () => {
    const intake = pairLinkIntake(input({ isSignedIn: true, inUse: ownInUse }));
    if (intake.kind !== 'ask') return expect.fail(intake.kind);
    expect(Object.values(intake.question).join(' ')).not.toContain(CODE);
  });

  it('goes home for a link to the server already in use: nothing to pair', () => {
    const sameOwn = serverInUse({ own: ownServerOf(OTHER_RECORD), hosted: null, isSignedIn: true });
    const ownLink = linkOf(serverLink(OTHER_RECORD.origin));
    expect(pairLinkIntake(input({ link: ownLink, isSignedIn: true, inUse: sameOwn }))).toEqual({
      kind: 'in_use',
      exit: routes.home,
    });
    const hostedLink = linkOf(serverLink('https://API.automatos.example:443'));
    expect(
      pairLinkIntake(input({ link: hostedLink, isSignedIn: true, inUse: hostedInUse })),
    ).toEqual({ kind: 'in_use', exit: routes.home });
  });

  it('shows the invalid-link copy, then goes home when signed in, else to Welcome', () => {
    expect(pairLinkIntake(input({ link: null }))).toEqual({
      kind: 'invalid',
      exit: routes.welcome,
    });
    expect(pairLinkIntake(input({ link: null, isSignedIn: true, inUse: ownInUse }))).toEqual({
      kind: 'invalid',
      exit: routes.home,
    });
  });
});

describe('the switch question in words', () => {
  it('is the question US-006g gives', () => {
    expect(PAIR_LINK_COPY.switchQuestion).toBe(
      "You're connected to {current}. Connect to {new} instead?",
    );
  });

  it('puts both servers in as plain text', () => {
    expect(switchQuestionFor('$&', "$'")).toBe("You're connected to $&. Connect to $' instead?");
  });
});

describe('connectSwitchQuestion: Connect asks first, whatever opened it (KC8)', () => {
  it('asks when a crafted automatos://connect link names another server on a paired phone', () => {
    expect(connectSwitchQuestion({ origin: 'https://evil.example', code: CODE }, ownInUse)).toEqual(
      {
        title: PAIR_LINK_COPY.switchTitle,
        message: "You're connected to 192.168.1.20:8000. Connect to evil.example instead?",
        note: PAIR_LINK_COPY.switchNote,
        connectLabel: PAIR_LINK_COPY.switchConnect,
        stayLabel: PAIR_LINK_COPY.switchStay,
      },
    );
  });

  it('asks on a phone signed in to the hosted server, with or without a code', () => {
    for (const prefill of [{ origin: 'nas.local', code: CODE }, { origin: 'nas.local' }]) {
      expect(connectSwitchQuestion(prefill, hostedInUse)?.message).toBe(
        "You're connected to Automatos. Connect to nas.local instead?",
      );
    }
  });

  it('asks for a scan too: its prefill is the same', () => {
    expect(connectSwitchQuestion(prefillFor(linkOf(VALID)), ownInUse)).not.toBeNull();
  });

  it('asks for the same host under another scheme (a bare address is https://), naming both', () => {
    expect(
      connectSwitchQuestion({ origin: '192.168.1.20:8000', code: CODE }, ownInUse)?.message,
    ).toBe(
      "You're connected to http://192.168.1.20:8000. Connect to https://192.168.1.20:8000 instead?",
    );
  });

  it('asks nothing when no server is in use', () => {
    expect(connectSwitchQuestion({ origin: NEW_API, code: CODE }, null)).toBeNull();
  });

  it('asks nothing for the server in use, however its address is written', () => {
    for (const origin of ['http://192.168.1.20:8000', 'HTTP://192.168.1.20:8000/']) {
      expect(connectSwitchQuestion({ origin, code: CODE }, ownInUse), origin).toBeNull();
    }
    expect(
      connectSwitchQuestion({ origin: 'api.automatos.example', code: CODE }, hostedInUse),
    ).toBeNull();
  });

  it('asks nothing without an address that could be one: the fields refuse it themselves', () => {
    for (const prefill of [
      {},
      { code: CODE },
      { origin: 'http://203.0.113.9' },
      { origin: 'localhost' },
    ]) {
      expect(connectSwitchQuestion(prefill, ownInUse), JSON.stringify(prefill)).toBeNull();
    }
  });
});

describe('connectEntry: Connect decides the question only once the session has loaded (KC8)', () => {
  const OTHER = 'https://other.example';
  const entry = (overrides: Partial<ConnectEntryInput>) =>
    connectEntry({ prefill: {}, isLoaded: true, inUse: null, ...overrides });
  // while a hosted session loads it reads as signed out, so nothing reads as in use
  const notYetInUse = serverInUse({ own: null, hosted: HOSTED, isSignedIn: false });

  it('cannot ask from the question alone: a hosted session still loading is in use nowhere', () => {
    expect(notYetInUse).toBeNull();
    expect(connectSwitchQuestion({ origin: OTHER, code: CODE }, notYetInUse)).toBeNull();
  });

  it('holds a prefill that names a server while the session loads: a link, a scan, a route', () => {
    for (const prefill of [
      { origin: OTHER, code: CODE },
      prefillFor(linkOf(VALID)),
      connectPrefillFromParams({ origin: 'nas.local', code: CODE }),
      { origin: OTHER },
    ]) {
      const held = entry({ prefill, isLoaded: false, inUse: notYetInUse });
      expect(held, JSON.stringify(prefill)).toEqual({ kind: 'loading' });
    }
  });

  it('does not hold Connect opened with no address (Welcome), even while the session loads', () => {
    for (const prefill of [{}, { code: CODE }, { origin: '   ' }]) {
      expect(entry({ prefill, isLoaded: false }), JSON.stringify(prefill)).toEqual({
        kind: 'flow',
      });
    }
  });

  it('asks once loaded on a phone signed in to the hosted server and opened with another', () => {
    const prefill = { origin: OTHER, code: CODE };
    expect(entry({ prefill, inUse: hostedInUse })).toEqual({
      kind: 'ask',
      question: connectSwitchQuestion(prefill, hostedInUse),
    });
    expect(entry({ prefill, inUse: hostedInUse })).toMatchObject({
      question: { message: "You're connected to Automatos. Connect to other.example instead?" },
    });
  });

  it('asks once loaded on a phone paired to its own server and opened with another', () => {
    const prefill = prefillFor(linkOf(VALID));
    expect(entry({ prefill, inUse: ownInUse })).toEqual({
      kind: 'ask',
      question: connectSwitchQuestion(prefill, ownInUse),
    });
  });

  it('goes straight to the flow once loaded when this phone is connected nowhere', () => {
    expect(entry({ prefill: { origin: OTHER, code: CODE }, inUse: notYetInUse })).toEqual({
      kind: 'flow',
    });
  });

  it('goes straight to the flow for the server in use', () => {
    expect(entry({ prefill: { origin: 'http://192.168.1.20:8000' }, inUse: ownInUse })).toEqual({
      kind: 'flow',
    });
    expect(entry({ prefill: { origin: 'api.automatos.example' }, inUse: hostedInUse })).toEqual({
      kind: 'flow',
    });
  });
});
