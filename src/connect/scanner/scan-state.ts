// The scanner's and the pairing link's decisions (US-006g; KC8, KC13), pure: the camera permission
// in four states, the scan (the first valid pairing code wins, an invalid QR shows its copy and
// scanning goes on), and what a pairing link does: Connect prefilled, or first the question
// 'You're connected to {current}. Connect to {new} instead?' when this phone already uses a server.
// Connect asks the same question whenever it opens with another server's address (a scan, or a
// link that never passes /go/pair), and holds until the session has loaded to know whether to ask
// (connectEntry). Neither the scanner nor a link pairs: both only open Connect
// with the server and the code, which stops at the confirm card (KC8). QrScanner.tsx,
// PairLinkScreen.tsx and ConnectScreen.tsx only wire these.

import type { Server } from '../../api/server';
import { connectWith, routes, type ConnectPrefill } from '../../navigation/routes';
import { parseServerAddress } from '../address';
import { authorityOf } from '../confirm';
import type { OwnServer } from '../current-server';
import { isSameOrigin } from '../next-step';
import { parsePairLink, type PairLink } from '../pair-link';
import { PAIR_LINK_COPY, SCAN_COPY, switchQuestionFor } from '../strings';

// ── The camera permission ───────────────────────────────────────────────────────────────────

/**
 * undetermined: never asked (or not read yet); granted; denied: refused, and the system can still
 * ask (Android, once); blocked: only Settings can change it (iOS after any refusal, Android after
 * "Don't ask again").
 */
export type CameraPermission = 'undetermined' | 'granted' | 'denied' | 'blocked';

/** The fields of expo-camera's PermissionResponse this reads; null before the hook has read it. */
export type PermissionSnapshot = {
  readonly status: string;
  readonly canAskAgain: boolean;
} | null;

export function cameraPermissionOf(response: PermissionSnapshot): CameraPermission {
  if (response === null) return 'undetermined';
  if (response.status === 'granted') return 'granted';
  if (response.status === 'denied') return response.canAskAgain ? 'denied' : 'blocked';
  return 'undetermined';
}

/** Asked when the scanner opens (never at launch), once: a refusal is not asked again by itself. */
export function shouldAskForCamera(permission: CameraPermission, asked: boolean): boolean {
  return permission === 'undetermined' && !asked;
}

// ── The scan ────────────────────────────────────────────────────────────────────────────────

export type ScanState = {
  /** The camera permission was asked for on this screen. */
  readonly asked: boolean;
  /** The first valid pairing code, handed over once; every later frame is ignored. */
  readonly found: PairLink | null;
  /** The last QR read was not a pairing code (scanning goes on). */
  readonly invalid: boolean;
  /** The camera could not start (expo-camera's onMountError). */
  readonly cameraFailed: boolean;
};

export type ScanAction =
  | { readonly type: 'asked' }
  /** A QR code's text, as expo-camera read it (untrusted: anything can be in a QR code). */
  | { readonly type: 'scanned'; readonly data: string }
  | { readonly type: 'cameraFailed' };

export const INITIAL_SCAN: ScanState = Object.freeze({
  asked: false,
  found: null,
  invalid: false,
  cameraFailed: false,
});

function scanned(state: ScanState, data: string): ScanState {
  if (state.found) return state; // first valid wins: later frames change nothing
  const link = parsePairLink(data);
  if (link) return Object.freeze({ ...state, found: link, invalid: false });
  // the same invalid code, frame after frame: the same state, so nothing re-renders
  return state.invalid ? state : Object.freeze({ ...state, invalid: true });
}

export function scanReducer(state: ScanState, action: ScanAction): ScanState {
  switch (action.type) {
    case 'asked':
      return state.asked ? state : Object.freeze({ ...state, asked: true });
    case 'scanned':
      return scanned(state, action.data);
    case 'cameraFailed':
      return state.cameraFailed ? state : Object.freeze({ ...state, cameraFailed: true });
  }
}

