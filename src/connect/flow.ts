// The connect step machine (PRD-001 §4.5, KC5, KC8, KC15): enter (the server's address and the
// code) → checking (discovery at that origin) → confirm (the card: the server's name, edition and
// address) → pairing (POST /pair) → connected, or failed with its kind. Pure: use-connect.ts runs
// discovery and the pairing (connect-steps.ts) and feeds their answers back as actions.
//
// Nothing pairs by itself (KC8): a typed address, a scan and a pairing link are all a `submit`, and
// the only way into `pairing` is `confirm`, from the card (or from a failed pairing, as Try again).
// `connected` comes only from `paired`, which the runner sends once POST /pair answered AND the
// record was saved (switch.connectTo). The state never holds the token (KC9). Every state keeps
// what was typed, so Back never loses it. An action that does not apply returns the state as is.

import type { Discovery } from '../api/discovery';
import { parseServerAddress, type AddressRefusal } from './address';
import type { PairRefusal } from './api';
import { confirmDetailsFrom, type ConfirmDetails, type ConnectedRecord } from './confirm';
import type { DiscoveryFailure, NextStep } from './next-step';
import { normalizePairCode, type PairCodeRefusal } from './pair-code';

/** The two fields as typed, scanned or prefilled. */
export type ConnectFields = { readonly origin?: string; readonly code?: string };
export type ConnectField = keyof ConnectFields;

/** Why Continue was refused, per field (address.ts, pair-code.ts). */
export type FieldErrors = { readonly origin?: AddressRefusal; readonly code?: PairCodeRefusal };

/** A pairing that did not complete: POST /pair's refusal, or this phone's own part of it. */
export type PairFailure =
  | PairRefusal
  /** the keychain would not give the install id: nothing was sent */
  | 'keychain'
  /** paired, but switching to the server or saving the record failed (the code is spent) */
  | 'not_saved';

/** Every way Connect can stop short: discovery's, the next step's, the pairing's. */
export type ConnectFailure = DiscoveryFailure | Exclude<NextStep, 'pair'> | PairFailure;

export type ConnectState =
  | {
      readonly step: 'enter';
      readonly origin?: string;
      readonly code?: string;
      readonly error?: FieldErrors;
    }
  | {
      readonly step: 'checking';
      readonly origin: string;
      readonly insecure: boolean;
      readonly code: string;
      readonly fields: ConnectFields;
    }
  | ({ readonly step: 'confirm'; readonly fields: ConnectFields } & ConfirmDetails)
  | ({ readonly step: 'pairing'; readonly fields: ConnectFields } & ConfirmDetails)
  | { readonly step: 'connected'; readonly record: ConnectedRecord }
  | {
      readonly step: 'failed';
      readonly kind: ConnectFailure;
      readonly fields: ConnectFields;
      /** The card, when the failure came after it (a pairing): Try again pairs from here. */
      readonly details: ConfirmDetails | null;
    };

export type ConnectAction =
  | { readonly type: 'edit'; readonly field: ConnectField; readonly value: string }
  /** Continue, a scan or a pairing link: always to checking, never further (KC8). */
  | { readonly type: 'submit'; readonly origin: string; readonly code: string }
  /** Discovery answered at `origin`; `next` is nextStepFor's word on it. */
  | {
      readonly type: 'discovered';
      readonly origin: string;
      readonly discovery: Discovery;
      readonly next: NextStep;
    }
  | { readonly type: 'discoveryFailed'; readonly origin: string; readonly kind: DiscoveryFailure }
  /** Pair (on the card), or Try again (after a failed pairing). */
  | { readonly type: 'confirm' }
  | { readonly type: 'back' }
  /** POST /pair answered and the record is saved. */
  | { readonly type: 'paired'; readonly record: ConnectedRecord }
  | { readonly type: 'pairFailed'; readonly kind: PairFailure };

type StateOf<S extends ConnectState['step']> = Extract<ConnectState, { readonly step: S }>;
type ActionOf<T extends ConnectAction['type']> = Extract<ConnectAction, { readonly type: T }>;

/** The fields as Connect shows them: only the ones that hold something. */
function fieldsOf(fields: ConnectFields): ConnectFields {
  return Object.freeze({
    ...(fields.origin === undefined ? {} : { origin: fields.origin }),
    ...(fields.code === undefined ? {} : { code: fields.code }),
  });
}

/** The field errors that are there, or none at all. */
function fieldErrors(error: FieldErrors): FieldErrors | undefined {
  if (!error.origin && !error.code) return undefined;
  return Object.freeze({
    ...(error.origin ? { origin: error.origin } : {}),
    ...(error.code ? { code: error.code } : {}),
  });
}

function entering(fields: ConnectFields, error?: FieldErrors): StateOf<'enter'> {
  return Object.freeze({ step: 'enter', ...fieldsOf(fields), ...(error ? { error } : {}) });
}

/** What was typed, on any step that still has it. */
export function typedFields(state: ConnectState): ConnectFields {
  if (state.step === 'enter') return fieldsOf(state);
  return state.step === 'connected' ? Object.freeze({}) : state.fields;
}

