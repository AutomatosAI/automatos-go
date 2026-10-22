// A ticket's Deliverables (the web's task-deliverables-panel.tsx): GET /api/deliverables with
// ?source_id=<row id>, the files registered against the ticket, through the one client and the
// shared key family (query-keys.ts 'deliverables', persisted). Each row opens the Deliverable
// (routes.cc.deliverable). The schema keeps only what a row shows; D25: no review state, no
// approve, no 'DLV-' id: a Deliverable is opened, never decided.

import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import type { ApiClient } from '../../api/client';
import { queryKeys } from '../../api/query-keys';
import { logger } from '../../lib/logger';
import { isUsableId, routes } from '../../navigation/routes';
import { joinLabel } from '../../ui/paint';
import { CC_ROUTES } from '../routes';
import { BOARD_COPY } from '../strings';

/** A ticket rarely has more; the gallery has the rest. */
export const LINKED_DELIVERABLES_LIMIT = 5;

const LinkedRowSchema = z.object({
  /** A UUID, as the server sends it. */
  id: z.string().refine(isUsableId),
  title: z.string().catch(''),
  artifact_type: z.string().nullable().catch(null),
});

export type LinkedDeliverable = Readonly<z.output<typeof LinkedRowSchema>>;

/** {deliverables: [...]}: a row this version cannot read is left out, never the list. */
export const LinkedDeliverablesSchema = z.object({
  deliverables: z.array(z.unknown()).transform((items): LinkedDeliverable[] =>
    items.flatMap((item) => {
      const parsed = LinkedRowSchema.safeParse(item);
      if (parsed.success) return [parsed.data];
      logger.debug('[cc/ticket] left out a Deliverable this version cannot read');
      return [];
    }),
  ),
});

export function fetchLinkedDeliverables(
  client: ApiClient,
  taskId: string,
  signal?: AbortSignal,
): Promise<LinkedDeliverable[]> {
  return client
    .request(CC_ROUTES.deliverables.list, {
      query: { source_id: taskId, limit: LINKED_DELIVERABLES_LIMIT },
      schema: LinkedDeliverablesSchema,
      signal,
    })
    .then((body) => body.deliverables);
}

export function linkedDeliverablesQuery(
  client: ApiClient,
  workspaceId: string | null,
  taskId: string,
) {
  return queryOptions({
    queryKey: queryKeys.deliverables(workspaceId, {
      source_id: taskId,
      limit: LINKED_DELIVERABLES_LIMIT,
    }),
    queryFn: ({ signal }) => fetchLinkedDeliverables(client, taskId, signal),
  });
}

export type LinkedDeliverableView = {
  readonly id: string;
  readonly title: string;
  /** 'Report', 'Spreadsheet': the type as a word; null when the server sent none. */
  readonly kind: string | null;
  /** routes.cc.deliverable(id). */
  readonly href: string;
  readonly accessibilityLabel: string;
};

/** 'spreadsheet' → 'Spreadsheet', 'slide_deck' → 'Slide deck'. */
function kindWord(type: string | null): string | null {
  const words = type?.replace(/[_-]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : null;
}

export function linkedDeliverableViews(
  rows: readonly LinkedDeliverable[],
): LinkedDeliverableView[] {
  return rows.map((row) => {
    const title = row.title.trim() || BOARD_COPY.untitled;
    const kind = kindWord(row.artifact_type);
    return {
      id: row.id,
      title,
      kind,
      href: routes.cc.deliverable(row.id),
      accessibilityLabel: joinLabel(title, kind),
    };
  });
}
