import { describe, expect, it } from 'vitest';

import { AUTHORIZATION_HEADER, WORKSPACE_HEADER } from '../../api/auth-headers';
import type { GateInput } from '../../api/capabilities';
import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import { SERVER, fakeTransport, reply } from '../../api/__tests__/fake-transport';
import {
  DELIVERABLE_ID_PARAM,
  deliverableDetailView,
  deliverableIdParam,
  detailBody,
  monoParagraphs,
  openFailureMessage,
  reportTarget,
} from '../deliverables/detail';
import {
  extensionOf,
  fileKind,
  isMonoText,
  viewerFormat,
  type FileFacts,
} from '../deliverables/file-kind';
import {
  authenticatedRequest,
  fileHref,
  fileLink,
  viewerFileName,
} from '../deliverables/file-source';
import type { DeliverableDetail } from '../deliverables/schemas';
import { DELIVERABLE_COPY } from '../strings';

// US-013b: the Deliverable's page, pure: how each file is shown (file-kind.ts), where it is loaded
// from and with which headers (file-source.ts, through the one client), the page's body and head
// (detail.ts) and the 'Report this' gate. open-file.ts's native half: open-file.test.ts.
const WS = '7f1c2a54-0000-4000-8000-000000000001';
const ID = '0b6f1c2e-1111-4a1b-8c1d-000000000001';
const RAW = `/api/workspaces/${WS}/files/raw?path=reports%2Fq3.pdf`;
const CONTENT = `/api/workspaces/${WS}/files/content?path=reports%2Fpricing.md`;
const NOW = new Date('2026-10-23T07:00:00Z');
const CONTEXT = {
  clock: { now: NOW, timeZone: 'Europe/London' },
  apiUrl: SERVER.apiUrl,
  webUrl: SERVER.webUrl,
};

/** GET /api/deliverables/{id}?include_content=true as the schema keeps it. */
function detail(overrides: Partial<DeliverableDetail> = {}): DeliverableDetail {
  return {
    id: ID,
    artifact_type: 'report',
    source_type: 'task',
    agent_name: 'Scout',
    title: 'Competitor pricing',
    summary: 'Four of six **raised** prices.',
    preview_url: CONTENT,
    content_url: CONTENT,
    created_at: '2026-10-23T06:06:00+00:00',
    status: 'ready',
    file_name: 'pricing.md',
    file_type: 'md',
    preview_type: 'file',
    content: '# Pricing\n\nFour of six **raised** prices.\n\n- Two added caps',
    content_truncated: false,
    content_error: null,
    ...overrides,
  };
}

const facts = (file_name: string | null, file_type: string | null, artifact_type = 'document') =>
  ({ file_name, file_type, artifact_type }) satisfies FileFacts;

