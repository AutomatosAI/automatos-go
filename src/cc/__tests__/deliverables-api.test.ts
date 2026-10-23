import { describe, expect, it } from 'vitest';

import { AUTHORIZATION_HEADER, WORKSPACE_HEADER } from '../../api/auth-headers';
import { createApiClient } from '../../api/client';
import { familyOf, isPersistableKey, queryKeys } from '../../api/query-keys';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import type { TransportRequest } from '../../api/transport-types';
import {
  deliverableQuery,
  fetchDeliverable,
  fetchDeliverablesPage,
  galleryQuery,
} from '../deliverables/api';
import { GALLERY_PAGE_SIZE, type DeliverablePage } from '../deliverables/gallery';
import { DeliverableListSchema, type DeliverableRow } from '../deliverables/schemas';
import { linkedDeliverablesQuery } from '../ticket/linked';

// US-013a: the Deliverables' calls (api.ts, schemas.ts) through the one client, and their keys.
const WS = '7f1c2a54-0000-4000-8000-000000000001';
const ID_1 = '0b6f1c2e-1111-4a1b-8c1d-000000000001';
const API = `${SERVER.apiUrl}/api/deliverables`;

// GET /api/deliverables at the pinned SHA: DeliverableService._row_to_dict plus with_knowledge_state.
const WIRE_ROW = {
  id: ID_1,
  workspace_id: WS,
  source_type: 'task',
  source_id: '2680',
  agent_id: 7,
  agent_name: 'Scout',
  artifact_type: 'report',
  title: 'Competitor pricing — July to October',
  summary: 'Four of six competitors raised entry-tier prices.',
  storage_type: 'workspace',
  file_path: 'reports/pricing.md',
  file_name: 'pricing.md',
  file_type: 'text/markdown',
  file_size_bytes: 4096,
  preview_url: `/api/workspaces/${WS}/files/content?path=reports%2Fpricing.md`,
  preview_type: 'markdown',
  thumbnail_url: null,
  extra: { tags: ['q4'] },
  tags: ['q4'],
  status: 'ready',
  created_at: '2026-10-23T06:06:00+00:00',
  updated_at: '2026-10-23T06:06:00+00:00',
  knowledge_document_id: null,
};

/** A page of `count` rows, as the gallery keeps it. */
function pageOf(offset: number, count: number, total: number | null): DeliverablePage {
  const rows = Array.from({ length: count }, (_, index): DeliverableRow => ({
    id: `row-${offset + index}`,
    artifact_type: 'report',
    source_type: 'task',
    agent_name: 'Scout',
    title: 'T',
    summary: null,
    preview_url: null,
    created_at: null,
    status: 'ready',
  }));
  return { offset, deliverables: rows, total };
}

function clientAnswering(answer: (request: TransportRequest) => ReturnType<typeof jsonReply>) {
  const transport = fakeTransport(answer);
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'token',
    getWorkspaceId: () => WS,
    transport,
  });
  return { client, transport };
}

const listOf = (rows: readonly unknown[], total: number | null = rows.length) =>
  jsonReply(200, { success: true, deliverables: rows, total, limit: GALLERY_PAGE_SIZE, offset: 0 });

describe('the gallery list call', () => {
  it('asks for one page of every type, heartbeats left out as Studio does, with the bearer', async () => {
    const { client, transport } = clientAnswering(() => listOf([WIRE_ROW]));
    const result = await fetchDeliverablesPage(client, null, 0);
    expect(transport.calls[0]).toMatchObject({
      method: 'GET',
      url: `${API}?source_type_exclude=heartbeat&limit=${GALLERY_PAGE_SIZE}&offset=0`,
    });
    expect(transport.calls[0].headers).toMatchObject({
      [AUTHORIZATION_HEADER]: 'Bearer token',
      [WORKSPACE_HEADER]: WS,
    });
    expect(result).toEqual({
      offset: 0,
      total: 1,
      deliverables: [
        {
          id: ID_1,
          artifact_type: 'report',
          source_type: 'task',
          agent_name: 'Scout',
          title: WIRE_ROW.title,
          summary: WIRE_ROW.summary,
          preview_url: WIRE_ROW.preview_url,
          created_at: WIRE_ROW.created_at,
          status: 'ready',
        },
      ],
    });
  });

  it('filters by type on the server and pages by offset', async () => {
    const { client, transport } = clientAnswering(() => listOf([], 30));
    const result = await fetchDeliverablesPage(client, 'spreadsheet', 24);
    expect(transport.calls[0].url).toBe(
      `${API}?artifact_type=spreadsheet&source_type_exclude=heartbeat&limit=${GALLERY_PAGE_SIZE}&offset=24`,
    );
    expect(result.offset).toBe(24);
  });

  it('treats the 200 that says success: false as a failure, never an empty gallery', async () => {
    const { client } = clientAnswering(() =>
      jsonReply(200, { success: false, error: 'list failed: boom', deliverables: [], total: 0 }),
    );
    await expect(fetchDeliverablesPage(client, null, 0)).rejects.toMatchObject({ kind: 'server' });
  });

  it('leaves out a row it cannot read, keeps unknown statuses and types, ignores unknown fields', () => {
    const parsed = DeliverableListSchema.parse({
      success: true,
      deliverables: [
        { ...WIRE_ROW, status: 'archived', artifact_type: 'slide_deck', title: null },
        { ...WIRE_ROW, id: 'DLV-0311' },
        { title: 'no id' },
        'junk',
      ],
    });
    expect(parsed.total).toBeNull();
    expect(parsed.deliverables).toHaveLength(1);
    expect(parsed.deliverables[0]).toMatchObject({
      status: 'archived',
      artifact_type: 'slide_deck',
      title: '',
    });
    expect(parsed.deliverables[0]).not.toHaveProperty('file_path');
  });
});

