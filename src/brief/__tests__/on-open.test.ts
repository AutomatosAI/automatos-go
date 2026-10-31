import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import { servedAtPin } from '../../api/__tests__/served';
import { openBrief, type BriefOpenBody } from '../api';
import { BRIEF_ROUTES } from '../routes';
import {
  FALLBACK_TIME_ZONE,
  answersTheDay,
  createBriefOpener,
  localDateIn,
  refusalSettlesTheDay,
} from '../on-open';
import type { BriefOpen } from '../schema';

const LATE_UTC = new Date('2026-10-28T23:30:00Z');
const POSTED: BriefOpen = { chat_id: 'c1', message_id: 'm1', posted: true, pending: false };
const TAKEN: BriefOpen = { chat_id: 'c1', message_id: 'm1', posted: false, pending: false };
const PENDING: BriefOpen = { chat_id: null, message_id: null, posted: false, pending: true };

describe('localDateIn: the phone’s date in its zone', () => {
  it('reads the date where the phone is, not UTC’s', () => {
    expect(localDateIn(LATE_UTC, 'Europe/Lisbon')).toBe('2026-10-28');
    expect(localDateIn(LATE_UTC, 'Asia/Tokyo')).toBe('2026-10-29');
    expect(localDateIn(LATE_UTC, 'America/Los_Angeles')).toBe('2026-10-28');
  });

  it("falls back to the phone's own clock for no zone or one the engine cannot read", () => {
    const own = localDateIn(LATE_UTC, null);
    expect(own).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(localDateIn(LATE_UTC, 'Mars/Olympus')).toBe(own);
  });
});

function opener(answers: (BriefOpen | Error)[], zone: string | null = 'Europe/Lisbon') {
  const now = { at: new Date('2026-10-28T08:00:00Z') };
  const open = vi.fn(async (_body: BriefOpenBody) => {
    const next = answers.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error('no answer left');
    return next;
  });
  const onAnswered = vi.fn();
  const subject = createBriefOpener({ open, now: () => now.at, timeZone: () => zone, onAnswered });
  return { subject, open, onAnswered, now };
}

describe('createBriefOpener: once per local date per workspace', () => {
  it('calls on the first foreground with the date and zone, then not again that day', async () => {
    const { subject, open, onAnswered } = opener([POSTED]);
    await subject.foreground('ws-1');
    await subject.foreground('ws-1');
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith({ local_date: '2026-10-28', timezone: 'Europe/Lisbon' });
    expect(onAnswered).toHaveBeenCalledWith(POSTED);
  });

  it('never sends two calls at once', async () => {
    const { subject, open } = opener([TAKEN]);
    await Promise.all([subject.foreground('ws-1'), subject.foreground('ws-1')]);
    expect(open).toHaveBeenCalledOnce();
  });

  it('calls again on a new local date and in another workspace', async () => {
    const { subject, open, now } = opener([POSTED, TAKEN, POSTED]);
    await subject.foreground('ws-1');
    await subject.foreground('ws-2');
    now.at = new Date('2026-10-29T07:00:00Z');
    await subject.foreground('ws-1');
    expect(open.mock.calls.map(([body]) => body.local_date)).toEqual([
      '2026-10-28',
      '2026-10-28',
      '2026-10-29',
    ]);
  });

  it('asks again on the next foreground while another device is still building it', async () => {
    const { subject, open, onAnswered } = opener([PENDING, TAKEN]);
    await subject.foreground('ws-1');
    expect(onAnswered).not.toHaveBeenCalled();
    await subject.foreground('ws-1');
    await subject.foreground('ws-1');
    expect(open).toHaveBeenCalledTimes(2);
    expect(onAnswered).toHaveBeenCalledWith(TAKEN);
  });

  it('asks again after a failure that may pass, never after a refusal that will not', async () => {
    const offline = opener([new ApiError('network'), POSTED]);
    await offline.subject.foreground('ws-1');
    await offline.subject.foreground('ws-1');
    expect(offline.open).toHaveBeenCalledTimes(2);
    const viewer = opener([new ApiError('forbidden', { status: 403 })]);
    await viewer.subject.foreground('ws-1');
    await viewer.subject.foreground('ws-1');
    expect(viewer.open).toHaveBeenCalledOnce();
  });

  it('sends UTC for a phone that reports no zone, or one the engine cannot read', async () => {
    const none = opener([POSTED], null);
    await none.subject.foreground('ws-1');
    expect(none.open.mock.calls[0][0].timezone).toBe(FALLBACK_TIME_ZONE);
    const unreadable = opener([POSTED], 'Mars/Olympus');
    await unreadable.subject.foreground('ws-1');
    expect(unreadable.open.mock.calls[0][0].timezone).toBe(FALLBACK_TIME_ZONE);
  });

  it('keeps one call per workspace in flight while another workspace calls', async () => {
    const release: (() => void)[] = [];
    const open = vi.fn(
      (_body: BriefOpenBody) =>
        new Promise<BriefOpen>((resolve) => release.push(() => resolve(POSTED))),
    );
    const subject = createBriefOpener({
      open,
      now: () => new Date('2026-10-28T08:00:00Z'),
      timeZone: () => 'Europe/Lisbon',
      onAnswered: () => undefined,
    });
    const first = subject.foreground('ws-1');
    const other = subject.foreground('ws-2');
    const again = subject.foreground('ws-1');
    release.forEach((done) => done());
    await Promise.all([first, other, again]);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('a call that answers after the date moved on leaves the new date open', async () => {
    const { subject, open, now } = opener([POSTED, POSTED]);
    const late = subject.foreground('ws-1');
    now.at = new Date('2026-10-29T07:00:00Z');
    await late;
    await subject.foreground('ws-1');
    expect(open.mock.calls.map(([body]) => body.local_date)).toEqual(['2026-10-28', '2026-10-29']);
  });
});

describe('what settles the day', () => {
  it('a message named, or posted; a 403, 404 or 422 refusal', () => {
    expect(answersTheDay(POSTED)).toBe(true);
    expect(answersTheDay(TAKEN)).toBe(true);
    expect(answersTheDay(PENDING)).toBe(false);
    expect(refusalSettlesTheDay(new ApiError('not_found', { status: 404 }))).toBe(true);
    expect(refusalSettlesTheDay(new ApiError('server', { status: 422 }))).toBe(true);
    expect(refusalSettlesTheDay(new ApiError('server', { status: 503 }))).toBe(false);
    expect(refusalSettlesTheDay(new Error('boom'))).toBe(false);
  });
});

describe('openBrief', () => {
  it('posts the date and zone to the brief route and reads the answer', async () => {
    const transport = fakeTransport(() =>
      jsonReply(200, { chat_id: 'c1', message_id: 'm1', posted: true }),
    );
    const client = createApiClient({
      server: SERVER,
      getToken: async () => 'token',
      getWorkspaceId: () => '7f1c2a54-0000-4000-8000-000000000001',
      transport,
    });
    await expect(
      openBrief(client, { local_date: '2026-10-28', timezone: 'Europe/Lisbon' }),
    ).resolves.toEqual(POSTED);
    const [call] = transport.calls;
    expect(`${call.method} ${call.url}`).toBe(`POST ${SERVER.apiUrl}${BRIEF_ROUTES.open.path}`);
    expect(JSON.parse(String(call.body))).toEqual({
      local_date: '2026-10-28',
      timezone: 'Europe/Lisbon',
    });
    expect(servedAtPin(BRIEF_ROUTES.open)).toBe(true);
    expect(BRIEF_ROUTES.open).not.toHaveProperty('pendingUpstream');
  });
});
