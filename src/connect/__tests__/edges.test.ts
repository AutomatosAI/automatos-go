// The edges of a connected phone (US-006h): the unencrypted line only for an http origin, the
// server section on Account, Not running naming the server, the forget question, and Connect's
// words after a device refusal (reason → copy), with the gate's redirect that opens it.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SERVER } from '../../api/__tests__/fake-transport';
import { accessView } from '../../app-state/gate';
import { connectPrefillFromParams, connectWith } from '../../navigation/routes';
import { SELF_HOSTED_START_COMMAND } from '../config';
import { ownServerOf } from '../current-server';
import {
  connectionEndedNote,
  insecureNetworkLine,
  notRunningView,
  ownServerInWords,
  serverInWords,
  serverSectionView,
} from '../edges';
import type { DeviceRefusal, DeviceRefusalReason } from '../expiry';
import { startConnect } from '../flow';
import { connectView } from '../screens/connect-view';
import { FORGET_SERVER_COPY, INSECURE_BANNER_COPY, NOT_RUNNING_COPY } from '../strings';
import { OTHER_RECORD, RECORD } from './paired-record';

const ROOT = path.resolve(__dirname, '../../..');
const read = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), 'utf8');

const OWN = ownServerOf(RECORD);
const HOME = 'Home NAS (192.168.1.20:8000)';

describe('the unencrypted home network line (D-HTTPS)', () => {
  it('shows for an http origin, naming its host', () => {
    expect(insecureNetworkLine('http://192.168.1.20:8000')).toBe(
      'Unencrypted home network · 192.168.1.20:8000',
    );
    expect(insecureNetworkLine('http://nas.local')).toBe('Unencrypted home network · nas.local');
    expect(insecureNetworkLine(' HTTP://10.0.0.5:8080 ')).toBe(
      INSECURE_BANNER_COPY.line('10.0.0.5:8080'),
    );
  });

  it('never shows over https, nor for anything that is not an http origin', () => {
    for (const origin of [
      'https://automatos.example.com',
      'https://192.168.1.20:8443',
      SERVER.apiUrl,
      OTHER_RECORD.origin,
      '',
      'httpx://nas.local',
      'nas.local',
    ]) {
      expect(insecureNetworkLine(origin), origin).toBeNull();
    }
  });

  it("is the paired record's state: on for the http record, off for the https one", () => {
    expect(insecureNetworkLine(OWN.server.apiUrl)).not.toBeNull();
    expect(insecureNetworkLine(ownServerOf(OTHER_RECORD).server.apiUrl)).toBeNull();
  });
});

describe('the server in words', () => {
  it('names the server and its address, since every server calls itself Automatos', () => {
    expect(serverInWords('Automatos', 'https://automatos.example.com')).toBe(
      'Automatos (automatos.example.com)',
    );
    expect(ownServerInWords(OWN)).toBe(HOME);
  });

  it('is just the address when the name is the address or blank', () => {
    expect(serverInWords('nas.local:8000', 'http://nas.local:8000')).toBe('nas.local:8000');
    expect(serverInWords('  ', 'http://nas.local:8000')).toBe('nas.local:8000');
  });
});

describe('the server section on Account', () => {
  it("shows an own server's name, address and edition in words, and asks before forgetting it", () => {
    expect(serverSectionView({ server: OWN.server, own: OWN, edition: 'local' })).toEqual({
      name: 'Home NAS',
      address: '192.168.1.20:8000',
      edition: 'Self-hosted',
      forgetQuestion: FORGET_SERVER_COPY.question(HOME),
    });
  });

  it('shows the hosted server as Automatos, with Sign out (no forget question)', () => {
    expect(serverSectionView({ server: SERVER, own: null, edition: 'saas' })).toEqual({
      name: 'Automatos',
      address: 'api.example.test',
      edition: 'Automatos cloud',
      forgetQuestion: null,
    });
  });

  it('falls back to the address when the name is blank, and shows any other edition as sent', () => {
    const view = serverSectionView({
      server: OWN.server,
      own: { serverName: ' ' },
      edition: 'enterprise',
    });
    expect(view.name).toBe('192.168.1.20:8000');
    expect(view.edition).toBe('enterprise');
  });
});

describe('the forget question', () => {
  it('says this phone stops using the server and Studio still lists it', () => {
    expect(FORGET_SERVER_COPY.question(HOME)).toBe(
      'This phone stops using Home NAS (192.168.1.20:8000). Studio still lists it until it is removed there.',
    );
    expect(FORGET_SERVER_COPY.title).toBe('Forget this server?');
    expect(FORGET_SERVER_COPY.action).toBe('Forget this server');
  });

  it('deletes nothing: no account or workspace is named, no delete or remove action (D63)', () => {
    const words = Object.values(FORGET_SERVER_COPY)
      .map((value) => (typeof value === 'function' ? value(HOME) : value))
      .join(' ');
    expect(words).not.toMatch(/delete|account|workspace/i);
  });
});

describe('Not running', () => {
  const view = notRunningView(HOME);

  it('names the server, and says it is not connected in words', () => {
    expect(view.title).toBe("Can't reach Home NAS (192.168.1.20:8000)");
    expect(view.status).toBe(NOT_RUNNING_COPY.status);
    expect(view.forgetQuestion).toBe(FORGET_SERVER_COPY.question(HOME));
  });

  it('says how a self-hosted install is started: docker compose up -d on the server', () => {
    expect(view.command).toBe('docker compose up -d');
    expect(view.command).toBe(SELF_HOSTED_START_COMMAND);
    expect(view.commandLabel).toBe('Command: docker compose up -d');
    expect(view.startStep).toMatch(/on the server/i);
  });

  it('says the phone needs the same network or a public HTTPS address', () => {
    expect(view.reachStep).toContain('same network as the server');
    expect(view.reachStep).toContain('public HTTPS address');
  });
});

