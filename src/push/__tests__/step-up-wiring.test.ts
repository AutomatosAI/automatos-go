// Face ID before approve or answer in A2's and A3's buttons (D19, KP13; US-015e), and before a
// row's Try again and a suggestion's Start (PRD-268). Through the real
// gate (createStepUp over a fake LocalAuthentication, the switch on), each of the gated writes
// sends nothing on a cancelled, missed, locked-out or failed check, and on a pass sends one request,
// exactly what A2's or A3's sender sent before. Read from the source: each gated route is named by
// one sender only, and every module in src/chat and src/cc that calls a sender (other than the
// senders' own modules) is a gated module that imports src/step-up; guard( runs only there, for its
// own actions, and never for the KP13 writes.

import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { isAnswerInputError } from '../../cc/questions/answer';
import { answerGated } from '../../cc/questions/gated';
import { GATED_ACTIONS, type AuthResult, type Refusal } from '../../step-up/policy';
import { STEP_UP_OUTCOME_COPY, STEP_UP_PROMPT_COPY } from '../../step-up/strings';
import { importsOf, sources } from './source-files';
import { GATED_CASES, OPTIONS, gate, serverAnswering, wire } from './step-up-wiring-fixtures';

// step-up.ts imports the native module and setting-store.ts the app's MMKV store; the gate under
// test takes the fake port and its own switch, so neither is read.
vi.mock('expo-local-authentication', () => ({}));
vi.mock('../../storage/mmkv', () => ({
  appStorage: () => ({
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  }),
}));

const REFUSED: readonly (readonly [Refusal, AuthResult | Error])[] = [
  ['cancelled', { success: false, error: 'user_cancel' }],
  ['failed', { success: false, error: 'authentication_failed' }],
  ['locked_out', { success: false, error: 'lockout' }],
  ['unavailable', new Error('LAContext could not be created')],
];

