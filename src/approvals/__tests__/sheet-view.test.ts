import { describe, expect, it } from 'vitest';

import { ApprovalViewSchema } from '../../core/approval-view';
import { approvalSheetView, minutesLeft } from '../sheet-view';
import { APPROVAL_SHEET_COPY } from '../strings';
import { NOW, VIEW } from './fixtures';

const view = (extra: Record<string, unknown> = {}) =>
  ApprovalViewSchema.parse({ ...VIEW, ...extra });

describe('approvalSheetView', () => {
  it('says who asked, the action, the target, the preview and the rule, in that order', () => {
    const sheet = approvalSheetView(view(), 'tool', NOW);
    expect(sheet.askedBy).toBe('Auto asks');
    expect(sheet.title).toBe('Send an email');
    expect(sheet.target).toBe('Press list · 214 people · Gmail');
    expect(sheet.preview).toEqual({ kind: 'text', body: 'Subject: Automatos at WebSummit Lisbon' });
    expect(sheet.rule).toBe(
      'Asking because of your rule: Ask before anything that sends to other people',
    );
    // VoiceOver hears the rule before any button
    expect(sheet.accessibilityLabel).toBe(
      'Auto asks. Send an email. Press list · 214 people · Gmail. Asking because of your rule: Ask before anything that sends to other people',
    );
  });

  it('keeps today’s words until Always allow ships: Approve & run, Deny or Reject', () => {
    expect(approvalSheetView(view(), 'tool', NOW)).toMatchObject({
      allow: 'Approve & run',
      refuse: 'Deny',
    });
    expect(approvalSheetView(view(), 'plan', NOW)).toMatchObject({
      allow: 'Approve & run',
      refuse: 'Reject',
    });
    for (const words of Object.values(APPROVAL_SHEET_COPY)) {
      if (typeof words === 'string') expect(words).not.toMatch(/Allow once|Refuse/);
    }
  });

  it('labels the preview by the action’s verb, neutral for one it does not name', () => {
    expect(approvalSheetView(view(), 'tool', NOW).previewLabel).toBe('What it will send');
    const pay = view({ action: { verb: 'pay', summary: 'Pay the invoice' } });
    expect(approvalSheetView(pay, 'tool', NOW).previewLabel).toBe('What it will pay');
    const odd = view({ action: { verb: 'teleport', summary: 'Move it' } });
    expect(approvalSheetView(odd, 'tool', NOW).previewLabel).toBe('Exactly what it will do');
  });

  it('offers Always allow only when the answers hold it', () => {
    expect(approvalSheetView(view(), 'tool', NOW).alwaysAllow).toBe(false);
    const offered = view({ answers: ['refuse', 'allow_once', 'always_allow'] });
    expect(approvalSheetView(offered, 'tool', NOW).alwaysAllow).toBe(true);
  });

  it('counts the wait down in minutes, and stops offering Allow once it lapsed', () => {
    expect(approvalSheetView(view(), 'tool', NOW).waiting).toBe('Waiting · 5 min left');
    const lapsed = approvalSheetView(view(), 'tool', Date.parse('2026-10-28T09:11:00Z'));
    expect(lapsed).toMatchObject({
      expired: true,
      allow: null,
      refuse: 'Deny',
      waiting: APPROVAL_SHEET_COPY.expired,
    });
    expect(approvalSheetView(view({ expires_at: null }), 'tool', NOW).waiting).toBeNull();
    expect(minutesLeft('not a time', NOW)).toBeNull();
  });

  it('a view that names no answers offers today’s two', () => {
    const sheet = approvalSheetView(view({ answers: [] }), 'tool', NOW);
    expect([sheet.allow, sheet.refuse, sheet.alwaysAllow]).toEqual([
      'Approve & run',
      'Deny',
      false,
    ]);
  });

  it('draws no target line when the view names none', () => {
    expect(approvalSheetView(view({ target: null }), 'tool', NOW).target).toBeNull();
    expect(approvalSheetView(view({ target: { label: 'Aisha' } }), 'tool', NOW).target).toBe(
      'Aisha',
    );
  });
});
