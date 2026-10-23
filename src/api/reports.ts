// Content reports (D15, PRD-266 §4.8 / US-016a): "Report this" on an Auto message or a Deliverable
// sends POST /api/v1/reports {target_type, target_id, reason, note?}. The server refuses any other
// field (422), takes the reasons and limits below (services/content_reports/__init__.py on
// automatos-ai's feat/prd-266-w3-store-duties: REPORT_REASONS, NOTE_MAX_CHARS, TARGET_ID_MAX_CHARS)
// and answers {report_id, status}: 201 'received' for a new report, 200 'already_received' when
// this member reported the same thing before. The route is not at the pinned SHA yet, so the sheet
// stays hidden until the discovery document lists report_content (capabilities.ts).

import { z } from 'zod';

import type { ApiClient } from './client';
import { routes } from './routes';

export const REPORT_TARGET_TYPES = ['message', 'deliverable'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/** The server's REPORT_REASONS, in its order (lead, 20 Oct): the payload sends the id. */
export const REPORT_REASONS = ['harmful', 'offensive', 'inaccurate', 'privacy', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_NOTE_MAX_CHARS = 500;
export const REPORT_TARGET_ID_MAX_CHARS = 64;

export type ReportTarget = {
  readonly target_type: ReportTargetType;
  readonly target_id: string;
};

export type ReportInput = ReportTarget & {
  readonly reason: ReportReason;
  readonly note?: string | null;
};

/** The request body exactly as the server takes it: no other field (extra="forbid" there). */
export const ReportRequestSchema = z
  .object({
    target_type: z.enum(REPORT_TARGET_TYPES),
    target_id: z.string().min(1).max(REPORT_TARGET_ID_MAX_CHARS),
    reason: z.enum(REPORT_REASONS),
    note: z.string().min(1).max(REPORT_NOTE_MAX_CHARS).optional(),
  })
  .strict();

export type ReportRequest = Readonly<z.output<typeof ReportRequestSchema>>;

export const REPORT_STATUSES = ['received', 'already_received'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** report_id is an integer today; a string id is read too. A status this version doesn't know is a new report. */
export const ReportReceiptSchema = z.object({
  report_id: z.union([z.number(), z.string()]),
  status: z.enum(REPORT_STATUSES).catch('received'),
});

export type ReportReceipt = Readonly<z.output<typeof ReportReceiptSchema>>;

function issueSummary(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.code}`).join('; ');
}

/**
 * The body for POST /api/v1/reports: the id trimmed, the note trimmed and left out when blank.
 * Input the sheet should never produce (an unknown reason, a note over 500 characters) is a
 * programming error and throws a TypeError before anything is sent.
 */
export function buildReportPayload(input: ReportInput): ReportRequest {
  const note = input.note?.trim();
  const result = ReportRequestSchema.safeParse({
    target_type: input.target_type,
    target_id: input.target_id.trim(),
    reason: input.reason,
    ...(note ? { note } : {}),
  });
  if (!result.success) {
    throw new TypeError(`Not a report the server takes (${issueSummary(result.error)})`);
  }
  return result.data;
}

/** Files the report; the taxonomy's ApiError on failure (404 when the target is not visible). */
export async function reportContent(
  client: ApiClient,
  input: ReportInput,
  signal?: AbortSignal,
): Promise<ReportReceipt> {
  return client.request(routes.reports, {
    body: buildReportPayload(input),
    schema: ReportReceiptSchema,
    signal,
  });
}