export type ScannerView =
  /** The system is asking (or about to): nothing to scan yet. */
  | { readonly kind: 'asking'; readonly message: string }
  /** The camera is on; `note` is the invalid QR's copy, or the hint. */
  | {
      readonly kind: 'scanning';
      readonly note: string;
      readonly noteTone: 'info' | 'error';
      /** false once a code is found: the camera stops reading. */
      readonly reading: boolean;
    }
  /** No camera: refused, blocked, or it did not start. Type the code is always there. */
  | {
      readonly kind: 'no_camera';
      readonly message: string;
      /** Open Settings (Linking.openSettings): refused or blocked, not a camera that failed. */
      readonly openSettings: boolean;
      /** The system can still ask: Allow the camera asks again. */
      readonly askAgain: boolean;
    };

function scanningView(state: ScanState): ScannerView {
  return Object.freeze({
    kind: 'scanning',
    note: state.invalid ? SCAN_COPY.invalid : SCAN_COPY.hint,
    noteTone: state.invalid ? 'error' : 'info',
    reading: state.found === null,
  });
}

/** What the scanner shows for the permission and the scan so far. */
export function scannerView(permission: CameraPermission, state: ScanState): ScannerView {
  if (state.cameraFailed) {
    return Object.freeze({
      kind: 'no_camera',
      message: SCAN_COPY.cameraFailed,
      openSettings: false,
      askAgain: false,
    });
  }
  switch (permission) {
    case 'granted':
      return scanningView(state);
    case 'undetermined':
      return Object.freeze({ kind: 'asking', message: SCAN_COPY.asking });
    case 'denied':
    case 'blocked':
      return Object.freeze({
        kind: 'no_camera',
        message: SCAN_COPY.denied,
        openSettings: true,
        askAgain: permission === 'denied',
      });
  }
}

/** Connect's prefill for a scanned or linked server and code. */
export function prefillFor(link: PairLink): ConnectPrefill {
  return Object.freeze({ origin: link.apiOrigin, code: link.code });
}

/** Connect, prefilled with the scanned or linked server and code: it stops at confirm (KC8). */
export function connectRouteFor(link: PairLink): string {
  return connectWith(prefillFor(link));
}

// ── The server in use, and the switch question ──────────────────────────────────────────────

/** The server this phone uses now: its paired own server, or the hosted one it is signed in to. */
export type ServerInUse = { readonly apiUrl: string; readonly label: string };

export type ServerInUseInput = {
  readonly own: OwnServer | null;
  readonly hosted: Server | null;
  readonly isSignedIn: boolean;
};

export function serverInUse({ own, hosted, isSignedIn }: ServerInUseInput): ServerInUse | null {
  if (own) {
    return Object.freeze({ apiUrl: own.server.apiUrl, label: authorityOf(own.server.apiUrl) });
  }
  if (hosted && isSignedIn) {
    return Object.freeze({ apiUrl: hosted.apiUrl, label: PAIR_LINK_COPY.hostedServer });
  }
  return null;
}

/** The question asked before another server replaces the one in use, in words. */
export type SwitchQuestionView = {
  readonly title: string;
  readonly message: string;
  readonly note: string;
  readonly connectLabel: string;
  readonly stayLabel: string;
};

/** Each server by its address; by its whole origin when only the scheme tells them apart. */
function switchNames(current: ServerInUse, origin: string): readonly [string, string] {
  const next = authorityOf(origin);
  return current.label === next ? [current.apiUrl, origin] : [current.label, next];
}

function switchQuestion(current: ServerInUse, origin: string): SwitchQuestionView {
  return Object.freeze({
    title: PAIR_LINK_COPY.switchTitle,
    message: switchQuestionFor(...switchNames(current, origin)),
    note: PAIR_LINK_COPY.switchNote,
    connectLabel: PAIR_LINK_COPY.switchConnect,
    stayLabel: PAIR_LINK_COPY.switchStay,
  });
}

/**
 * The question Connect asks before anything else when it was opened with another server's address
 * while this phone uses one: a scan, a /go/pair link, or a crafted automatos://connect?origin=…
 * link, which never passes /go/pair (security review, US-006g). null when nothing is in use, the
 * prefill names no valid address, or it names the server in use. Only the person's yes moves on,
 * and only as far as the confirm card (KC8).
 */
