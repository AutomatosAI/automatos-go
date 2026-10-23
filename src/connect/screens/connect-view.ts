// What Welcome and Connect show, pure (D-PURE): Welcome's two choices; for each step of the connect
// machine (flow.ts), the two fields with their errors and the code as XXXX-XXXX, whether Continue
// can be pressed, the confirm card in words (KC5, KC8, KC16, D-HTTPS), and each way Connect
// stopped short with its fix, never a status code. Also when Connect has nothing left to do: a
// saved pairing moves the current server, which remounts the provider tree and Connect with it
// (src/auth/AuthRoot.tsx), so the remounted screen reads the session to send the person home. The
// components in this folder only wire these to the primitives.

import { editionLabel } from '../../app-state/account';
import type { ConnectPrefill } from '../../navigation/routes';
import { parseServerAddress } from '../address';
import { PAIR_CODE_GROUP_LENGTH, PAIR_CODE_SEPARATOR } from '../config';
import { authorityOf, type ConfirmDetails } from '../confirm';
import type { OwnServer } from '../current-server';
import type {
  ConnectFailure,
  ConnectFields,
  ConnectState,
  FieldErrors,
  PairFailure,
} from '../flow';
import {
  ADDRESS_COPY,
  CONFIRM_COPY,
  CONNECT_FAILURE_COPY,
  INSECURE_NOTE_COPY,
  PAIR_CODE_COPY,
  WELCOME_COPY,
  dataNoteFor,
} from '../strings';

// ── Welcome ─────────────────────────────────────────────────────────────────────────────────

export type WelcomeInput = {
  readonly isLoaded: boolean;
  readonly isSignedIn: boolean;
  /** This build can sign in to its hosted server (auth-branch.ts hostedSignInConfigured). */
  readonly hostedSignIn: boolean;
};

export type WelcomeView =
  | { readonly kind: 'loading' }
  /** Already signed in (a stored session, or a link to Welcome): the shell takes over. */
  | { readonly kind: 'home' }
  | {
      readonly kind: 'choices';
      /** 'Sign in to Automatos' can be pressed. */
      readonly signInEnabled: boolean;
      /** Why it can't, under it; null when it can. */
      readonly signInNote: string | null;
    };

export function welcomeView({ isLoaded, isSignedIn, hostedSignIn }: WelcomeInput): WelcomeView {
  if (!isLoaded) return Object.freeze({ kind: 'loading' });
  if (isSignedIn) return Object.freeze({ kind: 'home' });
  return Object.freeze({
    kind: 'choices',
    signInEnabled: hostedSignIn,
    signInNote: hostedSignIn ? null : WELCOME_COPY.signInOff,
  });
}

// ── The fields ──────────────────────────────────────────────────────────────────────────────

/** Spaces and hyphens between groups, as pair-code.ts reads them. */
const CODE_SEPARATORS = /[\s-]+/g;
/** Only ASCII letters are capitalised: 'ß'.toUpperCase() is 'SS', and no code holds one. */
const ASCII_LOWER = /[a-z]/g;

/**
 * The code as the field shows it while typing: capitals, the hyphen after the fourth character.
 * Nothing is dropped, so a character no code has stays visible and Continue says why.
 */
export function codeDisplay(typed: string): string {
  const bare = typed
    .replace(CODE_SEPARATORS, '')
    .replace(ASCII_LOWER, (letter) => letter.toUpperCase());
  if (bare.length <= PAIR_CODE_GROUP_LENGTH) return bare;
  const head = bare.slice(0, PAIR_CODE_GROUP_LENGTH);
  return `${head}${PAIR_CODE_SEPARATOR}${bare.slice(PAIR_CODE_GROUP_LENGTH)}`;
}

/** Each field's refusal in words (US-006a's reasons). */
export type FieldErrorCopy = { readonly origin?: string; readonly code?: string };

export function fieldErrorCopy(error: FieldErrors | undefined): FieldErrorCopy {
  return Object.freeze({
    ...(error?.origin ? { origin: ADDRESS_COPY[error.origin] } : {}),
    ...(error?.code ? { code: PAIR_CODE_COPY[error.code] } : {}),
  });
}

export type FieldsView = {
  /** The address as typed. */
  readonly origin: string;
  /** The code as XXXX-XXXX (codeDisplay). */
  readonly codeDisplay: string;
  readonly fieldErrors: FieldErrorCopy;
  /** Both fields hold something and nothing is being checked. */
  readonly canContinue: boolean;
};

const isBlank = (text: string | undefined) => (text ?? '').trim() === '';

/** The fields → what the form shows; `busy` while discovery is read. */
export function fieldsView(
  fields: ConnectFields,
  error: FieldErrors | undefined,
  busy: boolean,
): FieldsView {
  return Object.freeze({
    origin: fields.origin ?? '',
    codeDisplay: codeDisplay(fields.code ?? ''),
    fieldErrors: fieldErrorCopy(error),
    canContinue: !busy && !isBlank(fields.origin) && !isBlank(fields.code),
  });
}

// ── The screens ─────────────────────────────────────────────────────────────────────────────

export type FormView = FieldsView & {
  readonly screen: 'form';
  /** Discovery is being read: Continue is busy, Cancel stops it. */
  readonly checking: boolean;
  /** Why the last Continue stopped short, with its fix; null when it didn't. */
  readonly failure: string | null;
  /** 'hosted' in a build that can sign in: offer Sign in to Automatos instead. */
  readonly offerSignIn: boolean;
};

