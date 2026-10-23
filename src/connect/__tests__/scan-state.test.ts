// The scanner's and the pairing link's decisions (US-006g): the camera permission in four states,
// asked once when the scanner opens; the first valid code wins and later frames change nothing; an
// invalid QR shows its copy and scanning goes on; a link opens Connect prefilled, asking first when
// this phone already uses another server. Nothing here pairs: every way forward is Connect (KC8).

import { describe, expect, it } from 'vitest';

import { hostedServerFrom } from '../../api/server';
import { connectPrefillFromParams, routes } from '../../navigation/routes';
import { ownServerOf } from '../current-server';
import { parsePairLink, type PairLink } from '../pair-link';
import {
  INITIAL_SCAN,
  cameraPermissionOf,
  connectRouteFor,
  connectSwitchQuestion,
  prefillFor,
  pairLinkIntake,
  scanReducer,
  scannerView,
  serverInUse,
  shouldAskForCamera,
  type CameraPermission,
  type LinkIntakeInput,
  type ScanState,
} from '../scanner/scan-state';
import { PAIR_LINK_COPY, SCAN_COPY, switchQuestionFor } from '../strings';
import { OTHER_RECORD, RECORD } from './paired-record';

const CODE = 'ABCD-EFGH';
const NEW_API = 'https://automatos.example.com';

function serverLink(api: string, code = CODE): string {
  const query = `api=${encodeURIComponent(api)}&code=${encodeURIComponent(code)}`;
  return `https://studio.example.test/go/pair?${query}`;
}

const VALID = serverLink(NEW_API);
const OTHER_VALID = serverLink('http://192.168.1.30:8000', 'WXYZ-2345');
const NOT_A_PAIRING_CODE = 'https://example.test/menu';

const scan = (state: ScanState, data: string) => scanReducer(state, { type: 'scanned', data });

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

describe('cameraPermissionOf: the four permission states', () => {
  it('is undetermined before the hook has read it, and while never asked', () => {
    expect(cameraPermissionOf(null)).toBe('undetermined');
    expect(cameraPermissionOf({ status: 'undetermined', canAskAgain: true })).toBe('undetermined');
  });

  it('is granted once allowed', () => {
    expect(cameraPermissionOf({ status: 'granted', canAskAgain: true })).toBe('granted');
  });

  it('is denied when refused but the system can still ask, blocked when only Settings can', () => {
    expect(cameraPermissionOf({ status: 'denied', canAskAgain: true })).toBe('denied');
    expect(cameraPermissionOf({ status: 'denied', canAskAgain: false })).toBe('blocked');
  });

  it('reads an unknown status as not yet decided, never as granted', () => {
    expect(cameraPermissionOf({ status: 'limited', canAskAgain: true })).toBe('undetermined');
  });
});

describe('shouldAskForCamera: asked when the scanner opens, once', () => {
  it('asks an undetermined permission the first time only', () => {
    expect(shouldAskForCamera('undetermined', false)).toBe(true);
    expect(shouldAskForCamera('undetermined', true)).toBe(false);
  });

  it('never asks by itself once decided', () => {
    for (const permission of ['granted', 'denied', 'blocked'] as const) {
      expect(shouldAskForCamera(permission, false)).toBe(false);
    }
  });

  it('records the ask once', () => {
    const asked = scanReducer(INITIAL_SCAN, { type: 'asked' });
    expect(asked.asked).toBe(true);
    expect(scanReducer(asked, { type: 'asked' })).toBe(asked);
  });
});

