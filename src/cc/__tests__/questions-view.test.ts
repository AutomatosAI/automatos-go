import { describe, expect, it } from 'vitest';

import { questionControls, sendingOf, type ControlsInput } from '../questions/controls';
import { plainParagraphs } from '../questions/plain';
import { QuestionSchema, QuestionsSchema, type Question } from '../questions/schemas';
import { NeedsYouSchema, type NeedsYouAskRow } from '../../api/needs-you';
import { cascadeView, questionCardView, questionStatuses } from '../questions/view-model';
import { CC_ROUTES } from '../routes';
import { QUESTIONS_COPY } from '../strings';

const OPTIONS = ['Calendar', 'Customer story'];

// A grant row as list_grants serves it at the pinned SHA, with fields the app does not read.
const ROW = {
  id: 31,
  workspace_id: '7f1c2a54-0000-4000-8000-000000000001',
  subject_type: 'board_task',
  subject_id: '2680',
  tool_name: null,
  risk_tier: null,
  status: 'pending',
  kind: 'question',
  question_md: 'Lead with the calendar, or the customer story?',
  options: OPTIONS,
  asked_by_agent_id: 7,
  channel_refs: { telegram: { chat_id: 1, message_id: 2 } },
  details: {},
  oversight: { risk_class: 'low', tier: 'monitor', rationale: '', requires_approval: false },
  owner: {
    agent: { id: 7, name: 'Quill' },
    ticket: { id: 2680, title: 'Issue 43', number: '#0424' },
  },
  cascade: { total: 0, tasks: [] },
};

function question(overrides: Record<string, unknown> = {}): Question {
  return QuestionSchema.parse({ ...ROW, ...overrides });
}

/** needs-you's question rows, parsed as the app does. */
function askRows(rows: readonly Record<string, unknown>[]): readonly NeedsYouAskRow[] {
  return NeedsYouSchema.parse({ total: rows.length, rows: { question: rows } }).rows.question;
}

describe('the questions schema', () => {
  it('keeps what the card reads and ignores the rest', () => {
    const parsed = question();
    expect(parsed).toMatchObject({ id: 31, options: OPTIONS, stoppedRun: false });
    expect(parsed).not.toHaveProperty('channel_refs');
    expect(parsed).not.toHaveProperty('oversight');
    expect(parsed).not.toHaveProperty('details');
  });

  it('reads the stopped-run marker (details.playbook_ask.execution_id)', () => {
    const stopped = question({ details: { playbook_ask: { execution_id: 'ex-9', step: 2 } } });
    expect(stopped.stoppedRun).toBe(true);
    expect(question({ details: { playbook_ask: { execution_id: '' } } }).stoppedRun).toBe(false);
    expect(question({ details: null }).stoppedRun).toBe(false);
  });

  it('survives odd fields: options, owner, cascade and a numeric subject id', () => {
    const odd = question({
      options: ['Yes', 3, '', null, '  '],
      owner: 'nobody',
      cascade: {
        total: -1,
        tasks: [{ id: 'x' }, { id: 5, title: null, status: 'waiting_on_host' }],
      },
      subject_id: 2680,
      question_md: null,
    });
    expect(odd.options).toEqual(['Yes']);
    expect(odd.owner).toBeNull();
    expect(odd.cascade).toEqual({
      total: 0,
      tasks: [{ id: 5, title: null, status: 'waiting_on_host' }],
    });
    expect(odd.subject_id).toBe('2680');
    expect(odd.question_md).toBe('');
  });

  it('leaves out a grant it cannot read, never the list', () => {
    const list = QuestionsSchema.parse({ grants: [ROW, { id: 'broken' }, { ...ROW, id: 32 }] });
    expect(list.grants.map((grant) => grant.id)).toEqual([31, 32]);
  });
});