/** The confirm card in words. */
export type CardView = {
  readonly serverName: string;
  readonly edition: string;
  /** The origin that answered discovery: every call goes there (KC5). */
  readonly address: string;
  /** The document's api_url when it names another address; null when it doesn't. */
  readonly listedAddress: string | null;
  /** The unencrypted home network note (D-HTTPS); null over https. */
  readonly insecureNote: typeof INSECURE_NOTE_COPY | null;
  /** KC16's data note, the server filled in. */
  readonly dataNote: string;
};

export type ConfirmView = {
  readonly screen: 'confirm';
  readonly card: CardView;
  /** POST /pair is under way: nothing on the card can be pressed. */
  readonly pairing: boolean;
  /** Why the pairing failed, with its fix; null before Pair and while pairing. */
  readonly failure: string | null;
  readonly primaryLabel: string;
  /** Pair or Try again pairs; after a wrong or spent code it goes back for a new one. */
  readonly primaryAction: 'confirm' | 'back';
  /** A Back beside the primary button (not while pairing, nor when the primary is Back). */
  readonly showBack: boolean;
};

export type ConnectView = FormView | ConfirmView | { readonly screen: 'connected' };

export type ConnectViewOptions = { readonly hostedSignIn: boolean };

export function cardView(details: ConfirmDetails): CardView {
  return Object.freeze({
    serverName: details.serverName,
    edition: editionLabel(details.edition),
    address: details.origin,
    listedAddress: details.apiUrlDiffers ? details.documentApiUrl : null,
    insecureNote: details.insecure ? INSECURE_NOTE_COPY : null,
    // the data note names the server by the address that answered (discovery names it 'Automatos')
    dataNote: dataNoteFor(authorityOf(details.origin)),
  });
}

/** A failed pairing that the same code cannot fix: wrong or expired, or spent and not saved. */
const NEEDS_NEW_CODE: ReadonlySet<ConnectFailure> = new Set<PairFailure>(['bad_code', 'not_saved']);

function primaryLabelFor(failed: ConnectFailure | undefined, newCode: boolean): string {
  if (newCode) return CONFIRM_COPY.newCode;
  return failed === undefined ? CONFIRM_COPY.pair : CONFIRM_COPY.tryAgain;
}

function confirmView(
  details: ConfirmDetails,
  pairing: boolean,
  failed?: ConnectFailure,
): ConfirmView {
  const newCode = failed !== undefined && NEEDS_NEW_CODE.has(failed);
  return Object.freeze({
    screen: 'confirm',
    card: cardView(details),
    pairing,
    failure: failed === undefined ? null : CONNECT_FAILURE_COPY[failed],
    primaryLabel: primaryLabelFor(failed, newCode),
    primaryAction: newCode ? 'back' : 'confirm',
    showBack: !pairing && !newCode,
  });
}

type FormState = {
  readonly fields: ConnectFields;
  readonly error?: FieldErrors;
  readonly checking: boolean;
  readonly failed?: ConnectFailure;
};

function formView(state: FormState, { hostedSignIn }: ConnectViewOptions): FormView {
  return Object.freeze({
    screen: 'form',
    ...fieldsView(state.fields, state.error, state.checking),
    checking: state.checking,
    failure: state.failed === undefined ? null : CONNECT_FAILURE_COPY[state.failed],
    offerSignIn: state.failed === 'hosted' && hostedSignIn,
  });
}

/** A failure after the card was shown is a failed pairing (flow.ts keeps the card for it). */
function failedView(
  state: Extract<ConnectState, { readonly step: 'failed' }>,
  options: ConnectViewOptions,
): ConnectView {
  if (state.details) return confirmView(state.details, false, state.kind);
  return formView({ fields: state.fields, checking: false, failed: state.kind }, options);
}

/** The step machine's state → the screen Connect shows. */
export function connectView(state: ConnectState, options: ConnectViewOptions): ConnectView {
  switch (state.step) {
    case 'enter':
      return formView({ fields: state, error: state.error, checking: false }, options);
    case 'checking':
      return formView({ fields: state.fields, checking: true }, options);
    case 'confirm':
      return confirmView(state, false);
    case 'pairing':
      return confirmView(state, true);
    case 'failed':
      return failedView(state, options);
    case 'connected':
      return Object.freeze({ screen: 'connected' });
  }
}

// ── Landing ─────────────────────────────────────────────────────────────────────────────────

export type LandingInput = {
  /** The paired own server (current-server.ts), or null. */
  readonly own: OwnServer | null;
  readonly isSignedIn: boolean;
  /** What Connect was opened with (its route). */
  readonly prefill: ConnectPrefill;
};

/**
 * Connect has nothing left to do: this phone is signed in to an own server, and Connect was not
 * opened to pair with another one (a scan or a link carries a code; one for the server already in
 * use has nothing to pair). After a pairing, the remounted Connect lands here and goes home. A
 * phone signed in to the hosted server stays: it is connecting to its own server on purpose.
 */
export function connectLanding({ own, isSignedIn, prefill }: LandingInput): boolean {
  if (!own || !isSignedIn) return false;
  if (isBlank(prefill.code)) return true;
  const address = parseServerAddress(prefill.origin ?? '');
  return address.ok && address.origin === own.server.apiUrl;
}

/** One flow per prefill: a new link or scan while Connect is open starts it again. */
export function prefillKey({ origin = '', code = '' }: ConnectPrefill): string {
  return `${origin}\n${code}`;
}
