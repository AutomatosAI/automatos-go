// Every TanStack Query key the app uses (D-CACHE, K5): the chat (A2) and Command Centre (A3) kits
// build their keys here and never edit this file. Where the web has the family, the key is the
// web's own (automatos-ai frontend/hooks at the pinned SHA, cited per family), so an invalidation
// reads the same on both. Each family also says whether it may be persisted (query-client.ts):
// an allowlist, so a key no family claims is never written to the phone.

import type { QueryKey } from '@tanstack/react-query';

/** Filter values a list key carries; serialised into the key as given. */
export type KeyFilters = Readonly<Record<string, string | number | boolean | null | undefined>>;

export const queryKeys = Object.freeze({
  /** GET /api/workspaces/current (the web keeps it in workspace-provider state, not a query). */
  workspace: () => ['workspace', 'current'] as const,
  /** The discovery document of one server, by its API URL. */
  discovery: (apiUrl: string) => ['discovery', apiUrl] as const,
  /** use-needs-you.ts needsYouQueryKeys.all. */
  needsYou: () => ['activity', 'needs-you'] as const,
  /** use-board-tasks.ts boardQueryKeys.tasks(filters). */
  board: (filters?: KeyFilters) => ['board', 'tasks', filters ?? null] as const,
  /** use-board-tasks.ts boardQueryKeys.task(taskId): one ticket. */
  ticket: (taskId: string) => ['board', 'task', taskId] as const,
  /** use-activity-api.ts activityQueryKeys.schedule(range): '7d' | '14d' | '30d'. */
  schedule: (range: string) => ['activity', 'schedule', range] as const,
  /** use-approval-grants.ts approvalGrantsQueryKeys.list(status, kind). */
  questions: (status?: string, kind?: string) =>
    ['approval-grants', 'list', status ?? 'all', kind ?? 'all'] as const,
  /** One social post, under use-socials-api.ts socialsQueryKeys.posts(workspaceId). */
  socialPost: (workspaceId: string | null, postId: string) =>
    ['socials', workspaceId, 'posts', postId] as const,
  /** use-deliverables-api.ts deliverableQueryKeys.list(workspaceId, filters). */
  deliverables: (workspaceId: string | null, filters?: KeyFilters) =>
    ['deliverables', workspaceId, 'list', filters ?? null] as const,
  /**
   * PRD-268 W1: GET /api/proactive/suggestions?status= (src/suggestions); the web's hook is core
   * W2's (US-C21b), so the key is this app's own until then.
   */
  suggestions: (status: string) => ['proactive', 'suggestions', status] as const,
  /** use-deliverables-api.ts deliverableQueryKeys.detail(workspaceId, id, includeContent). */
  deliverable: (workspaceId: string | null, id: string, includeContent: boolean) =>
    ['deliverables', workspaceId, 'detail', id, includeContent] as const,
  chat: Object.freeze({
    /** GET /api/chat/{id}: the thread itself (checked before a cached id is reused, §4.4). */
    thread: (chatId: string) => ['chat', 'thread', chatId] as const,
    /** GET /api/chat/{id}/messages. */
    messages: (chatId: string) => ['chat', 'messages', chatId] as const,
    /** use-conversation-list.ts: CHAT_HISTORY_QUERY_PREFIX + 'conversations'. */
    history: (limit?: number) => ['chat-history', 'conversations', limit ?? null] as const,
    /** use-agent-api.ts agentQueryKeys.agents: who Auto can hand a chat to. */
    agents: () => ['agents'] as const,
  }),
});

/** Matches any one key segment (a workspace id inside a web key). */
const ANY = Symbol('any segment');
type Segment = string | typeof ANY;

export type KeyFamilyName =
  | 'workspace'
  | 'discovery'
  | 'needsYou'
  | 'board'
  | 'ticket'
  | 'schedule'
  | 'questions'
  | 'socialPost'
  | 'suggestions'
  | 'deliverables'
  | 'deliverable'
  | 'chat.thread'
  | 'chat.messages'
  | 'chat.history'
  | 'chat.agents';

type KeyFamily = {
  /** The key's leading segments; every key the family's builder makes starts with them. */
  readonly pattern: readonly Segment[];
  /**
   * May the encrypted cache keep it across launches (D-CACHE)? Lists that make a cold start
   * useful offline: yes. Chat bodies, chat threads, question text and single records: never.
   * What a persisted list keeps is what its zod schema keeps, so those schemas parse only the
   * fields the list shows.
   */
  readonly persist: boolean;
};

export const KEY_FAMILIES: Readonly<Record<KeyFamilyName, KeyFamily>> = Object.freeze({
  workspace: { pattern: ['workspace', 'current'], persist: true },
  discovery: { pattern: ['discovery'], persist: true },
  needsYou: { pattern: ['activity', 'needs-you'], persist: false },
  board: { pattern: ['board', 'tasks'], persist: true },
  ticket: { pattern: ['board', 'task'], persist: false },
  schedule: { pattern: ['activity', 'schedule'], persist: true },
  questions: { pattern: ['approval-grants'], persist: false },
  socialPost: { pattern: ['socials', ANY, 'posts'], persist: false },
  /** Suggestions carry Auto's words about the workspace: memory only. */
  suggestions: { pattern: ['proactive', 'suggestions'], persist: false },
  deliverables: { pattern: ['deliverables', ANY, 'list'], persist: true },
  deliverable: { pattern: ['deliverables', ANY, 'detail'], persist: false },
  'chat.thread': { pattern: ['chat', 'thread'], persist: false },
  'chat.messages': { pattern: ['chat', 'messages'], persist: false },
  'chat.history': { pattern: ['chat-history'], persist: false },
  'chat.agents': { pattern: ['agents'], persist: false },
});

const FAMILY_NAMES = Object.keys(KEY_FAMILIES) as readonly KeyFamilyName[];

function startsWith(key: QueryKey, pattern: readonly Segment[]): boolean {
  return (
    key.length >= pattern.length &&
    pattern.every((segment, index) => segment === ANY || segment === key[index])
  );
}

/** Does this key belong to that family? For invalidations that span families (live events). */
export function matchesFamily(name: KeyFamilyName, key: QueryKey): boolean {
  return startsWith(key, KEY_FAMILIES[name].pattern);
}

/** The family a key belongs to, or null for a key no family claims. */
export function familyOf(key: QueryKey): KeyFamilyName | null {
  return FAMILY_NAMES.find((name) => matchesFamily(name, key)) ?? null;
}

/** Only keys of a family marked persist; anything unclaimed stays in memory. */
export function isPersistableKey(key: QueryKey): boolean {
  const name = familyOf(key);
  return name !== null && KEY_FAMILIES[name].persist;
}
