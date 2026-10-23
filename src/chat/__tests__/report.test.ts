// Report this on Auto's messages (US-009c, D15): offered only on a message Auto's turn saved (never
// the user's, the reply still being written or a saved failure), only when the foundation's gate
// allows (report_content listed and a role that may report), as a long-press and an accessible
// action; and the kit holds no report call of its own: the foundation's ReportSheet sends it.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { AccessibilityActionEvent } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import type { GateInput } from '../../api/capabilities';
import { CAPABILITIES } from '../../api/discovery';
import { REPORT_TARGET_ID_MAX_CHARS } from '../../api/reports';
import { WORKSPACE_ROLES, type WorkspaceRole } from '../../api/workspace';
import { canReport } from '../../ui/report';
import { REPORT_COPY } from '../../ui/strings';
import { REPORT_ACTION, reportAccessibility, reportTarget } from '../report/report';
import type { StoredMessage } from '../schemas';
import { threadRows, type ChatRow } from '../view-model';
import { AT, saved } from './thread-fixtures';
import { apply, frames, opened } from './view-model-fixtures';

const WITH_REPORTS: GateInput = { capabilities: ['report_content'], push: { expo: true } };
/** Every other capability: today's servers, until PRD-266 US-016 deploys. */
const WITHOUT_REPORTS: GateInput = {
  capabilities: CAPABILITIES.filter((capability) => capability !== 'report_content'),
  push: { expo: true },
};

const failure = (id: string): StoredMessage => ({
  ...saved(id, 'assistant', 'Something broke.'),
  source: { label: 'Error', origin: 'turn_error', code: 'turn_failed' },
});

/** A saved exchange, a saved failure, and a turn being written now ('Auto is working…' first). */
function thread(): ChatRow[] {
  const state = apply(
    opened([
      saved('m1', 'user', 'What is blocked?'),
      saved('m2', 'assistant', 'Two tickets are blocked.'),
      saved('m3', 'user', 'Why?'),
      failure('m4'),
    ]),
    { type: 'send', draft: { text: 'And now?', files: [], sentAt: AT } },
    ...frames({ kind: 'text', text: 'Checking the board.' }),
  );
  return threadRows(state);
}

const offered = (rows: readonly ChatRow[], allowed: boolean) =>
  rows.flatMap((row) => {
    const target = reportTarget(row, allowed);
    return target ? [target] : [];
  });

describe('reportTarget: only Auto’s saved messages', () => {
  it('offers the saved Auto message as target_type message with its id, and nothing else', () => {
    const rows = thread();
    expect(rows.map((row) => row.type)).toEqual(['user', 'auto', 'user', 'auto', 'user', 'auto']);
    expect(offered(rows, true)).toEqual([{ target_type: 'message', target_id: 'm2' }]);
  });

  it('never offers the user’s own messages', () => {
    const users = thread().filter((row) => row.type === 'user');
    expect(users).toHaveLength(3);
    expect(offered(users, true)).toEqual([]);
  });

  it('never offers the reply still being written (no saved id) or a saved failure', () => {
    const autos = thread().filter((row) => row.type === 'auto');
    expect(autos.map((row) => reportTarget(row, true)?.target_id ?? null)).toEqual([
      'm2',
      null,
      null,
    ]);
  });

  it('never offers the working line, a turn notice or cards whose reply was not saved', () => {
    const working = threadRows(
      apply(opened(), { type: 'send', draft: { text: 'Hi', files: [], sentAt: AT } }),
    );
    expect(working.map((row) => row.type)).toEqual(['user', 'working']);
    expect(offered(working, true)).toEqual([]);
    const notice: ChatRow = {
      type: 'notice',
      key: 'turn-notice',
      notice: {
        key: 'turn-notice',
        kind: 'stopped',
        mark: '·',
        tone: 'muted',
        text: 'Stopped.',
        accessibilityLabel: 'Stopped.',
        retry: false,
      },
    };
    expect(reportTarget(notice, true)).toBeNull();
    expect(reportTarget({ type: 'cards', key: 'loose-cards', cards: [] }, true)).toBeNull();
  });

  it('never offers an id the server’s target_id would refuse', () => {
    const long = threadRows(
      opened([saved('x'.repeat(REPORT_TARGET_ID_MAX_CHARS + 1), 'assistant', 'Long id.')]),
    );
    expect(offered(long, true)).toEqual([]);
    const longest = threadRows(
      opened([saved('x'.repeat(REPORT_TARGET_ID_MAX_CHARS), 'assistant', 'Longest id.')]),
    );
    expect(offered(longest, true)).toHaveLength(1);
  });
});

