// US-007c: the consent sheet as a step of the signed-in gate (D23, KC11). The sheet's view-model
// names every provider the server lists, Retell for Auto Live voice included; the gate runs the
// launch, then the sheet, then the screens; 'Agree and continue' writes the record and the step
// clears; a changed list asks again; a role that sends nothing is never asked until promoted; the
// one way out follows the server's source. Roles are picked through roleCan (role-source.test.ts).
// The components are read from the source (vitest runs no React Native renderer).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SERVER } from '../../api/__tests__/fake-transport';
import { hostedDefaults, type Discovery } from '../../api/discovery';
import { ApiError } from '../../api/errors';
import { WORKSPACE_ROLES, WorkspaceSchema, type Workspace } from '../../api/workspace';
import { PENDING, launchView, shellStep, type LaunchView, type Step } from '../../app-state/gate';
import { SHELL_COPY } from '../../app-state/strings';
import { roleCan } from '../../auth/role';
import { FORGET_SERVER_COPY } from '../../connect/strings';
import { memoryStorage } from '../../storage/encrypted-storage';
import { createConsentMemory } from '../memory';
import { consentRecordFor, workspaceConsent, type AgreeableProviders } from '../policy';
import { providersFrom } from '../providers';
import { consentSheetView } from '../sheet';
import { createConsentStore, type ConsentScope } from '../store';
import { CONSENT_COPY, CONSENT_SHEET_COPY } from '../strings';

const WRITER = WORKSPACE_ROLES.find((role) => roleCan(role, 'chat'));
const READER = WORKSPACE_ROLES.find((role) => !roleCan(role, 'chat'));
if (!WRITER || !READER) throw new Error('the role matrix lost its writer or its reader');

const ROOT = path.resolve(__dirname, '../../..');
const read = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), 'utf8');

const DEEPSEEK = { id: 'deepseek', name: 'DeepSeek' };
const OPENAI = { id: 'openai', name: 'OpenAI' };
/** The server's voice entry (automatos-ai services/ai_providers.py): listed when Auto Live can be used. */
const RETELL = { id: 'retell', name: 'Retell AI' };
const VOYAGE = { id: 'voyage', name: 'Voyage AI' };

const WORKSPACE_ID = '7f1c2a54-0000-4000-8000-000000000001';
const SCOPE: ConsentScope = { origin: SERVER.apiUrl, workspaceId: WORKSPACE_ID };
const AGREED_AT = new Date('2026-10-23T09:00:00.000Z');
const DISCOVERY: Discovery = hostedDefaults(SERVER);

function workspace(role: string, ai_providers?: unknown): Workspace {
  return WorkspaceSchema.parse({ id: WORKSPACE_ID, name: 'Studio team', role, ai_providers });
}

function ready(of: Workspace): LaunchView {
  return { kind: 'ready', discovery: DISCOVERY, workspace: of };
}

function setup() {
  const storage = memoryStorage();
  const store = createConsentStore({ storage: () => storage });
  return { store, memory: createConsentMemory({ store }) };
}

/** What 'Agree and continue' does (use-consent.ts agree): the record of what the sheet showed. */
function agreeTo(memory: ReturnType<typeof setup>['memory'], of: Workspace): void {
  const consent = workspaceConsent(of, memory.read(SCOPE));
  if (!consent.needed) throw new Error('nothing to agree to');
  memory.agree(SCOPE, consentRecordFor(consent.providers, AGREED_AT));
}

const LISTED = workspace(WRITER, [VOYAGE, RETELL, DEEPSEEK]);

describe("the sheet's view-model: every provider, by name", () => {
  it('lists every provider the server sends, the voice entry included, in the sheet’s order', () => {
    const view = consentSheetView({
      providers: providersFrom(LISTED) as AgreeableProviders,
      source: 'hosted',
      serverName: 'api.example.test',
    });
    expect(view.providers).toEqual(['DeepSeek', 'Retell AI', 'Voyage AI']);
    expect(view.body).toBe(CONSENT_COPY.listed(['DeepSeek', 'Retell AI', 'Voyage AI']));
    expect(view.body).toContain('Retell AI');
    expect(view.note).toBeNull();
    expect(view.heading).toBe('Before you talk to Auto');
    expect(view.agree).toBe('Agree and continue');
  });

  it('keeps a list that is only the voice entry: it is never filtered away', () => {
    const view = consentSheetView({
      providers: providersFrom(workspace(WRITER, [RETELL])) as AgreeableProviders,
      source: 'hosted',
      serverName: 'api.example.test',
    });
    expect(view.providers).toEqual(['Retell AI']);
  });

  it('an unlisted server: the unlisted sentence and its note, and no made-up name', () => {
    const view = consentSheetView({
      providers: { kind: 'unlisted' },
      source: 'own',
      serverName: 'Automatos (192.168.1.20:8000)',
    });
    expect(view.providers).toEqual([]);
    expect(view.body).toBe(CONSENT_COPY.unlisted);
    expect(view.note).toBe(CONSENT_COPY.unlistedNote);
  });
});