describe('file-kind: type, MIME and extension → how the phone shows it', () => {
  it.each([
    [facts('q3.pdf', 'pdf'), 'system-viewer'],
    [facts('Plan.DOCX', null), 'system-viewer'],
    [facts(null, 'xlsx', 'spreadsheet'), 'system-viewer'],
    [facts('x', 'application/pdf'), 'system-viewer'],
    [
      facts('x', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      'system-viewer',
    ],
    [facts('chart.png', 'png', 'image'), 'inline-image'],
    [facts('photo', 'image/jpeg; charset=binary', 'image'), 'inline-image'],
    [facts(null, null, 'image'), 'inline-image'],
    [facts('pricing.md', 'md', 'report'), 'inline-text'],
    [facts('notes.txt', 'text/plain'), 'inline-text'],
    [facts('rows.csv', 'csv', 'spreadsheet'), 'inline-text'],
    [facts('main.py', 'py', 'code'), 'inline-text'],
    [facts(null, null, 'blog_post'), 'inline-text'],
    [facts(null, null, 'report'), 'inline-text'],
    [facts('report.bin', 'application/octet-stream', 'report'), 'unsupported'],
    [facts('logo.svg', 'image/svg+xml', 'image'), 'unsupported'],
    [facts('logo.svg', 'svg', 'image'), 'unsupported'],
    [facts('page.html', 'text/html', 'document'), 'unsupported'],
    [facts('deck.pptx', 'pptx', 'slide'), 'unsupported'],
    [facts('clip.mp4', 'video/mp4', 'video'), 'unsupported'],
    [facts('bundle.zip', 'zip', 'archive'), 'unsupported'],
    [facts(null, null, 'audio'), 'unsupported'],
    [facts(null, null, 'something_new'), 'unsupported'],
  ] as const)('%o → %s', (input, kind) => {
    expect(fileKind(input)).toBe(kind);
  });

  it('the MIME type speaks before the extension, and an unhelpful one lets the extension decide', () => {
    expect(fileKind(facts('scan.png', 'application/pdf'))).toBe('system-viewer');
    expect(fileKind(facts('q3.pdf', 'application/octet-stream'))).toBe('system-viewer');
  });

  it('reads the extension from the name, else a bare stored type', () => {
    expect(extensionOf(facts('Reports/Q3 Plan.PDF', 'application/pdf'))).toBe('pdf');
    expect(extensionOf(facts(null, '.xlsx'))).toBe('xlsx');
    expect(extensionOf(facts('README', 'text/markdown'))).toBe('');
  });

  it('names the viewer format from the MIME type or the extension, null for anything else', () => {
    expect(viewerFormat(facts('x', 'application/pdf'))).toBe('pdf');
    expect(viewerFormat(facts('plan.docx', null))).toBe('docx');
    expect(viewerFormat(facts('rows.csv', 'csv'))).toBeNull();
  });

  it('keeps code and data in the mono face, prose without its marks', () => {
    expect(isMonoText(facts('main.py', 'py', 'code'))).toBe(true);
    expect(isMonoText(facts('rows.csv', 'text/csv'))).toBe(true);
    expect(isMonoText(facts(null, 'application/json'))).toBe(true);
    expect(isMonoText(facts(null, null, 'code'))).toBe(true);
    expect(isMonoText(facts('pricing.md', 'md', 'report'))).toBe(false);
  });
});

describe("file-source: the file's link, resolved as the web's Open does", () => {
  it('takes preview_url, else content_url, else none', () => {
    expect(fileHref({ preview_url: RAW, content_url: CONTENT })).toBe(RAW);
    expect(fileHref({ preview_url: '  ', content_url: CONTENT })).toBe(CONTENT);
    expect(fileHref({ preview_url: null, content_url: null })).toBeNull();
  });

  it("puts an API route on this server's API, and a content route becomes the file's raw route", () => {
    expect(fileLink(RAW, SERVER.apiUrl)).toEqual({ kind: 'api', url: `${SERVER.apiUrl}${RAW}` });
    expect(fileLink(CONTENT, `${SERVER.apiUrl}/`)).toEqual({
      kind: 'api',
      url: `${SERVER.apiUrl}/api/workspaces/${WS}/files/raw?path=reports%2Fpricing.md`,
    });
  });

  it('keeps a content route whose path is not valid percent-encoding as the server sent it', () => {
    const broken = `/api/workspaces/${WS}/files/content?path=%E0%A4%A`;
    expect(fileLink(broken, SERVER.apiUrl)).toEqual({
      kind: 'api',
      url: `${SERVER.apiUrl}${broken}`,
    });
  });

  it("an absolute link on the API's origin is the API's; another site's is external", () => {
    const own = `${SERVER.apiUrl.toUpperCase()}/api/documents/generated/q3.pdf`;
    expect(fileLink(own, SERVER.apiUrl)).toEqual({ kind: 'api', url: own });
    expect(fileLink('https://cdn.example.org/q3.pdf', SERVER.apiUrl)).toEqual({
      kind: 'external',
      url: 'https://cdn.example.org/q3.pdf',
    });
  });

  it('follows nothing else: a protocol-relative link, a scheme, a bare name, a space', () => {
    for (const href of ['//evil.example/x.pdf', 'file:///etc/passwd', 'q3.pdf', '/api/x y', '']) {
      expect(fileLink(href, SERVER.apiUrl)).toBeNull();
    }
    expect(fileLink(null, SERVER.apiUrl)).toBeNull();
  });

  it("builds the download's URL and headers through the client: its bearer and workspace", async () => {
    const transport = fakeTransport(() => reply(200));
    const client = createApiClient({
      server: SERVER,
      getToken: async () => 'tok_123',
      getWorkspaceId: () => WS,
      transport,
    });
    const link = fileLink(RAW, client.server.apiUrl);
    if (link?.kind !== 'api') throw new Error('expected an API link');
    await expect(authenticatedRequest(client, link)).resolves.toEqual({
      url: `${SERVER.apiUrl}${RAW}`,
      headers: { [AUTHORIZATION_HEADER]: 'Bearer tok_123', [WORKSPACE_HEADER]: WS },
    });
    expect(transport.calls).toEqual([]); // the headers only: the native load sends them
  });

  it('signed out, the download carries no header at all', async () => {
    const client = createApiClient({
      server: SERVER,
      getToken: async () => null,
      getWorkspaceId: () => WS,
      transport: fakeTransport(() => reply(200)),
    });
    const request = await authenticatedRequest(client, {
      kind: 'api',
      url: `${SERVER.apiUrl}${RAW}`,
    });
    expect(request.headers).toEqual({});
  });

  it("names the viewer's copy safely, with the format's extension", () => {
    expect(viewerFileName('Q3 plan (final).pdf', 'pdf')).toBe('Q3-plan-final.pdf');
    expect(viewerFileName('reports/../q3.PDF', 'pdf')).toBe('q3.pdf');
    expect(viewerFileName('budget', 'xlsx')).toBe('budget.xlsx');
    expect(viewerFileName('../', 'docx')).toBe('deliverable.docx');
    expect(viewerFileName(null, 'pdf')).toBe('deliverable.pdf');
    expect(viewerFileName(`${'a'.repeat(200)}.pdf`, 'pdf')).toBe(`${'a'.repeat(96)}.pdf`);
  });
});

describe("detail: the page's body", () => {
  it('shows prose as plain paragraphs, without its marks', () => {
    expect(detailBody(detail(), SERVER.apiUrl)).toEqual({
      kind: 'text',
      paragraphs: ['Pricing', 'Four of six raised prices.', '• Two added caps'],
      mono: false,
      truncated: false,
    });
  });

  it('keeps code as written, line for line, split at blank lines', () => {
    const code = 'def a():\n    return 1  \n\n\n# not a heading\nb = a()\n';
    expect(monoParagraphs(code)).toEqual(['def a():\n    return 1', '# not a heading\nb = a()']);
    const body = detailBody(
      detail({ artifact_type: 'code', file_name: 'a.py', file_type: 'py', content: code }),
      SERVER.apiUrl,
    );
    expect(body).toMatchObject({ kind: 'text', mono: true });
  });

  it('says when only the first part of the file came (content_truncated)', () => {
    expect(detailBody(detail({ content_truncated: true }), SERVER.apiUrl)).toMatchObject({
      kind: 'text',
      truncated: true,
    });
  });

  it('text the phone did not get is left to Studio, with why', () => {
    const unread = detail({ content: null, content_error: 'Could not read file' });
    expect(detailBody(unread, SERVER.apiUrl)).toEqual({
      kind: 'studio',
      note: DELIVERABLE_COPY.unreadable,
    });
    expect(detailBody(detail({ content: null }), SERVER.apiUrl)).toEqual({
      kind: 'studio',
      note: DELIVERABLE_COPY.notShown,
    });
    expect(detailBody(detail({ content: '\n\n' }), SERVER.apiUrl)).toEqual({
      kind: 'studio',
      note: DELIVERABLE_COPY.emptyFile,
    });
  });

  it('an image loads from its raw route on the API', () => {
    const image = detail({
      artifact_type: 'image',
      file_name: 'chart.png',
      file_type: 'png',
      preview_url: `/api/workspaces/${WS}/files/raw?path=chart.png`,
      content: null,
    });
    expect(detailBody(image, SERVER.apiUrl)).toEqual({
      kind: 'image',
      link: { kind: 'api', url: `${SERVER.apiUrl}/api/workspaces/${WS}/files/raw?path=chart.png` },
    });
    expect(detailBody({ ...image, preview_url: null, content_url: null }, SERVER.apiUrl)).toEqual({
      kind: 'studio',
      note: DELIVERABLE_COPY.noFile,
    });
  });

  it('a PDF, DOCX or XLSX gets the Open button for the system viewer', () => {
    const pdf = detail({
      artifact_type: 'document',
      file_name: 'Q3 plan.pdf',
      file_type: 'pdf',
      preview_url: RAW,
      content_url: RAW,
      content: '%PDF-1.7 …',
    });
    expect(detailBody(pdf, SERVER.apiUrl)).toEqual({
      kind: 'viewer',
      link: { kind: 'api', url: `${SERVER.apiUrl}${RAW}` },
      fileName: 'Q3-plan.pdf',
      label: DELIVERABLE_COPY.open.pdf,
    });
    const sheet = { ...pdf, file_name: 'budget.xlsx', file_type: 'xlsx' };
    expect(detailBody(sheet, SERVER.apiUrl)).toMatchObject({ label: DELIVERABLE_COPY.open.xlsx });
    expect(detailBody({ ...pdf, preview_url: null, content_url: null }, SERVER.apiUrl)).toEqual({
      kind: 'studio',
      note: DELIVERABLE_COPY.noFile,
    });
  });

  it('anything else opens in Studio through the web-link mapping', () => {
    const deck = detail({ artifact_type: 'slide', file_name: 'deck.pptx', file_type: 'pptx' });
    const view = deliverableDetailView(deck, CONTEXT);
    expect(view.body).toEqual({ kind: 'studio', note: DELIVERABLE_COPY.notShown });
    expect(view.studioUrl).toBe(`${SERVER.webUrl}/deliverables?deliverable=${ID}`);
    expect(deliverableDetailView(deck, { ...CONTEXT, webUrl: '' }).studioUrl).toBeNull();
  });
});

describe("detail: the page's head", () => {
  it("is the gallery card's words, and no review state or made-up id (D25)", () => {
    const view = deliverableDetailView(detail(), CONTEXT);
    expect(view).toMatchObject({
      id: ID,
      kind: 'report',
      typeWord: 'Report',
      title: 'Competitor pricing',
      failed: null,
    });
    expect(view.meta).toMatch(/^Scout · /);
    expect(JSON.stringify(view)).not.toMatch(/DLV-|Approve|Request changes|Awaiting/);
  });

  it("words a failed run's report, and an untitled one", () => {
    const view = deliverableDetailView(detail({ status: 'failed', title: ' ' }), CONTEXT);
    expect(view.failed).toBe('Run failed');
    expect(view.title).toBe('Untitled');
  });

  it('shows the summary beside a file that is not text, not beside text', () => {
    expect(deliverableDetailView(detail(), CONTEXT).summary).toEqual([]);
    const pdf = detail({ file_name: 'q3.pdf', file_type: 'pdf', preview_url: RAW });
    expect(deliverableDetailView(pdf, CONTEXT).summary).toEqual(['Four of six raised prices.']);
  });
});

describe('the route id', () => {
  it('is a UUID, or nothing', () => {
    expect(deliverableIdParam({ [DELIVERABLE_ID_PARAM]: ` ${ID} ` })).toBe(ID);
    expect(deliverableIdParam({ [DELIVERABLE_ID_PARAM]: [ID, 'x'] })).toBe(ID);
    expect(deliverableIdParam({ [DELIVERABLE_ID_PARAM]: 'DLV-0311' })).toBeNull();
    expect(deliverableIdParam({})).toBeNull();
  });
});

describe("'Report this' and a file that did not open", () => {
  const WITH_REPORTS: GateInput = { capabilities: ['report_content'], push: { expo: false } };
  const WITHOUT_REPORTS: GateInput = { capabilities: [], push: { expo: false } };

  it('files a Deliverable report where the gate says so', () => {
    for (const role of ['owner', 'admin', 'editor'] as const) {
      expect(reportTarget(ID, WITH_REPORTS, role)).toEqual({
        target_type: 'deliverable',
        target_id: ID,
      });
    }
  });

  it('is hidden when the server does not take reports, for a viewer, and while either loads', () => {
    expect(reportTarget(ID, WITHOUT_REPORTS, 'owner')).toBeNull();
    expect(reportTarget(ID, WITH_REPORTS, 'viewer')).toBeNull();
    expect(reportTarget(ID, WITH_REPORTS, null)).toBeNull();
    expect(reportTarget(ID, null, 'owner')).toBeNull();
  });

  it("a failed download says the taxonomy's words; a viewer that cannot show it, its own", () => {
    expect(openFailureMessage(new ApiError('not_found', { status: 404 }))).toBe(
      API_ERROR_COPY.not_found,
    );
    expect(openFailureMessage(new Error('no app opens .xlsx files'))).toBe(
      DELIVERABLE_COPY.viewerFailed,
    );
  });
});