export function connectSwitchQuestion(
  prefill: ConnectPrefill,
  inUse: ServerInUse | null,
): SwitchQuestionView | null {
  if (!inUse || !prefill.origin) return null;
  const address = parseServerAddress(prefill.origin);
  if (!address.ok || isSameOrigin(inUse.apiUrl, address.origin)) return null;
  return switchQuestion(inUse, address.origin);
}

/** What Connect shows before anything that runs discovery or pairs. */
export type ConnectEntryView =
  /** The session has not read what it holds yet: nothing to decide the question from. */
  | { readonly kind: 'loading' }
  /** Another server than the one in use: the question first, and nothing without the yes. */
  | { readonly kind: 'ask'; readonly question: SwitchQuestionView }
  | { readonly kind: 'flow' };

export type ConnectEntryInput = {
  readonly prefill: ConnectPrefill;
  /** The session has read what it holds; a hosted session reads as signed out until then. */
  readonly isLoaded: boolean;
  readonly inUse: ServerInUse | null;
};

const LOADING_ENTRY: ConnectEntryView = Object.freeze({ kind: 'loading' });
const FLOW_ENTRY: ConnectEntryView = Object.freeze({ kind: 'flow' });

/**
 * How Connect opens (KC8). A prefill that names a server (a link, a scan, a route prefill) waits
 * for the session: a hosted session still loading counts as in use nowhere, so it would ask no
 * question and a crafted automatos://connect link would reach the confirm card, whose Pair signs
 * the hosted session out (review P001N-RVW-1). Once loaded, the question when the prefill names
 * another server than the one in use; else the flow. Connect opened with no address (Welcome's
 * button) names no server to switch to, so it is not held.
 */
export function connectEntry({ prefill, isLoaded, inUse }: ConnectEntryInput): ConnectEntryView {
  const namesServer = (prefill.origin ?? '').trim() !== '';
  if (!isLoaded && namesServer) return LOADING_ENTRY;
  const question = connectSwitchQuestion(prefill, inUse);
  return question ? Object.freeze({ kind: 'ask', question }) : FLOW_ENTRY;
}

// ── The pairing link ────────────────────────────────────────────────────────────────────────

export type LinkIntake =
  | { readonly kind: 'loading' }
  /** Not a pairing link: its copy, and the way out (home when signed in, else Welcome). */
  | { readonly kind: 'invalid'; readonly exit: string }
  /** The link names the server this phone already uses: nothing to pair, home. */
  | { readonly kind: 'in_use'; readonly exit: string }
  /**
   * Another server than the one in use: ask, and change nothing without the yes. The yes opens
   * Connect with this prefill in place, told the question was answered (never through the URL,
   * which anyone can write).
   */
  | {
      readonly kind: 'ask';
      readonly question: SwitchQuestionView;
      readonly prefill: ConnectPrefill;
      readonly stay: string;
    }
  /** Connected nowhere: straight to Connect, prefilled (it stops at the confirm card). */
  | { readonly kind: 'connect'; readonly connect: string };

export type LinkIntakeInput = {
  /** parsePairLink's answer for the opened link. */
  readonly link: PairLink | null;
  /** The session has read what it holds. */
  readonly isLoaded: boolean;
  readonly isSignedIn: boolean;
  readonly inUse: ServerInUse | null;
};

/** What an opened pairing link does. */
export function pairLinkIntake({ link, isLoaded, isSignedIn, inUse }: LinkIntakeInput): LinkIntake {
  if (!isLoaded) return Object.freeze({ kind: 'loading' });
  if (!link) {
    return Object.freeze({ kind: 'invalid', exit: isSignedIn ? routes.home : routes.welcome });
  }
  if (!inUse) return Object.freeze({ kind: 'connect', connect: connectRouteFor(link) });
  if (isSameOrigin(inUse.apiUrl, link.apiOrigin)) {
    return Object.freeze({ kind: 'in_use', exit: routes.home });
  }
  return Object.freeze({
    kind: 'ask',
    question: switchQuestion(inUse, link.apiOrigin),
    prefill: prefillFor(link),
    stay: routes.home,
  });
}
