import { describe, expect, it } from 'vitest';

import { createApiClient } from '../client';
import { ApiError } from '../errors';
import {
  REPORT_NOTE_MAX_CHARS,
  REPORT_REASONS,
  REPORT_TARGET_ID_MAX_CHARS,
  ReportReceiptSchema,
  buildReportPayload,
  reportContent,
  type ReportInput,
} from '../reports';
import { routes } from '../routes';
import { SERVER, fakeTransport, jsonReply, type FakeTransport } from './fake-transport';

const MESSAGE_ID = '5b0e7c1e-0000-4000-8000-00000000a001';
const WORKSPACE_ID = '7f1c2a54-0000-4000-8000-000000000001';

const INPUT: ReportInput = { target_type: 'message', target_id: MESSAGE_ID, reason: 'inaccurate' };

function clientWith(transport: FakeTransport) {
  return createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => WORKSPACE_ID,
    transport,
  });
}

async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ApiError)) throw new Error(`expected an ApiError, got ${String(error)}`);
  return error;
}

describe('REPORT_REASONS', () => {
  it("is the server's list, in its order (PRD-266 US-016a)", () => {
    expect(REPORT_REASONS).toEqual(['harmful', 'offensive', 'inaccurate', 'privacy', 'other']);
  });
});

describe('buildReportPayload', () => {
  it('sends the target, the reason id and no note when none was written', () => {
    expect(buildReportPayload(INPUT)).toEqual({
      target_type: 'message',
      target_id: MESSAGE_ID,
      reason: 'inaccurate',
    });
  });

  it('trims the note and leaves a blank one out', () => {
    expect(buildReportPayload({ ...INPUT, note: '  wrong date  ' }).note).toBe('wrong date');
    expect(buildReportPayload({ ...INPUT, note: '   ' })).not.toHaveProperty('note');
    expect(buildReportPayload({ ...INPUT, note: null })).not.toHaveProperty('note');
  });

  it('takes a note of exactly 500 characters and refuses one longer', () => {
    const longest = 'n'.repeat(REPORT_NOTE_MAX_CHARS);
    expect(buildReportPayload({ ...INPUT, note: longest }).note).toBe(longest);
    expect(() => buildReportPayload({ ...INPUT, note: `${longest}n` })).toThrow(TypeError);
  });

  it('refuses what the server would refuse, before anything is sent', () => {
    const bad = [
      { ...INPUT, reason: 'spam' },
      { ...INPUT, target_type: 'ticket' },
      { ...INPUT, target_id: '  ' },
      { ...INPUT, target_id: 'x'.repeat(REPORT_TARGET_ID_MAX_CHARS + 1) },
    ] as unknown as ReportInput[];
    for (const input of bad) expect(() => buildReportPayload(input)).toThrow(TypeError);
  });

  it('keeps the note out of the error message (it is user content)', () => {
    const note = `secret ${'n'.repeat(REPORT_NOTE_MAX_CHARS)}`;
    expect(() => buildReportPayload({ ...INPUT, note })).toThrow(/note: too_big/);
    expect(() => buildReportPayload({ ...INPUT, note })).not.toThrow(/secret/);
  });

  it('does not touch its input', () => {
    const input = Object.freeze({ ...INPUT, note: ' x ' });
    buildReportPayload(input);
    expect(input.note).toBe(' x ');
  });
});

describe('ReportReceiptSchema', () => {
  it('reads a new report and a repeated one', () => {
    expect(ReportReceiptSchema.parse({ report_id: 42, status: 'received' })).toEqual({
      report_id: 42,
      status: 'received',
    });
    expect(ReportReceiptSchema.parse({ report_id: 42, status: 'already_received' }).status).toBe(
      'already_received',
    );
  });

  it('ignores unknown fields and reads an unknown status as received', () => {
    expect(ReportReceiptSchema.parse({ report_id: '42', status: 'queued', excerpt: 'x' })).toEqual({
      report_id: '42',
      status: 'received',
    });
  });

  it('refuses a body without a report id', () => {
    expect(ReportReceiptSchema.safeParse({ status: 'received' }).success).toBe(false);
  });
});

describe('reportContent', () => {
  it('POSTs the payload as JSON to /api/v1/reports with the bearer and workspace', async () => {
    const transport = fakeTransport(() => jsonReply(201, { report_id: 7, status: 'received' }));
    const receipt = await reportContent(clientWith(transport), {
      target_type: 'deliverable',
      target_id: 'DLV-0311',
      reason: 'privacy',
      note: 'has a phone number',
    });

    const [call] = transport.calls;
    expect(receipt).toEqual({ report_id: 7, status: 'received' });
    expect(call?.method).toBe('POST');
    expect(call?.url).toBe(`${SERVER.apiUrl}${routes.reports.path}`);
    expect(call?.headers.Authorization).toBe('Bearer jwt.token.value');
    expect(call?.headers['X-Workspace-ID']).toBe(WORKSPACE_ID);
    expect(call?.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(call?.body))).toEqual({
      target_type: 'deliverable',
      target_id: 'DLV-0311',
      reason: 'privacy',
      note: 'has a phone number',
    });
  });

  it('reads the 200 for a report this member already made', async () => {
    const transport = fakeTransport(() =>
      jsonReply(200, { report_id: 7, status: 'already_received' }),
    );
    expect((await reportContent(clientWith(transport), INPUT)).status).toBe('already_received');
  });

  it('maps a target the reporter cannot see to not_found', async () => {
    const transport = fakeTransport(() =>
      jsonReply(404, {
        detail: { code: 'report_target_not_found', message: 'That message was not found.' },
      }),
    );
    const error = await failureOf(reportContent(clientWith(transport), INPUT));
    expect(error.kind).toBe('not_found');
    expect(error.code).toBe('report_target_not_found');
  });

  it('maps a 503 (not saved) to server and an unreadable answer to invalid_response', async () => {
    const down = fakeTransport(() => jsonReply(503, { detail: 'The report could not be saved.' }));
    expect((await failureOf(reportContent(clientWith(down), INPUT))).kind).toBe('server');
    const odd = fakeTransport(() => jsonReply(201, { ok: true }));
    expect((await failureOf(reportContent(clientWith(odd), INPUT))).kind).toBe('invalid_response');
  });

  it('sends nothing for a payload the server would refuse', async () => {
    const transport = fakeTransport(() => jsonReply(201, { report_id: 1, status: 'received' }));
    await expect(reportContent(clientWith(transport), { ...INPUT, target_id: '' })).rejects.toThrow(
      TypeError,
    );
    expect(transport.calls).toHaveLength(0);
  });
});