/** Typing in a field: kept, and that field's error gone. */
function edit(state: StateOf<'enter'>, { field, value }: ActionOf<'edit'>): ConnectState {
  const error = state.error && fieldErrors({ ...state.error, [field]: undefined });
  return entering({ ...fieldsOf(state), [field]: value }, error);
}

/** Continue: both fields must be one before discovery reads anything. */
function submit({ origin, code }: ActionOf<'submit'>): ConnectState {
  const fields = fieldsOf({ origin, code });
  const address = parseServerAddress(origin);
  const pairCode = normalizePairCode(code);
  if (!address.ok || !pairCode.ok) {
    const error = fieldErrors({
      origin: address.ok ? undefined : address.reason,
      code: pairCode.ok ? undefined : pairCode.reason,
    });
    return entering(fields, error);
  }
  const { origin: reached, insecure } = address;
  return Object.freeze({
    step: 'checking',
    origin: reached,
    insecure,
    code: pairCode.code,
    fields,
  });
}

function failed(
  kind: ConnectFailure,
  fields: ConnectFields,
  details: ConfirmDetails | null,
): ConnectState {
  return Object.freeze({ step: 'failed', kind, fields, details });
}

/** Discovery's answer, only for the origin still being checked (a late one is ignored). */
function discovered(state: StateOf<'checking'>, action: ActionOf<'discovered'>): ConnectState {
  if (action.origin !== state.origin) return state;
  if (action.next !== 'pair') return failed(action.next, state.fields, null);
  const details = confirmDetailsFrom(state, action.discovery);
  return Object.freeze({ step: 'confirm', fields: state.fields, ...details });
}

function discoveryFailed(
  state: StateOf<'checking'>,
  action: ActionOf<'discoveryFailed'>,
): ConnectState {
  return action.origin === state.origin ? failed(action.kind, state.fields, null) : state;
}

/** The card a confirm or pairing state carries, without the step and the fields. */
function detailsOf(state: StateOf<'confirm'> | StateOf<'pairing'>): ConfirmDetails {
  return Object.freeze({
    origin: state.origin,
    insecure: state.insecure,
    serverName: state.serverName,
    edition: state.edition,
    webUrl: state.webUrl,
    apiUrlDiffers: state.apiUrlDiffers,
    documentApiUrl: state.documentApiUrl,
    pushExpo: state.pushExpo,
    code: state.code,
  });
}

function pairing(fields: ConnectFields, details: ConfirmDetails): ConnectState {
  return Object.freeze({ step: 'pairing', fields, ...details });
}

/** The saved pairing, only for the server being paired. */
function paired(state: StateOf<'pairing'>, { record }: ActionOf<'paired'>): ConnectState {
  if (record.origin !== state.origin) return state;
  return Object.freeze({ step: 'connected', record: Object.freeze({ ...record }) });
}

function fromEnter(state: StateOf<'enter'>, action: ConnectAction): ConnectState {
  if (action.type === 'edit') return edit(state, action);
  return action.type === 'submit' ? submit(action) : state;
}

function fromChecking(state: StateOf<'checking'>, action: ConnectAction): ConnectState {
  if (action.type === 'discovered') return discovered(state, action);
  if (action.type === 'discoveryFailed') return discoveryFailed(state, action);
  return action.type === 'back' ? entering(state.fields) : state;
}

function fromConfirm(state: StateOf<'confirm'>, action: ConnectAction): ConnectState {
  if (action.type === 'confirm') return pairing(state.fields, detailsOf(state));
  return action.type === 'back' ? entering(state.fields) : state;
}

/** A POST /pair under way cannot be left: its answer is the token, sent exactly once. */
function fromPairing(state: StateOf<'pairing'>, action: ConnectAction): ConnectState {
  if (action.type === 'paired') return paired(state, action);
  if (action.type !== 'pairFailed') return state;
  return failed(action.kind, state.fields, detailsOf(state));
}

/** Back or typing returns to the fields; Try again pairs again only after the card was shown. */
function fromFailed(state: StateOf<'failed'>, action: ConnectAction): ConnectState {
  if (action.type === 'back') return entering(state.fields);
  if (action.type === 'edit') return edit(entering(state.fields), action);
  if (action.type === 'confirm' && state.details) return pairing(state.fields, state.details);
  return state;
}

export function connectReducer(state: ConnectState, action: ConnectAction): ConnectState {
  switch (state.step) {
    case 'enter':
      return fromEnter(state, action);
    case 'checking':
      return fromChecking(state, action);
    case 'confirm':
      return fromConfirm(state, action);
    case 'pairing':
      return fromPairing(state, action);
    case 'failed':
      return fromFailed(state, action);
    case 'connected':
      return state;
  }
}

/**
 * Connect as it opens: the fields a route prefill, a scan or a link carried, and straight on to
 * checking when it carried both (US-006f). Never further: confirm still waits for Pair (KC8).
 */
export function startConnect(prefill: ConnectFields = {}): ConnectState {
  const start = entering(prefill);
  if (!prefill.origin || !prefill.code) return start;
  return connectReducer(start, { type: 'submit', origin: prefill.origin, code: prefill.code });
}