describe('Connection ended (reason → copy)', () => {
  const ended = (reason: DeviceRefusalReason): DeviceRefusal => ({
    reason,
    serverName: RECORD.serverName,
    origin: RECORD.origin,
  });
  const prefill = { origin: RECORD.origin };

  it.each([
    [
      'revoked',
      `This phone was removed from ${HOME}. Pair it again from Studio → Settings → Phones & devices.`,
    ],
    [
      'pairing_required',
      `${HOME} only answers paired phones. Pair it again from Studio → Settings → Phones & devices.`,
    ],
    [
      'ended',
      `This phone's connection to ${HOME} ended. Pair it again from Studio → Settings → Phones & devices.`,
    ],
  ] as const)('%s → its words, naming the server', (reason, words) => {
    expect(connectionEndedNote({ ended: ended(reason), prefill })).toBe(words);
  });

  it('holds for the same server typed another way', () => {
    const note = connectionEndedNote({
      ended: ended('revoked'),
      prefill: { origin: 'HTTP://192.168.1.20:8000/', code: '  ' },
    });
    expect(note).toContain('was removed from');
  });

  it('is not shown without a refusal, with a code (a scan or a link), or for another server', () => {
    expect(connectionEndedNote({ ended: null, prefill })).toBeNull();
    expect(
      connectionEndedNote({ ended: ended('revoked'), prefill: { ...prefill, code: 'ABCD-EFGH' } }),
    ).toBeNull();
    expect(
      connectionEndedNote({ ended: ended('revoked'), prefill: { origin: OTHER_RECORD.origin } }),
    ).toBeNull();
    expect(connectionEndedNote({ ended: ended('revoked'), prefill: {} })).toBeNull();
  });

  it('the gate lands on Connect with the server prefilled, the code empty, and the reason', () => {
    const refusal = ended('revoked');
    const access = accessView({
      own: null,
      ended: refusal,
      hosted: SERVER,
      isLoaded: true,
      isSignedIn: false,
      ownerId: null,
    });
    expect(access).toMatchObject({ kind: 'connect', origin: RECORD.origin, reason: 'revoked' });
    const href = connectWith({ origin: access.kind === 'connect' ? access.origin : '' });
    const query = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    const landed = connectPrefillFromParams(Object.fromEntries(query.entries()));
    expect(landed).toEqual({ origin: RECORD.origin });
    expect(connectView(startConnect(landed), { hostedSignIn: true })).toMatchObject({
      screen: 'form',
      origin: RECORD.origin,
      codeDisplay: '',
      checking: false,
    });
    expect(connectionEndedNote({ ended: refusal, prefill: landed })).toContain(HOME);
  });

  it('after Forget this server the gate, connected nowhere, opens Welcome', () => {
    const access = accessView({
      own: null,
      ended: null,
      hosted: SERVER,
      isLoaded: true,
      isSignedIn: false,
      ownerId: null,
    });
    expect(access).toEqual({ kind: 'welcome' });
  });
});

describe('the wiring', () => {
  it('renders the banner above every signed-in screen, which get their own safe area under it', () => {
    const layout = read('app/(app)/_layout.tsx');
    expect(layout).toContain('<InsecureNetworkBanner origin={server.apiUrl} placement="top" />');
    expect(layout.indexOf('<InsecureNetworkBanner')).toBeLessThan(
      layout.indexOf('<SafeAreaProvider'),
    );
    expect(layout.indexOf('<SafeAreaProvider')).toBeLessThan(layout.indexOf('<Stack'));
  });

  it('puts the server section on Account, with the banner line and the way out', () => {
    expect(read('app/(app)/settings/index.tsx')).toContain(
      '<ServerSection server={server} edition={discovery.edition} />',
    );
    const section = read('src/connect/components/ServerSection.tsx');
    expect(section).toContain('<InsecureNetworkBanner origin={server.apiUrl} />');
    expect(section).toContain('<ForgetServer question={view.forgetQuestion} />');
    expect(section).toContain('SHELL_COPY.signOut');
  });

  it("shows Not running for the gate's not_running, with Retry and Forget this server", () => {
    expect(read('src/app-state/GateStates.tsx')).toContain(
      '<NotRunning server={serverName} onRetry={() => onRetry(view.step)} />',
    );
    const screen = read('src/connect/components/NotRunning.tsx');
    expect(screen).toContain('onPress={onRetry}');
    expect(screen).toContain('<ForgetServer question={view.forgetQuestion}');
  });

  it('forgets only after the yes in the sheet', () => {
    const forget = read('src/connect/components/ForgetServer.tsx');
    expect(forget).toContain('onPress={() => setAsking(true)}');
    expect(forget).toMatch(/const forget = \(\) => \{\s*setAsking\(false\);\s*signOut\(\);/);
    expect(forget).toContain('onPress={forget}');
  });

  it("shows the refusal's words on Connect", () => {
    const connect = read('src/connect/screens/ConnectScreen.tsx');
    expect(connect).toContain('connectionEndedNote({ ended, prefill })');
    expect(connect).toContain("<StepNote note={{ tone: 'error', text: ended }} />");
  });
});