describe.each(GATED_CASES)('$label ($action) behind Face ID', (gated) => {
  it.each(REFUSED)(
    'a %s check sends nothing and says nothing was sent',
    async (refusal, result) => {
      const { guard, auth, notify } = gate(result);
      const { client, transport } = serverAnswering(gated.answer);
      await expect(gated.gated(guard, client)).resolves.toBe(false);
      expect(transport.calls).toEqual([]);
      expect(auth.prompts()).toBe(1);
      expect(notify).toHaveBeenCalledExactlyOnceWith(STEP_UP_OUTCOME_COPY[refusal]);
    },
  );

  it('a passed check sends one request: exactly what the write sent before', async () => {
    const { guard, auth, notify } = gate({ success: true });
    const now = serverAnswering(gated.answer);
    const before = serverAnswering(gated.answer);
    await expect(gated.gated(guard, now.client)).resolves.toBe(true);
    await gated.plain(before.client);
    expect(now.transport.calls.map((call) => `${call.method} ${call.url}`)).toEqual([gated.route]);
    expect(now.transport.calls.map(wire)).toEqual(before.transport.calls.map(wire));
    expect(auth.calls).toContainEqual({
      op: 'auth',
      options: {
        promptMessage: STEP_UP_PROMPT_COPY[gated.action],
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      },
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it('with the switch off it asks nothing and sends once', async () => {
    const { guard, auth } = gate({ success: false, error: 'user_cancel' }, false);
    const { client, transport } = serverAnswering(gated.answer);
    await expect(gated.gated(guard, client)).resolves.toBe(true);
    expect(transport.calls).toHaveLength(1);
    expect(auth.calls).toEqual([]);
  });
});

describe('an answer the server would refuse unsent is refused before Face ID is asked', () => {
  it.each([
    ['blank words', { kind: 'words', text: '   ' } as const],
    ['an option not offered', { kind: 'option', option: 'Nope' } as const],
  ])('%s', async (_name, choice) => {
    const { guard, auth } = gate({ success: true });
    const { client, transport } = serverAnswering({});
    const refused = await answerGated(guard, client, 44, choice, OPTIONS).catch((e: unknown) => e);
    expect(isAnswerInputError(refused)).toBe(true);
    expect(auth.calls).toEqual([]);
    expect(transport.calls).toEqual([]);
  });
});

// ── Read from the source ──────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '../../..');
const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');
/** The code without its comments, so a comment naming a sender proves nothing either way. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const MODULES = [
  ...sources(path.join(ROOT, 'src/chat')),
  ...sources(path.join(ROOT, 'src/cc')),
  ...sources(path.join(ROOT, 'src/suggestions')),
]
  .filter(({ file }) => !/__tests__|\.test\.tsx?$/.test(file))
  .map(({ file, text }) => ({ file: relative(file), text, code: code(text) }));
const names = (text: string, name: string) =>
  new RegExp(`(^|[^\\w.$])${name.replace(/\./g, '\\.')}\\b`).test(text);
const namedBy = (name: string) => MODULES.filter((m) => names(m.code, name)).map((m) => m.file);
const importsStepUp = (text: string) => importsOf(text, /(^|\/)step-up\//).length > 0;
const withoutImports = (text: string) => text.replace(/^import\b[\s\S]*?from\s*'[^']+';$/gm, '');
const ACTIONS: readonly string[] = GATED_ACTIONS;

/** [the route constant, its one sender's module, its path, the route table it is declared in] */
const GATED_ROUTES = [
  [
    'CHAT_ROUTES.approveMission',
    'src/chat/cards/api.ts',
    '/api/missions/{mission_id}/approve',
    'src/chat/routes.ts',
  ],
  [
    'CHAT_ROUTES.grantApproval',
    'src/chat/cards/api.ts',
    '/api/v1/approval-grants/{grant_id}/grant',
    'src/chat/routes.ts',
  ],
  [
    'CC_ROUTES.questions.answer',
    'src/cc/questions/api.ts',
    '/api/v1/approval-grants/{grant_id}/answer',
    'src/cc/routes.ts',
  ],
  [
    'CC_ROUTES.board.approve',
    'src/cc/board/api.ts',
    '/api/v1/tasks/{task_id}/approve',
    'src/cc/routes.ts',
  ],
  [
    'CC_ROUTES.social.approve',
    'src/cc/social/api.ts',
    '/api/socials/posts/{post_id}/approve',
    'src/cc/routes.ts',
  ],
  // PRD-268's Try again: row-status.ts picks the route, api.ts sendRetry sends it
  [
    'CC_ROUTES.board.runNow',
    'src/cc/status/row-status.ts',
    '/api/v1/tasks/{task_id}/run-now',
    'src/cc/routes.ts',
  ],
  [
    'CC_ROUTES.missions.resume',
    'src/cc/status/row-status.ts',
    '/api/missions/{mission_id}/resume',
    'src/cc/routes.ts',
  ],
  [
    'CC_ROUTES.missions.replan',
    'src/cc/status/row-status.ts',
    '/api/missions/{mission_id}/replan',
    'src/cc/routes.ts',
  ],
  // PRD-268's Start on a suggestion (US-G01)
  [
    'SUGGESTION_ROUTES.start',
    'src/suggestions/api.ts',
    '/api/proactive/suggestions/{suggestion_id}/start',
    'src/suggestions/routes.ts',
  ],
] as const;
/** The route tables: they declare the routes (a sender's name may be a key there). */
const ROUTE_TABLES = ['src/chat/routes.ts', 'src/cc/routes.ts', 'src/suggestions/routes.ts'];
/** A2's and A3's functions that send a gated write, and those that wrap one. */
const SENDERS = [
  'approveMission',
  'grantApproval',
  'grantCall',
  'answerQuestion',
  'approveTicket',
  'approvePost',
  'approveShown',
  'sendRetry',
  'startSuggestion',
];
/** The modules that declare the senders: A2's and A3's, their tests pin their signatures. */
const SENDER_MODULES = [
  'src/cc/board/api.ts',
  'src/cc/questions/api.ts',
  'src/cc/social/api.ts',
  'src/cc/status/api.ts',
  'src/chat/cards/api.ts',
  'src/chat/cards/grants.ts',
  'src/suggestions/api.ts',
];
/** A4's gated senders, each with the actions it asks for. */
const GATED_MODULES: Readonly<Record<string, readonly string[]>> = {
  'src/cc/questions/gated.ts': ['answer'],
  'src/cc/social/gated.ts': ['approve_social'],
  'src/cc/status/gated.ts': ['retry'],
  'src/cc/ticket/gated.ts': ['approve_ticket'],
  'src/chat/cards/gated.ts': ['approve_plan', 'grant_tool'],
  'src/suggestions/gated.ts': ['start_suggestion'],
};
const GATED_FUNCTIONS = [
  'approvePlanGated',
  'grantToolGated',
  'answerGated',
  'approveTicketGated',
  'approvePostGated',
  'retryGated',
  'startGated',
];
/** KP13: the safe direction never asks. */
const UNGATED_SENDERS = [
  'rejectMission',
  'denyApproval',
  'denyCall',
  'withdrawAction',
  'dismissQuestion',
  'sendBack',
  'requestChanges',
  'hideSuggestion',
];

/** A module's top-level declarations: [its name, its code]. */
function declarations(text: string): (readonly [string, string])[] {
  return text
    .split(/^(?=(?:export\s+)?(?:async\s+)?(?:function|const|let|type)\s)/m)
    .flatMap((chunk) => {
      const name = /^(?:export\s+)?(?:async\s+)?(?:function|const|let|type)\s+(\w+)/.exec(chunk);
      return name?.[1] ? [[name[1], chunk] as const] : [];
    });
}

describe('every gated write goes through src/step-up (read from the source)', () => {
  it.each(GATED_ROUTES)('%s is named by one module only: %s', (constant, sender, route, table) => {
    expect(namedBy(constant)).toEqual([sender]);
    expect(MODULES.filter((m) => m.code.includes(route)).map((m) => m.file)).toEqual([table]);
  });

  it('the route tables are only read entry by entry, never passed on whole', () => {
    const whole = MODULES.filter(
      ({ file, code: text }) =>
        !ROUTE_TABLES.includes(file) &&
        /\b(CHAT_ROUTES\b(?!\.\w)|CC_ROUTES\b(?!\.\w+\.\w))/.test(withoutImports(text)),
    );
    expect(whole.map((m) => m.file)).toEqual([]);
  });

  it('every module that calls a gated sender, other than their own, is gated and imports step-up', () => {
    const callers = MODULES.filter(
      (m) =>
        ![...SENDER_MODULES, ...ROUTE_TABLES].includes(m.file) &&
        SENDERS.some((name) => names(m.code, name)),
    );
    expect(callers.map((m) => m.file).sort()).toEqual(Object.keys(GATED_MODULES).sort());
    for (const caller of callers) expect(importsStepUp(caller.text), caller.file).toBe(true);
  });

  it("in the senders' own modules only a sender wraps a sender", () => {
    const wrappers = MODULES.filter((m) => SENDER_MODULES.includes(m.file)).flatMap((m) =>
      declarations(m.code)
        .filter(([name, body]) => SENDERS.some((sender) => sender !== name && names(body, sender)))
        .map(([name]) => `${m.file}: ${name}`),
    );
    // each is itself in SENDERS, so its callers are held to the rule above
    expect(wrappers.sort()).toEqual([
      'src/cc/social/api.ts: approveShown',
      'src/chat/cards/grants.ts: grantCall',
    ]);
  });

  it('guard( runs only in the gated modules, each for its own actions and never for KP13', () => {
    const guarded = MODULES.filter((m) => /\bguard\(/.test(m.code)).map((m) => m.file);
    expect(guarded.sort()).toEqual(Object.keys(GATED_MODULES).sort());
    for (const [file, actions] of Object.entries(GATED_MODULES)) {
      const text = MODULES.find((m) => m.file === file)?.code ?? '';
      const words = [...text.matchAll(/'(\w+)'/g)].map((match) => match[1] ?? '');
      expect(
        words.filter((word) => ACTIONS.includes(word)),
        file,
      ).toEqual(actions);
      expect(
        UNGATED_SENDERS.filter((name) => names(text, name)),
        file,
      ).toEqual([]);
      expect(importsOf(text, /^(react|react-native|expo)/), file).toEqual([]);
    }
  });

  it('the cards and hooks that send a gated write take the guard from useStepUp()', () => {
    const users = MODULES.filter((m) => GATED_FUNCTIONS.some((name) => names(m.code, name)))
      .filter((m) => !(m.file in GATED_MODULES))
      .map((m) => m.file);
    expect(users.sort()).toEqual([
      'src/cc/questions/use-questions.ts',
      'src/cc/social/use-social.ts',
      'src/cc/status/use-retry.ts',
      'src/cc/ticket/use-ticket.ts',
      'src/chat/cards/PlanApprovalCard.tsx',
      'src/chat/cards/ToolApprovalCard.tsx',
      'src/suggestions/use-suggestions.ts',
    ]);
    for (const file of users) {
      const text = MODULES.find((m) => m.file === file)?.text ?? '';
      expect(importsOf(text, /step-up\/use-step-up$/), file).toHaveLength(1);
      expect(text, file).toMatch(/const \{ guard \} = useStepUp\(\);/);
    }
  });
});
