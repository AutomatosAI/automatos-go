// One suggestion as core W1's list answers it (ProactiveSuggestion.to_dict), parsed as the phone does.

import { SuggestionListSchema, type Suggestion } from '../schema';

export function suggestion(id: string, extra: Record<string, unknown> = {}): Suggestion {
  const [parsed] = SuggestionListSchema.parse({
    suggestions: [
      {
        id,
        title: `Idea ${id}`,
        detail: `Because ${id}`,
        proposed_action: { kind: 'board_task', payload: { agent_id: 4 } },
        severity: 'today',
        status: 'open',
        created_at: '2026-10-28T08:00:00Z',
        expires_at: '2026-11-04T08:00:00Z',
        est_credits: 40,
        ...extra,
      },
    ],
  }).suggestions;
  if (!parsed) throw new Error('fixture did not parse');
  return parsed;
}