describe('the gallery query', () => {
  it('is keyed by workspace and filter in the persisted Deliverables family', () => {
    const { client } = clientAnswering(() => listOf([]));
    const key = galleryQuery(client, WS, 'image').queryKey;
    expect(key).toEqual(
      queryKeys.deliverables(WS, {
        artifact_type: 'image',
        source_type_exclude: 'heartbeat',
        limit: GALLERY_PAGE_SIZE,
      }),
    );
    expect(familyOf(key)).toBe('deliverables');
    expect(isPersistableKey(key)).toBe(true);
  });

  it('never shares a cache entry with a ticket’s Deliverables', () => {
    const { client } = clientAnswering(() => listOf([]));
    expect(galleryQuery(client, WS, null).queryKey).not.toEqual(
      linkedDeliverablesQuery(client, WS, '2680').queryKey,
    );
    expect(galleryQuery(client, WS, null).queryKey).not.toEqual(
      galleryQuery(client, WS, 'report').queryKey,
    );
  });

  it('starts at offset 0 and asks for the next page only while there is one', () => {
    const { client } = clientAnswering(() => listOf([]));
    const options = galleryQuery(client, WS, null);
    expect(options.initialPageParam).toBe(0);
    const full = pageOf(0, GALLERY_PAGE_SIZE, 30);
    expect(options.getNextPageParam(full, [full], 0, [0])).toBe(GALLERY_PAGE_SIZE);
    const last = pageOf(GALLERY_PAGE_SIZE, 1, 25);
    expect(options.getNextPageParam(last, [full, last], 24, [0, 24])).toBeUndefined();
  });
});

describe('one Deliverable', () => {
  it('asks for it with its content and keeps the file facts and the cut', async () => {
    const { client, transport } = clientAnswering(() =>
      jsonReply(200, {
        success: true,
        deliverable: {
          ...WIRE_ROW,
          content: '# Pricing',
          content_url: `/api/workspaces/${WS}/files/content?path=reports%2Fpricing.md`,
          content_truncated: true,
        },
      }),
    );
    const detail = await fetchDeliverable(client, ID_1);
    expect(transport.calls[0].url).toBe(`${API}/${ID_1}?include_content=true`);
    expect(detail).toMatchObject({
      id: ID_1,
      content: '# Pricing',
      content_truncated: true,
      content_error: null,
      file_name: 'pricing.md',
      file_type: 'text/markdown',
    });
  });

  it('reads an image row without content (streamed by URL) and says not truncated', async () => {
    const { client } = clientAnswering(() =>
      jsonReply(200, {
        success: true,
        deliverable: { ...WIRE_ROW, artifact_type: 'image', content: null },
      }),
    );
    const detail = await fetchDeliverable(client, ID_1);
    expect(detail.content).toBeNull();
    expect(detail.content_truncated).toBe(false);
    expect(detail.content_url).toBeNull();
  });

  it('maps a missing one to not_found and keys it in the unpersisted family', async () => {
    const { client } = clientAnswering(() => jsonReply(404, { detail: 'Deliverable not found' }));
    await expect(fetchDeliverable(client, ID_1)).rejects.toMatchObject({ kind: 'not_found' });
    const key = deliverableQuery(client, WS, ID_1).queryKey;
    expect(key).toEqual(queryKeys.deliverable(WS, ID_1, true));
    expect(isPersistableKey(key)).toBe(false);
  });
});
