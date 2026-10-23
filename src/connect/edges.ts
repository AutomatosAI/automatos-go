// The edges of a connected phone (US-006h, PRD-001 §4.5, §4.7), pure: the server in words, the
// unencrypted home network line (only while the server is http, D-HTTPS), Settings → Account's
// server section, Not running, and Connect's note after a device refusal. Every own server's
// discovery names it 'Automatos' (automatos-ai services/mobile/discovery.py SERVER_NAME), so copy
// that names a server adds its address. The components in components/ only lay these out.

import type { Server } from '../api/server';
import { editionLabel, serverLabel } from '../app-state/account';
import type { ConnectPrefill } from '../navigation/routes';
import { parseServerAddress } from './address';
import { INSECURE_SCHEME, SELF_HOSTED_START_COMMAND } from './config';
import type { OwnServer } from './current-server';
import { refusalMessage, type DeviceRefusal } from './expiry';
import {
  FORGET_SERVER_COPY,
  INSECURE_BANNER_COPY,
  NOT_RUNNING_COPY,
  SERVER_SECTION_COPY,
} from './strings';

const INSECURE_PREFIX = `${INSECURE_SCHEME}://`;

/** A server as copy names it: its name and, when the name is not its address, the address too. */
export function serverInWords(name: string, origin: string): string {
  const address = serverLabel({ apiUrl: origin });
  const shown = name.trim();
  return shown === '' || shown === address ? address : `${shown} (${address})`;
}

/** The paired own server in words (Not running, the forget question). */
export function ownServerInWords(own: Pick<OwnServer, 'serverName' | 'server'>): string {
  return serverInWords(own.serverName, own.server.apiUrl);
}

/** 'Unencrypted home network · {host}' while the origin is http://; null over https. */
export function insecureNetworkLine(origin: string): string | null {
  const text = origin.trim();
  if (!text.toLowerCase().startsWith(INSECURE_PREFIX)) return null;
  return INSECURE_BANNER_COPY.line(serverLabel({ apiUrl: text }));
}

// ── Settings → Account ──────────────────────────────────────────────────────────────────────

export type ServerSectionInput = {
  /** The session's server. */
  readonly server: Server;
  /** The paired own server; null on the built-in hosted server. */
  readonly own: Pick<OwnServer, 'serverName'> | null;
  /** The discovery document's edition, as the server sends it. */
  readonly edition: string;
};

export type ServerSectionView = {
  readonly name: string;
  /** The server's host[:port]. */
  readonly address: string;
  /** The edition in words. */
  readonly edition: string;
  /** An own server's way out, Forget this server, asks this first; null on the hosted server. */
  readonly forgetQuestion: string | null;
};

export function serverSectionView({ server, own, edition }: ServerSectionInput): ServerSectionView {
  const address = serverLabel(server);
  return Object.freeze({
    name: own ? own.serverName.trim() || address : SERVER_SECTION_COPY.hostedName,
    address,
    edition: editionLabel(edition),
    forgetQuestion: own
      ? FORGET_SERVER_COPY.question(serverInWords(own.serverName, server.apiUrl))
      : null,
  });
}

// ── Not running ─────────────────────────────────────────────────────────────────────────────

export type NotRunningView = {
  readonly status: string;
  readonly title: string;
  readonly message: string;
  readonly startTitle: string;
  readonly startStep: string;
  readonly command: string;
  /** The command, read out. */
  readonly commandLabel: string;
  readonly reachStep: string;
  /** Forget this server asks this first. */
  readonly forgetQuestion: string;
};

/** An own server that does not answer, named, with how a self-hosted install is started. */
export function notRunningView(server: string): NotRunningView {
  return Object.freeze({
    status: NOT_RUNNING_COPY.status,
    title: NOT_RUNNING_COPY.title(server),
    message: NOT_RUNNING_COPY.message,
    startTitle: NOT_RUNNING_COPY.startTitle,
    startStep: NOT_RUNNING_COPY.startStep,
    command: SELF_HOSTED_START_COMMAND,
    commandLabel: NOT_RUNNING_COPY.command(SELF_HOSTED_START_COMMAND),
    reachStep: NOT_RUNNING_COPY.reachStep,
    forgetQuestion: FORGET_SERVER_COPY.question(server),
  });
}

// ── Connection ended ────────────────────────────────────────────────────────────────────────

export type EndedInput = {
  /** Why the last own server ended this launch (current-server.ts), or null. */
  readonly ended: DeviceRefusal | null;
  /** What Connect was opened with. */
  readonly prefill: ConnectPrefill;
};

/**
 * Connect's note after the server refused this phone's token (US-006c): the reason in words, naming
 * the server, when Connect opened for that server with the code field empty (the gate's redirect).
 * Anything else, a scan or a link with a code, another server, opens without it.
 */
export function connectionEndedNote({ ended, prefill }: EndedInput): string | null {
  if (!ended || (prefill.code ?? '').trim() !== '') return null;
  const address = parseServerAddress(prefill.origin ?? '');
  if (!address.ok || address.origin !== ended.origin) return null;
  return refusalMessage({ ...ended, serverName: serverInWords(ended.serverName, ended.origin) });
}
