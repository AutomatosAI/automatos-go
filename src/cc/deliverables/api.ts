// The Deliverables' calls, through the foundation's one client (D-ONE-CLIENT) and the route table
// (src/cc/routes.ts), under the foundation's keys: the gallery's pages are the persisted
// 'deliverables' family keyed by the workspace and the filter, one Deliverable the unpersisted
// 'deliverable'. The gallery pages by offset like Studio's (useDeliverables): 'Load more' asks for
// the next offset until the server's total is reached. Nothing here deletes (D63): the soft DELETE
// is the server's only change to a Deliverable, and the app never calls it.

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { queryKeys } from '../../api/query-keys';
import { CC_ROUTES } from '../routes';
import {
  galleryFilters,
  galleryParams,
  nextOffset,
  type DeliverablePage,
  type GalleryFilter,
} from './gallery';
import {
  DeliverableDetailBodySchema,
  DeliverableListSchema,
  type DeliverableDetail,
} from './schemas';

/** One page of the gallery; the server's 200 with success: false is a failure, not an empty page. */
export async function fetchDeliverablesPage(
  client: ApiClient,
  filter: GalleryFilter,
  offset: number,
  signal?: AbortSignal,
): Promise<DeliverablePage> {
  const body = await client.request(CC_ROUTES.deliverables.list, {
    query: galleryParams(filter, offset),
    schema: DeliverableListSchema,
    signal,
  });
  if (body.success === false) {
    throw new ApiError('server', {
      cause: new Error('the Deliverables list answered success: false'),
    });
  }
  return { offset, deliverables: body.deliverables, total: body.total };
}

/** The gallery under one filter: its pages, from offset 0, each next one at nextOffset. */
export function galleryQuery(client: ApiClient, workspaceId: string | null, filter: GalleryFilter) {
  return infiniteQueryOptions({
    queryKey: queryKeys.deliverables(workspaceId, galleryFilters(filter)),
    queryFn: ({ pageParam, signal }) => fetchDeliverablesPage(client, filter, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last: DeliverablePage) => nextOffset(last) ?? undefined,
  });
}

/** One Deliverable with its text inline (up to 1 MB; content_truncated past it). */
export function fetchDeliverable(
  client: ApiClient,
  deliverableId: string,
  signal?: AbortSignal,
): Promise<DeliverableDetail> {
  return client
    .request(CC_ROUTES.deliverables.detail, {
      params: { deliverable_id: deliverableId },
      query: { include_content: true },
      schema: DeliverableDetailBodySchema,
      signal,
    })
    .then((body) => body.deliverable);
}

/** One Deliverable's query, with its content (never persisted: query-keys.ts 'deliverable'). */
export function deliverableQuery(client: ApiClient, workspaceId: string | null, id: string) {
  return queryOptions({
    queryKey: queryKeys.deliverable(workspaceId, id, true),
    queryFn: ({ signal }) => fetchDeliverable(client, id, signal),
  });
}