describe('the card’s words', () => {
  it('names the agent and links the ticket, opened at this question', () => {
    const view = questionCardView(question());
    expect(view.agent).toBe('Quill');
    expect(view.ticket).toEqual({
      label: 'Ticket #0424 · Issue 43',
      href: '/cc/ticket/2680?question=31',
    });
    expect(view.paragraphs).toEqual(['Lead with the calendar, or the customer story?']);
    expect(view.dismissEffect).toBe(QUESTIONS_COPY.dismissEffect.blocked);
  });

  it('falls back to the web’s agent words and a subject without a link', () => {
    const view = questionCardView(
      question({
        owner: null,
        subject_type: 'playbook_run',
        subject_id: 'ex-1',
        asked_by_agent_id: 12,
      }),
    );
    expect(view.agent).toBe('Agent #12');
    expect(view.ticket).toEqual({ label: 'Playbook run', href: null });
    expect(
      questionCardView(question({ owner: null, asked_by_agent_id: null, subject_type: null })),
    ).toMatchObject({ agent: 'An agent', ticket: null });
  });

  it("has no status of its own: none without its needs-you row's state (PRD-268)", () => {
    expect(questionCardView(question()).rowStatus).toBeNull();
    const rows = askRows([{ source: 'grant', id: '31', title: 'Lead with what?' }]);
    expect(questionCardView(question(), questionStatuses(rows)).rowStatus).toBeNull();
  });

  it('takes its state and next step from the needs-you row with its grant id', () => {
    const rows = askRows([
      { source: 'mission', id: '31', display_state: 'working' },
      {
        source: 'grant',
        id: '31',
        title: 'Lead with the calendar, or the customer story?',
        ticket_id: 2680,
        display_state: 'needs_you',
        next_step: 'Pick one, and Quill writes the intro.',
      },
      { source: 'grant', id: '99', display_state: 'done' },
    ]);
    const view = questionCardView(question(), questionStatuses(rows));
    expect(view.rowStatus).toEqual({
      state: 'needs_you',
      next: 'Pick one, and Quill writes the intro.',
      retry: null,
      accessibilityLabel:
        'Needs you: Lead with the calendar, or the customer story? Pick one, and Quill writes the intro.',
    });
  });

  it("names the question's words when its row has no title, and its ticket for Try again", () => {
    const rows = askRows([
      { source: 'grant', id: '31', display_state: 'failed', retry: { kind: 'retry_ticket' } },
    ]);
    const view = questionCardView(question(), questionStatuses(rows));
    expect(view.rowStatus).toMatchObject({
      accessibilityLabel: "Couldn't finish: Lead with the calendar, or the customer story?",
      retry: { kind: 'retry_ticket', route: CC_ROUTES.board.runNow, params: { task_id: '2680' } },
    });
  });

  it('says a stopped run’s question closes its run when dismissed', () => {
    const view = questionCardView(
      question({ details: { playbook_ask: { execution_id: 'ex-9' } } }),
    );
    expect(view.dismissEffect).toBe(QUESTIONS_COPY.dismissEffect.stoppedRun);
    expect(view.dismissEffect).toMatch(/closes that run/);
  });

  it('lists the cascade with each task’s status word and how many more', () => {
    expect(cascadeView({ total: 0, tasks: [] })).toBeNull();
    expect(
      cascadeView({
        total: 8,
        tasks: [
          { id: 1, title: 'Match payouts', status: 'in_progress' },
          { id: 2, title: ' ', status: 'waiting_on_host' },
          { id: 3, title: 'Write the sheet', status: null },
        ],
      }),
    ).toEqual({
      title: 'Blocking 8 downstream tasks',
      rows: [
        { id: 1, title: 'Match payouts', status: 'In Progress' },
        { id: 2, title: QUESTIONS_COPY.untitled, status: 'Waiting on host' },
        { id: 3, title: 'Write the sheet', status: null },
      ],
      more: '+5 more',
    });
    expect(
      cascadeView({ total: 1, tasks: [{ id: 1, title: 'One', status: 'inbox' }] }),
    ).toMatchObject({
      title: 'Blocking 1 downstream task',
      more: null,
    });
  });
});

