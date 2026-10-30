import { describe, expect, it } from 'vitest';

import {
  KEY_FAMILIES,
  familyOf,
  isPersistableKey,
  matchesFamily,
  queryKeys,
  type KeyFamilyName,
} from '../query-keys';

const WS = '7f1c2a54-0000-4000-8000-000000000001';

/** One key per family, built the way the kits will build them. */
const SAMPLES: Readonly<Record<KeyFamilyName, readonly unknown[]>> = {
  workspace: queryKeys.workspace(),
  discovery: queryKeys.discovery('https://api.example.test'),
  needsYou: queryKeys.needsYou(),
  board: queryKeys.board({ finished_limit: 200 }),
  ticket: queryKeys.ticket('42'),
  schedule: queryKeys.schedule('7d'),
  questions: queryKeys.questions('pending', 'question'),
  socialPost: queryKeys.socialPost(WS, 'post-1'),
  suggestions: queryKeys.suggestions('open'),
  deliverables: queryKeys.deliverables(WS, { kind: 'document' }),
  deliverable: queryKeys.deliverable(WS, 'd-1', true),
  'chat.thread': queryKeys.chat.thread('chat-1'),
  'chat.messages': queryKeys.chat.messages('chat-1'),
  'chat.history': queryKeys.chat.history(50),
  'chat.agents': queryKeys.chat.agents(),
};

const PERSISTED: readonly KeyFamilyName[] = [
  'workspace',
  'discovery',
  'board',
  'schedule',
  'deliverables',
];

describe('query keys', () => {
  it('has a builder for every family and a family for every builder', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(KEY_FAMILIES).sort());
  });

  it.each(Object.entries(SAMPLES))(
    '%s: its key belongs to it and to no other family',
    (name, key) => {
      expect(familyOf(key)).toBe(name);
      const claimedBy = (Object.keys(KEY_FAMILIES) as KeyFamilyName[]).filter((family) =>
        matchesFamily(family, key),
      );
      expect(claimedBy).toEqual([name]);
    },
  );

  it("matches the web's keys where the web has the family", () => {
    expect(queryKeys.needsYou()).toEqual(['activity', 'needs-you']);
    expect(queryKeys.board()).toEqual(['board', 'tasks', null]);
    expect(queryKeys.ticket('42')).toEqual(['board', 'task', '42']);
    expect(queryKeys.schedule('14d')).toEqual(['activity', 'schedule', '14d']);
    expect(queryKeys.questions()).toEqual(['approval-grants', 'list', 'all', 'all']);
    expect(queryKeys.deliverable(WS, 'd-1', false)).toEqual([
      'deliverables',
      WS,
      'detail',
      'd-1',
      false,
    ]);
    expect(queryKeys.chat.history()).toEqual(['chat-history', 'conversations', null]);
    expect(queryKeys.chat.agents()).toEqual(['agents']);
  });

  it('claims no key outside the families', () => {
    expect(familyOf(['workspace-models', WS])).toBeNull();
    expect(familyOf(['activity', 'stats', '7d'])).toBeNull();
    expect(familyOf([])).toBeNull();
  });
});

describe('the persist filter', () => {
  it.each(PERSISTED)('%s is persisted', (name) => {
    expect(isPersistableKey(SAMPLES[name])).toBe(true);
  });

  it.each((Object.keys(SAMPLES) as KeyFamilyName[]).filter((name) => !PERSISTED.includes(name)))(
    '%s is never persisted',
    (name) => {
      expect(isPersistableKey(SAMPLES[name])).toBe(false);
    },
  );

  it('never persists chat bodies, chat threads or question text, whatever follows the prefix', () => {
    expect(isPersistableKey(['chat', 'messages', 'c-1', 'page', 2])).toBe(false);
    expect(isPersistableKey(['chat', 'thread', 'c-1'])).toBe(false);
    expect(isPersistableKey(['approval-grants', 'list', 'pending', 'question'])).toBe(false);
    expect(isPersistableKey(['approval-grants'])).toBe(false);
  });

  it('never persists a key no family claims (an allowlist)', () => {
    expect(isPersistableKey(['workspace-models'])).toBe(false);
    expect(isPersistableKey(['deliverables', WS, 'stats'])).toBe(false);
  });
});
