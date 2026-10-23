// One Deliverable's page, pure (D-DELIVERABLES, D25, D15): the head the gallery's card already
// words (type, title, who made it when, 'Run failed'), then the file as the phone can show it: text
// inline as paragraphs (a note when the server sent only its first megabyte), an image inline with
// the bearer, a PDF, DOCX or XLSX behind an Open button for the system viewer, anything else in
// Studio. 'Report this' shows only where the foundation's gate says so. No review state, no
// Approve or Request changes, no made-up id: a Deliverable is read, never decided.

import type { GateInput } from '../../api/capabilities';
import { isApiError, userMessage } from '../../api/errors';
import type { ReportTarget } from '../../api/reports';
import type { WorkspaceRole } from '../../api/workspace';
import { deliverableHref } from '../../core/web/lib/chat/deliverables';
import type { RouteParams } from '../../navigation/routes';
import { studioUrl } from '../../navigation/web-links';
import { canReport } from '../../ui/report';
import { plainParagraphs } from '../questions/plain';
import { DELIVERABLE_COPY } from '../strings';
import { fileKind, isMonoText, viewerFormat } from './file-kind';
import { fileHref, fileLink, viewerFileName, type FileLink } from './file-source';
import { deliverableCard, type CardClock, type DeliverableCardView } from './gallery';
import type { DeliverableDetail } from './schemas';

/** The route's own parameter: app/(app)/cc/deliverables/[id].tsx (routes.cc.deliverable). */
export const DELIVERABLE_ID_PARAM = 'id';
/** A Deliverable id is a UUID (deliverable_service.py `str(row.id)`). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BLANK_LINES = /\n[ \t]*\n+/;
const LINE_ENDS = /[ \t]+$/gm;

/** The Deliverable id from the route, or null when it is missing or not a UUID. */
export function deliverableIdParam(params: RouteParams): string | null {
  const value = params[DELIVERABLE_ID_PARAM];
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text && UUID.test(text) ? text : null;
}

export type DetailBody =
  | {
      readonly kind: 'text';
      readonly paragraphs: readonly string[];
      /** Code and data keep their lines in the mono face. */
      readonly mono: boolean;
      /** Over the server's 1 MB: only the first part is here. */
      readonly truncated: boolean;
    }
  | { readonly kind: 'image'; readonly link: FileLink }
  | {
      readonly kind: 'viewer';
      readonly link: FileLink;
      /** The downloaded copy's name, with the format's extension. */
      readonly fileName: string;
      readonly label: string;
    }
  /** Nothing the phone can show: why, and Studio. */
  | { readonly kind: 'studio'; readonly note: string };

export type DeliverableDetailView = Pick<
  DeliverableCardView,
  'id' | 'kind' | 'typeWord' | 'title' | 'meta' | 'failed'
> & {
  /** The summary's paragraphs beside a file that is not text; none beside text, which speaks for itself. */
  readonly summary: readonly string[];
  readonly body: DetailBody;
  /** The Deliverable in Studio, or null when this build has no web address. */
  readonly studioUrl: string | null;
};

export type DetailContext = {
  readonly clock: CardClock;
  readonly apiUrl: string;
  readonly webUrl: string;
};

/** Code or data split at its blank lines, every line kept as written but for trailing spaces. */
export function monoParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(BLANK_LINES)
    .map((block) => block.replace(LINE_ENDS, '').replace(/^\n+|\n+$/g, ''))
    .filter((block) => block.trim() !== '');
}

const studio = (note: string): DetailBody => ({ kind: 'studio', note });

function textBody(detail: DeliverableDetail): DetailBody {
  if (detail.content === null) {
    return studio(detail.content_error ? DELIVERABLE_COPY.unreadable : DELIVERABLE_COPY.notShown);
  }
  const mono = isMonoText(detail);
  const paragraphs = mono ? monoParagraphs(detail.content) : plainParagraphs(detail.content);
  if (paragraphs.length === 0) return studio(DELIVERABLE_COPY.emptyFile);
  return { kind: 'text', paragraphs, mono, truncated: detail.content_truncated };
}

function viewerBody(detail: DeliverableDetail, link: FileLink | null): DetailBody {
  const format = viewerFormat(detail);
  if (!format || !link) return studio(DELIVERABLE_COPY.noFile);
  return {
    kind: 'viewer',
    link,
    fileName: viewerFileName(detail.file_name, format),
    label: DELIVERABLE_COPY.open[format],
  };
}

export function detailBody(detail: DeliverableDetail, apiUrl: string): DetailBody {
  const link = fileLink(fileHref(detail), apiUrl);
  switch (fileKind(detail)) {
    case 'inline-text':
      return textBody(detail);
    case 'inline-image':
      return link ? { kind: 'image', link } : studio(DELIVERABLE_COPY.noFile);
    case 'system-viewer':
      return viewerBody(detail, link);
    default:
      return studio(DELIVERABLE_COPY.notShown);
  }
}

export function deliverableDetailView(
  detail: DeliverableDetail,
  context: DetailContext,
): DeliverableDetailView {
  const { id, kind, typeWord, title, meta, failed } = deliverableCard(detail, context.clock);
  const body = detailBody(detail, context.apiUrl);
  return {
    id,
    kind,
    typeWord,
    title,
    meta,
    failed,
    summary: body.kind === 'text' ? [] : plainParagraphs(detail.summary),
    body,
    studioUrl: studioUrl(deliverableHref(id), context.webUrl),
  };
}

/** What 'Report this' files, or null when the gate says no (the server or the role). */
export function reportTarget(
  id: string,
  discovery: GateInput,
  role: WorkspaceRole | null | undefined,
): ReportTarget | null {
  return canReport(discovery, role) ? { target_type: 'deliverable', target_id: id } : null;
}

/** Why the file did not open: the taxonomy's words for the download, else the viewer's. */
export function openFailureMessage(error: unknown): string {
  return isApiError(error) ? userMessage(error) : DELIVERABLE_COPY.viewerFailed;
}