describe('the one way out, per server source (no Not now)', () => {
  const providers = providersFrom(LISTED) as AgreeableProviders;

  it('the hosted server: Sign out', () => {
    const view = consentSheetView({ providers, source: 'hosted', serverName: 'api.example.test' });
    expect(view.leave).toEqual({ action: 'sign_out', label: SHELL_COPY.signOut });
  });

  it('an own server: Forget this server, asked first, naming the server', () => {
    const serverName = 'Automatos (192.168.1.20:8000)';
    const view = consentSheetView({ providers, source: 'own', serverName });
    expect(view.leave).toEqual({
      action: 'forget_server',
      label: FORGET_SERVER_COPY.action,
      question: FORGET_SERVER_COPY.question(serverName),
    });
  });

  it('offers no way past the sheet but agreeing', () => {
    const words = JSON.stringify(CONSENT_SHEET_COPY).toLowerCase();
    expect(words).not.toMatch(/not now|later|skip|maybe/);
    const sheet = read('src/consent/ConsentSheet.tsx');
    const code = sheet
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/not now|later|skip/i);
    expect(sheet.match(/<Button\b/g)).toHaveLength(2);
    expect(sheet).toContain('<ForgetServer question={leave.question}');
  });
});

describe("the gate's step order: launch → consent → children", () => {
  it('every state before the bootstrap is ready stays the launch’s, whatever the record', () => {
    const notReady: LaunchView[] = [
      { kind: 'loading' },
      { kind: 'error', step: 'workspace', error: new ApiError('network') },
      { kind: 'unsupported', message: 'm', detail: 'd' },
      { kind: 'paused', message: 'm' },
      { kind: 'workspace_lost', message: 'm' },
      { kind: 'not_running', server: SERVER, step: 'discovery' },
    ];
    const record = consentRecordFor({ kind: 'unlisted' }, AGREED_AT);
    for (const view of notReady) {
      expect(shellStep(view, null)).toEqual({ kind: 'launch', view });
      expect(shellStep(view, record)).toEqual({ kind: 'launch', view });
    }
  });

  it('discovery, then the bootstrap, then the sheet, then the screens', () => {
    const { memory } = setup();
    const ok = <T>(data: T): Step<T> => ({ status: 'success', data });
    const at = (workspaceStep: Step<Workspace>) =>
      launchView({ server: SERVER, discovery: ok(DISCOVERY), workspace: workspaceStep });

    expect(
      shellStep(launchView({ server: SERVER, discovery: PENDING, workspace: PENDING }), null),
    ).toMatchObject({ kind: 'launch' });
    expect(shellStep(at(PENDING), memory.read(SCOPE))).toMatchObject({ kind: 'launch' });
    expect(shellStep(at(ok(LISTED)), memory.read(SCOPE))).toEqual({
      kind: 'consent',
      ready: ready(LISTED),
    });
    agreeTo(memory, LISTED);
    expect(shellStep(at(ok(LISTED)), memory.read(SCOPE))).toEqual({
      kind: 'children',
      ready: ready(LISTED),
    });
  });

  it('a workspace that lists no provider has no sheet', () => {
    expect(shellStep(ready(workspace(WRITER, [])), null)).toMatchObject({ kind: 'children' });
  });

  it('a server that does not list its providers asks with the unlisted copy', () => {
    expect(shellStep(ready(workspace(WRITER)), null)).toMatchObject({ kind: 'consent' });
    expect(shellStep(ready(workspace(WRITER, null)), null)).toMatchObject({ kind: 'consent' });
  });
});

