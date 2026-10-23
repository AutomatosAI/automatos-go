// The connect flow for Connect's screens (US-006e): the step machine (flow.ts) over the app's
// ports — fetchDiscovery and pairDevice through the foundation's client on the real transport,
// this install's id, this phone's name, and the server switch, whose connectTo clears the last
// server's session, saves the record in the device store (US-006c) and moves the current server
// (US-006d). Nothing else is persisted. Discovery runs while the flow is checking and is aborted by
// Back; a pairing runs once per Pair (React's second effect run in development included: a code
// works once) and is never aborted. Saving moves the current server, which remounts the provider
// tree and with it this screen (src/auth/AuthRoot.tsx): the shell takes over from there.

import { useEffect, useMemo, useReducer, useRef, type Dispatch, type RefObject } from 'react';

import { expoTransport } from '../api/transport';
import { logger } from '../lib/logger';
import { discover, pair, type ConnectPorts } from './connect-steps';
import { hostedServer } from './current-server';
import { appVersion, deviceName, devicePlatform } from './device-info';
import {
  connectReducer,
  startConnect,
  type ConnectAction,
  type ConnectField,
  type ConnectFields,
  type ConnectState,
} from './flow';
import { getInstallId } from './install-id';
import type { ServerSwitch } from './switch';
import { useServerSwitch } from './use-server-switch';

export type ConnectFlow = {
  readonly state: ConnectState;
  readonly edit: (field: ConnectField, value: string) => void;
  /** Continue with the fields, or a scan's or a link's server and code: stops at confirm (KC8). */
  readonly submit: (fields: ConnectFields) => void;
  /** Pair (on the card), or Try again after a failed pairing. */
  readonly confirm: () => void;
  readonly back: () => void;
};

function appPorts(connectTo: ServerSwitch['connectTo']): ConnectPorts {
  return Object.freeze({
    transport: expoTransport,
    hosted: hostedServer(),
    installId: () => getInstallId(),
    device: Object.freeze({
      name: deviceName(),
      platform: devicePlatform(),
      appVersion: appVersion(),
    }),
    connectTo,
    now: () => new Date(),
  });
}

/** The latest ports, for calls that outlive a render (the switch follows the session). */
function usePorts(): RefObject<ConnectPorts> {
  const { connectTo } = useServerSwitch();
  const ports = useRef(appPorts(connectTo));
  useEffect(() => {
    ports.current = appPorts(connectTo);
  }, [connectTo]);
  return ports;
}

/** Discovery for the origin being checked; Back (or leaving) aborts it. */
function useDiscovery(
  state: ConnectState,
  dispatch: Dispatch<ConnectAction>,
  ports: RefObject<ConnectPorts>,
): void {
  const checking = state.step === 'checking' ? state : null;
  useEffect(() => {
    if (!checking) return undefined;
    const controller = new AbortController();
    void discover(checking.origin, ports.current, controller.signal).then((action) => {
      if (action) dispatch(action);
    });
    return () => controller.abort();
  }, [checking, dispatch, ports]);
}

/** The pairing, once per Pair: the state object it started for is never paired twice. */
function usePairing(
  state: ConnectState,
  dispatch: Dispatch<ConnectAction>,
  ports: RefObject<ConnectPorts>,
): void {
  const pairing = state.step === 'pairing' ? state : null;
  const started = useRef<ConnectState | null>(null);
  useEffect(() => {
    if (!pairing || started.current === pairing) return;
    started.current = pairing;
    pair(pairing, ports.current).then(dispatch, (error: unknown) => {
      logger.error('[connect] the pairing runner failed', error);
      dispatch({ type: 'pairFailed', kind: 'refused' });
    });
  }, [pairing, dispatch, ports]);
}

/** Connect's flow, opened with a route prefill, a scan or a link (both fields → checking). */
export function useConnect(prefill: ConnectFields = {}): ConnectFlow {
  const [state, dispatch] = useReducer(connectReducer, prefill, startConnect);
  const ports = usePorts();
  useDiscovery(state, dispatch, ports);
  usePairing(state, dispatch, ports);
  return useMemo(
    () =>
      Object.freeze({
        state,
        edit: (field: ConnectField, value: string) => dispatch({ type: 'edit', field, value }),
        submit: ({ origin = '', code = '' }: ConnectFields) =>
          dispatch({ type: 'submit', origin, code }),
        confirm: () => dispatch({ type: 'confirm' }),
        back: () => dispatch({ type: 'back' }),
      }),
    [state],
  );
}
