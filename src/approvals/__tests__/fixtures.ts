// ApprovalView@1 as core W2 adds it to a tool_approval or mission_approval payload (US-C20a).

export const VIEW = Object.freeze({
  grant_id: '31',
  asked_by: { kind: 'auto', name: 'Auto' },
  action: { verb: 'send', summary: 'Send an email' },
  target: { label: 'Press list · 214 people', detail: 'Gmail' },
  preview: { kind: 'text', body: 'Subject: Automatos at WebSummit Lisbon' },
  rule: { id: 'confirm.send', sentence: 'Ask before anything that sends to other people' },
  answers: ['refuse', 'allow_once'],
  expires_at: '2026-10-28T09:10:00Z',
});

export const NOW = Date.parse('2026-10-28T09:05:30Z');