describe('Agree and continue', () => {
  it('writes the record of what the sheet showed, and the step clears', () => {
    const { store, memory } = setup();
    let heard = 0;
    memory.subscribe(() => {
      heard += 1;
    });
    agreeTo(memory, LISTED);
    expect(heard).toBe(1);
    expect(store.read(SCOPE)).toEqual(
      consentRecordFor(providersFrom(LISTED) as AgreeableProviders, AGREED_AT),
    );
    expect(store.read(SCOPE)?.providerNames).toEqual(['DeepSeek', 'Retell AI', 'Voyage AI']);
    expect(shellStep(ready(LISTED), memory.read(SCOPE)).kind).toBe('children');
  });

  it('is asked again at the next launch only when the list changed', () => {
    const { store } = setup();
    const first = createConsentMemory({ store });
    agreeTo(first, LISTED);
    const relaunched = createConsentMemory({ store });
    expect(shellStep(ready(LISTED), relaunched.read(SCOPE)).kind).toBe('children');
  });
});

describe('a changed list asks again, with the new names', () => {
  it('a provider added on a later bootstrap (launch or resume) takes the screens away', () => {
    const { memory } = setup();
    agreeTo(memory, LISTED);
    const added = workspace(WRITER, [VOYAGE, RETELL, DEEPSEEK, OPENAI]);
    expect(shellStep(ready(added), memory.read(SCOPE)).kind).toBe('consent');
    const view = consentSheetView({
      providers: providersFrom(added) as AgreeableProviders,
      source: 'hosted',
      serverName: 'api.example.test',
    });
    expect(view.providers).toEqual(['DeepSeek', 'OpenAI', 'Retell AI', 'Voyage AI']);
  });

  it('a provider removed asks again too; the same list in another order does not', () => {
    const { memory } = setup();
    agreeTo(memory, LISTED);
    const removed = workspace(WRITER, [VOYAGE, DEEPSEEK]);
    const reordered = workspace(WRITER, [DEEPSEEK, RETELL, VOYAGE]);
    expect(shellStep(ready(removed), memory.read(SCOPE)).kind).toBe('consent');
    expect(shellStep(ready(reordered), memory.read(SCOPE)).kind).toBe('children');
  });

  it('a server that starts listing names asks again with them', () => {
    const { memory } = setup();
    agreeTo(memory, workspace(WRITER));
    expect(shellStep(ready(workspace(WRITER)), memory.read(SCOPE)).kind).toBe('children');
    expect(shellStep(ready(LISTED), memory.read(SCOPE)).kind).toBe('consent');
  });
});

describe('a role that sends nothing', () => {
  it('never sees the sheet, whatever the list', () => {
    for (const providers of [[VOYAGE, RETELL], undefined, []]) {
      expect(shellStep(ready(workspace(READER, providers)), null).kind).toBe('children');
    }
  });

  it('promoted to one that sends, sees it at the next bootstrap', () => {
    const { memory } = setup();
    expect(shellStep(ready(workspace(READER, [RETELL])), memory.read(SCOPE)).kind).toBe('children');
    expect(shellStep(ready(workspace(WRITER, [RETELL])), memory.read(SCOPE)).kind).toBe('consent');
  });
});

describe('the wiring (read from the source)', () => {
  it('the (app) layout hands the sheet to the gate for its consent step', () => {
    const layout = read('app/(app)/_layout.tsx');
    expect(layout).toContain('<AppGate consent={<ConsentSheet />}>');
    const gate = read('src/app-state/AppGate.tsx');
    expect(gate).toContain('shellStep(view, record)');
    expect(gate).toContain("step.kind === 'consent' ? consent : children");
    expect(gate).toMatch(/useConsentRecord\(server\.apiUrl, view\.kind === 'ready'/);
  });

  it('the sheet shows the foundation’s AI label, unstyled, and agrees through use-consent', () => {
    const sheet = read('src/consent/ConsentSheet.tsx');
    expect(sheet).toContain("import { AiLabel } from '../styles/ai-label'");
    expect(sheet).toContain('<AiLabel />');
    expect(sheet).toContain('onPress={agree}');
    expect(sheet).toContain('consentSheetView(');
    const hook = read('src/consent/use-consent.ts');
    expect(hook).toContain('useAppSession()');
    expect(hook).toContain('consentMemory.agree(');
  });

  it('the switch drops the consent memory and the left server’s records', () => {
    const port = read('src/connect/use-server-switch.ts');
    expect(port).toContain('resetMemory: () => consentMemory.resetMemory()');
    expect(port).toContain('forgetServer: (origin: string) => consentMemory.forgetServer(origin)');
  });
});