describe('reportTarget: only when the foundation’s gate allows', () => {
  const roles: readonly (WorkspaceRole | null)[] = [...WORKSPACE_ROLES, null];
  const gates: readonly (readonly [string, GateInput])[] = [
    ['report_content listed', WITH_REPORTS],
    ['report_content absent', WITHOUT_REPORTS],
    ['no capabilities (the hosted server today)', { capabilities: [], push: { expo: false } }],
    ['discovery still loading', null],
  ];

  it('offers it to owners, admins and editors on a server that lists report_content', () => {
    for (const role of ['owner', 'admin', 'editor'] as const) {
      expect(offered(thread(), canReport(WITH_REPORTS, role))).toHaveLength(1);
    }
  });

  it('hides it from a viewer and while the role is unknown', () => {
    for (const role of ['viewer', null] as const) {
      expect(offered(thread(), canReport(WITH_REPORTS, role))).toEqual([]);
    }
  });

  it('hides it from every role while the server does not list report_content', () => {
    for (const [, gate] of gates.slice(1)) {
      for (const role of roles) expect(offered(thread(), canReport(gate, role))).toEqual([]);
    }
  });

  it('follows canReport exactly, for every gate and role', () => {
    for (const [, gate] of gates) {
      for (const role of roles) {
        expect(offered(thread(), canReport(gate, role)).length > 0).toBe(canReport(gate, role));
      }
    }
  });
});

describe('reportAccessibility: the accessible action', () => {
  const event = (actionName: string) =>
    ({ nativeEvent: { actionName } }) as AccessibilityActionEvent;

  it('lists one action labelled with the foundation’s words where the message offers it', () => {
    const props = reportAccessibility(() => undefined);
    expect(props.accessibilityActions).toEqual([
      { name: REPORT_ACTION, label: REPORT_COPY.action },
    ]);
    expect(REPORT_COPY.action).toBe('Report this');
  });

  it('opens the sheet on that action alone', () => {
    const onReport = vi.fn();
    const { onAccessibilityAction } = reportAccessibility(onReport);
    onAccessibilityAction?.(event('activate'));
    onAccessibilityAction?.(event('magicTap'));
    expect(onReport).not.toHaveBeenCalled();
    onAccessibilityAction?.(event(REPORT_ACTION));
    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it('adds nothing where the message does not offer it', () => {
    expect(reportAccessibility(undefined)).toEqual({});
  });
});

describe('the kit’s source: one report implementation, the foundation’s', () => {
  const root = path.resolve(__dirname, '..');
  const sources = readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !file.includes('__tests__'))
    .map((file) => ({ file, text: readFileSync(path.join(root, file), 'utf8') }));
  const read = (file: string) => sources.find((source) => source.file === file)?.text ?? '';

  it('never posts a report itself: no reports route, no reportContent call', () => {
    expect(sources.length).toBeGreaterThan(0);
    const offenders = sources.filter(({ text }) =>
      /\/api\/v1\/reports|reportContent|buildReportPayload|routes\.reports/.test(text),
    );
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });

  it('mounts the foundation’s ReportSheet with the session’s gate and long-presses Auto’s messages', () => {
    expect(read('screens/ChatScreen.tsx')).toMatch(/<ReportSheet \{\.\.\.sheet\} \/>/);
    expect(read('report/use-message-report.ts')).toMatch(/canReport\(discovery, workspace\.role\)/);
    const message = read('components/AutoMessage.tsx');
    expect(message).toMatch(/onLongPress=\{onReport\}/);
    expect(message).toMatch(/accessible=\{false\}/);
    expect(read('components/UserBubble.tsx')).not.toMatch(/onLongPress|report/i);
  });
});