describe('scanReducer: the first valid code wins', () => {
  it('keeps the first valid pairing code, as the server hashed it', () => {
    const found = scan(INITIAL_SCAN, serverLink(NEW_API, 'abcd efgh')).found;
    expect(found).toEqual({ apiOrigin: NEW_API, insecure: false, code: CODE });
  });

  it('ignores every later frame: the same code, another valid code, an invalid one', () => {
    const first = scan(INITIAL_SCAN, VALID);
    expect(scan(first, VALID)).toBe(first);
    expect(scan(first, OTHER_VALID)).toBe(first);
    expect(scan(first, NOT_A_PAIRING_CODE)).toBe(first);
    expect(first.found?.code).toBe(CODE);
  });

  it('marks an invalid QR and keeps scanning; the same invalid code again changes nothing', () => {
    const invalid = scan(INITIAL_SCAN, NOT_A_PAIRING_CODE);
    expect(invalid).toMatchObject({ invalid: true, found: null });
    expect(scan(invalid, NOT_A_PAIRING_CODE)).toBe(invalid);
    expect(scan(invalid, '')).toBe(invalid);
  });

  it('takes a valid code after an invalid one, and drops the invalid mark', () => {
    const found = scan(scan(INITIAL_SCAN, NOT_A_PAIRING_CODE), VALID);
    expect(found).toMatchObject({ invalid: false, found: { code: CODE } });
  });

  it('refuses what parsePairLink refuses: an http api on a public host, another scheme', () => {
    for (const data of [
      serverLink('http://203.0.113.9:8000'),
      `javascript:alert(1)//go/pair?api=${encodeURIComponent(NEW_API)}&code=${CODE}`,
      `${VALID}&api=${encodeURIComponent('https://evil.example')}`,
    ]) {
      expect(scan(INITIAL_SCAN, data)).toMatchObject({ invalid: true, found: null });
    }
  });

  it('records a camera that failed to start, once', () => {
    const failed = scanReducer(INITIAL_SCAN, { type: 'cameraFailed' });
    expect(failed.cameraFailed).toBe(true);
    expect(scanReducer(failed, { type: 'cameraFailed' })).toBe(failed);
  });

  it('never changes the state it is given', () => {
    const before = scan(INITIAL_SCAN, NOT_A_PAIRING_CODE);
    expect(Object.isFrozen(before)).toBe(true);
    scan(before, VALID);
    expect(before).toMatchObject({ invalid: true, found: null });
    expect(INITIAL_SCAN).toEqual({
      asked: false,
      found: null,
      invalid: false,
      cameraFailed: false,
    });
  });
});

describe('scannerView: what the scanner shows', () => {
  it('scans once granted, with the hint', () => {
    expect(scannerView('granted', INITIAL_SCAN)).toEqual({
      kind: 'scanning',
      note: SCAN_COPY.hint,
      noteTone: 'info',
      reading: true,
    });
  });

  it("shows an invalid QR's copy and keeps reading", () => {
    const view = scannerView('granted', scan(INITIAL_SCAN, NOT_A_PAIRING_CODE));
    expect(view).toMatchObject({ kind: 'scanning', note: SCAN_COPY.invalid, noteTone: 'error' });
    expect(view).toMatchObject({ reading: true });
  });

  it('stops reading once a code is found', () => {
    expect(scannerView('granted', scan(INITIAL_SCAN, VALID))).toMatchObject({ reading: false });
  });

  it('waits on the system while the permission is being asked', () => {
    expect(scannerView('undetermined', INITIAL_SCAN)).toEqual({
      kind: 'asking',
      message: SCAN_COPY.asking,
    });
  });

  it('refused: the camera copy, Open Settings, and Allow the camera while the system can ask', () => {
    expect(scannerView('denied', INITIAL_SCAN)).toEqual({
      kind: 'no_camera',
      message: SCAN_COPY.denied,
      openSettings: true,
      askAgain: true,
    });
    expect(scannerView('blocked', INITIAL_SCAN)).toEqual({
      kind: 'no_camera',
      message: SCAN_COPY.denied,
      openSettings: true,
      askAgain: false,
    });
  });

  it('says the camera did not start, whatever the permission, without Settings', () => {
    const failed = scanReducer(INITIAL_SCAN, { type: 'cameraFailed' });
    for (const permission of ['granted', 'undetermined', 'denied'] as CameraPermission[]) {
      expect(scannerView(permission, failed)).toEqual({
        kind: 'no_camera',
        message: SCAN_COPY.cameraFailed,
        openSettings: false,
        askAgain: false,
      });
    }
  });

  it('uses the words US-006g gives for a refused camera', () => {
    expect(SCAN_COPY.denied).toBe(
      'Automatos Go needs the camera to scan the code. You can allow it in Settings, or type the code instead.',
    );
    expect(SCAN_COPY.openSettings).toBe('Open Settings');
    expect(SCAN_COPY.typeCode).toBe('Type the code');
  });
});

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