describe('the question as plain paragraphs', () => {
  it('splits on blank lines and takes the marks out', () => {
    const md = [
      '## The key expired',
      '',
      'Use the **read-only** key in [the vault](https://x.test/v), or _wait_ for `rotate`?',
      '',
      '- one step',
      '* another',
      '',
      '> quoted words',
      '',
      '---',
    ].join('\r\n');
    expect(plainParagraphs(md)).toEqual([
      'The key expired',
      'Use the read-only key in the vault, or wait for rotate?',
      '• one step\n• another',
      'quoted words',
    ]);
  });

  it('keeps snake_case, fenced code lines and an image’s words', () => {
    expect(plainParagraphs('Set max_retries to 3.')).toEqual(['Set max_retries to 3.']);
    expect(plainParagraphs('```\nrun_now()\n```')).toEqual(['run_now()']);
    expect(plainParagraphs('![the chart](c.png) ~~old~~')).toEqual(['the chart old']);
  });

  it('has nothing for blank or missing text', () => {
    expect(plainParagraphs('')).toEqual([]);
    expect(plainParagraphs('  \n\n ')).toEqual([]);
    expect(plainParagraphs(null)).toEqual([]);
  });
});

const BASE: ControlsInput = {
  mayAnswer: true,
  options: OPTIONS,
  effect: QUESTIONS_COPY.dismissEffect.blocked,
  wordsOpen: false,
  confirming: false,
  text: '',
  sending: null,
};

describe('the card’s controls', () => {
  it('offers the options, the own-words toggle and Dismiss; the field stays closed', () => {
    const controls = questionControls(BASE);
    expect(controls?.options.map((option) => option.label)).toEqual(OPTIONS);
    expect(controls?.toggle?.label).toBe(QUESTIONS_COPY.ownWords);
    expect(controls?.field).toBeNull();
    expect(controls?.answer).toBeNull();
    expect(controls?.dismiss).toEqual({ label: 'Dismiss', disabled: false, busy: false });
  });

  it('opens the field with Answer, enabled once there are words', () => {
    const open = questionControls({ ...BASE, wordsOpen: true });
    expect(open?.toggle?.label).toBe(QUESTIONS_COPY.hideOwnWords);
    expect(open?.field).toEqual({ disabled: false });
    expect(open?.answer).toMatchObject({ label: 'Answer', disabled: true });
    expect(
      questionControls({ ...BASE, wordsOpen: true, text: 'Calendar first' })?.answer,
    ).toMatchObject({ disabled: false });
  });

  it('keeps the field open, with no toggle, when no option is offered', () => {
    const controls = questionControls({ ...BASE, options: [] });
    expect(controls?.toggle).toBeNull();
    expect(controls?.field).toEqual({ disabled: false });
    expect(controls?.options).toEqual([]);
  });

  it('asks before dismissing, with what dismissing does', () => {
    const confirm = questionControls({ ...BASE, confirming: true });
    expect(confirm?.options).toEqual([]);
    expect(confirm?.dismiss).toBeNull();
    expect(confirm?.confirm).toEqual({
      effect: QUESTIONS_COPY.dismissEffect.blocked,
      keep: { label: QUESTIONS_COPY.keep, disabled: false, busy: false },
      dismiss: { label: 'Dismiss', disabled: false, busy: false },
    });
  });

  it('disables everything while a call is out and marks the one sent', () => {
    const sending = sendingOf({ kind: 'option', option: 'Calendar' }, false);
    const controls = questionControls({ ...BASE, sending });
    expect(controls?.options).toEqual([
      { option: 'Calendar', label: 'Calendar', disabled: true, busy: true },
      { option: 'Customer story', label: 'Customer story', disabled: true, busy: false },
    ]);
    expect(controls?.dismiss?.disabled).toBe(true);
    const words = questionControls({
      ...BASE,
      options: [],
      text: 'Go',
      sending: sendingOf({ kind: 'words', text: 'Go' }, false),
    });
    expect(words?.answer).toEqual({ label: 'Answer', disabled: true, busy: true });
    expect(words?.field).toEqual({ disabled: true });
    const dismissing = questionControls({
      ...BASE,
      confirming: true,
      sending: sendingOf(null, true),
    });
    expect(dismissing?.confirm?.dismiss).toEqual({ label: 'Dismiss', disabled: true, busy: true });
    expect(dismissing?.confirm?.keep.disabled).toBe(true);
    expect(sendingOf(undefined, false)).toBeNull();
  });

  it('gives a role that may not answer no controls at all', () => {
    expect(questionControls({ ...BASE, mayAnswer: false })).toBeNull();
    expect(questionControls({ ...BASE, mayAnswer: false, confirming: true })).toBeNull();
  });
});
