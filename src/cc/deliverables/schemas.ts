// The Deliverables' wire shapes (D-ONE-CLIENT: zod at the boundary, unknown fields ignored). A row
// is services/deliverable_service.py _row_to_dict at the pinned SHA. The gallery's pages are
// persisted (query-keys.ts 'deliverables'), so a row keeps only what a card reads and what opening
// it needs; the detail (never persisted) adds the file's facts and the inline content. D25: a
// Deliverable has no review state. `status` is 'ready', or 'failed' for a failed run's report
// (shown_status); any other word is kept as sent. A row this version cannot read is left out,
// never the whole page.

import { z } from 'zod';

import { logger } from '../../lib/logger';

const Text = z.string().nullable().catch(null);

const ROW_FIELDS = {
  /** A UUID, as the server sends it: what routes.cc.deliverable takes. */
  id: z.string().uuid(),
  /** report, image, document, code, slide, spreadsheet, blog_post, video, … (types.ts words it). */
  artifact_type: Text,
  /** What made it: chat, task, mission, heartbeat, playbook, trigger, upload, … */
  source_type: Text,
  agent_name: Text,
  title: z.string().catch(''),
  summary: Text,
  /**
   * Usually an API route behind the bearer (/api/workspaces/{id}/files/raw?path=…): fetched with the
   * client's headers, never opened in a browser.
   */
  preview_url: Text,
  /** Sent with include_content=true only: the route to the whole file. */
  content_url: Text.optional(),
  created_at: Text,
  status: Text,
} as const;

export const DeliverableRowSchema = z.object(ROW_FIELDS);

export type DeliverableRow = Readonly<z.output<typeof DeliverableRowSchema>>;

/** The rows that parse; one this version cannot read is logged and left out. */
const Rows = z.array(z.unknown()).transform((items): DeliverableRow[] =>
  items.flatMap((item) => {
    const parsed = DeliverableRowSchema.safeParse(item);
    if (parsed.success) return [parsed.data];
    logger.debug('[cc/deliverables] left out a Deliverable this version cannot read');
    return [];
  }),
);

/**
 * GET /api/deliverables: {success, deliverables, total, limit, offset, error?}. A failed list still
 * answers 200, with success: false (list_deliverables); its error text is the server's internals,
 * so it is never parsed and never shown.
 */
export const DeliverableListSchema = z.object({
  success: z.boolean().optional(),
  deliverables: Rows,
  /** Every Deliverable the filter matches; null when an older server leaves it out. */
  total: z.number().int().nonnegative().nullable().catch(null),
});

export type DeliverableList = Readonly<z.output<typeof DeliverableListSchema>>;

/** GET /api/deliverables/{deliverable_id}?include_content=true: the row and its file. */
export const DeliverableDetailSchema = z.object({
  ...ROW_FIELDS,
  content_url: Text,
  file_name: Text,
  /** The file's MIME type or extension, as stored. */
  file_type: Text,
  preview_type: Text,
  /** Text inline, up to 1 MB; null for images and videos (streamed by URL) and unread files. */
  content: Text,
  /** Over the 1 MB cap: `content` is the file's first part only. */
  content_truncated: z.boolean().catch(false),
  /** The workspace could not read the file; the server's words are for the logs. */
  content_error: Text,
});

export type DeliverableDetail = Readonly<z.output<typeof DeliverableDetailSchema>>;

/** {success, deliverable}; a missing one is a 404 (api/deliverables.py get_deliverable). */
export const DeliverableDetailBodySchema = z.object({ deliverable: DeliverableDetailSchema });
