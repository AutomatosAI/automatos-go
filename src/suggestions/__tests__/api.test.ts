import { describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import { servedAtPin } from '../../api/__tests__/served';
import { fetchOpenSuggestions, hideSuggestion, startSuggestion } from '../api';
import { SUGGESTION_ROUTES } from '../routes';
import { SuggestionListSchema, StartResultSchema } from '../schema';

const ID = '5b0c3f7e-8a51-4c1f-9d2e-0f6a7b8c9d10';

function serving(body: unknown) {
  const transport = fakeTransport(() => jsonReply(200, body));
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'token',
    getWorkspaceId: () => '7f1c2a54-0000-4000-8000-000000000001',
    transport,
  });
  return { client, transport };
}

const wire = (call: { method: string; url: string; body?: unknown }) => ({
  line: `${call.method} ${call.url}`,
  body: call.body === undefined ? undefined : JSON.parse(String(call.body)),
});

describe('the suggestion calls', () => {
  it('reads the open list and only what the phone draws', async () => {
    const { client, transport } = serving({
      suggestions: [
        { id: ID, title: 'Turn tickets into an FAQ', detail: 'd', est_credits: 40, evidence: [] },
        { id: '', title: 'no id' },
      ],
    });
    const list = await fetchOpenSuggestions(client);
    expect(list.map((each) => each.id)).toEqual([ID]);
    expect(list[0]).not.toHaveProperty('est_credits');
    expect(wire(transport.calls[0]).line).toBe(
      `GET ${SERVER.apiUrl}${SUGGESTION_ROUTES.list.path}?status=open&limit=20`,
    );
  });

  it('starts with via go and reads what it made', async () => {
    const { client, transport } = serving({
      suggestion: { id: ID, title: 'T', status: 'started' },
      opens: { type: 'board_task', board_task_id: 2680 },
    });
    const started = await startSuggestion(client, ID);
    expect(started.opens).toEqual({ type: 'board_task', board_task_id: 2680, suggestion_id: null });
    expect(wire(transport.calls[0])).toEqual({
      line: `POST ${SERVER.apiUrl}/api/proactive/suggestions/${ID}/start`,
      body: { via: 'go' },
    });
  });

  it('hides with the reason chosen, or none', async () => {
    const { client, transport } = serving({ suggestion: { id: ID, title: 'T', status: 'hidden' } });
    await hideSuggestion(client, ID, 'not_useful');
    await hideSuggestion(client, ID, null);
    expect(transport.calls.map((call) => wire(call).body)).toEqual([
      { reason: 'not_useful', via: 'go' },
      { via: 'go' },
    ]);
  });

  it('has every route on the server at the core pin, so none is marked pendingUpstream', () => {
    for (const route of Object.values(SUGGESTION_ROUTES)) {
      expect({ route, served: servedAtPin(route) }).toEqual({ route, served: true });
      expect(route).not.toHaveProperty('pendingUpstream');
    }
  });

  it('reads a chat Start and an unknown opens without failing', () => {
    expect(StartResultSchema.parse({ opens: { type: 'chat', suggestion_id: ID } }).opens).toEqual({
      type: 'chat',
      board_task_id: null,
      suggestion_id: ID,
    });
    expect(StartResultSchema.parse({ opens: 'x' }).opens).toBeNull();
    expect(SuggestionListSchema.parse({}).suggestions).toEqual([]);
  });
});
