// The approval sheet's one read, through the foundation's client (D-ONE-CLIENT): an approval grant's
// ApprovalView@1 (GET /api/v1/approval-grants/{grant_id}/view), parsed with the one schema the cards
// read it with (src/core/approval-view.ts). The language is the client's Accept-Language. A refusal
// is the client's ApiError; a view whose grant is not the one asked for is no view at all.

import { z } from 'zod';

import type { ApiClient } from '../api/client';
import { ApprovalViewSchema, type ApprovalView } from '../core/approval-view';
import { APPROVAL_ROUTES } from './routes';

/** The view of `grantId` only: one that names another grant is the client's invalid_response. */
function viewOf(grantId: string) {
  return ApprovalViewSchema.refine((view) => view.grant_id === grantId, {
    message: 'the view names another grant',
  }) as z.ZodType<ApprovalView, z.ZodTypeDef, unknown>;
}

export function fetchApprovalView(
  client: Pick<ApiClient, 'request'>,
  grantId: string,
  signal?: AbortSignal,
): Promise<ApprovalView> {
  return client.request(APPROVAL_ROUTES.view, {
    params: { grant_id: grantId },
    schema: viewOf(grantId),
    signal,
  });
}
