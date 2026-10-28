// The preference logic (PRD-001 §4.7, D-TYPES, D-DIGEST, D-PAYLOAD, KP12): the type → events map,
// each switch's state, the bulk PUT body that keeps every other row of the events it names, the
// digest's switch and time, and who may hide question text. Writes go through the foundation's fake
// transport, so nothing touches the network.

import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Capability } from '../../api/discovery';
import { jsonReply } from '../../api/__tests__/fake-transport';
import { preferencesSchema, type PreferenceRow, type Preferences } from '../schemas/server';
import {
  DIGEST_DEFAULT,
  DIGEST_TIMES,
  digestOn,
  digestShown,
  digestTimeChange,
  digestTimeOf,
  isDigestTime,
  saveDigest,
  saveDigestTime,
  setDigest,
} from '../settings/digest';
import {
  PUSH_TYPE_EVENTS,
  PUSH_TYPE_SWITCHES,
  pushTypesOf,
  savePushType,
  setPushType,
  switchState,
} from '../settings/prefs';
import { canRedact, redactNote, redactState, saveRedact } from '../settings/redact';
import { PUSH_PREFS_COPY } from '../strings';
import { DEVICE_ID, DEVICE_ROW, PREFERENCES, harness, sent } from './data-fixtures';
import { deepFreeze } from './inbound-fixtures';
import { importsOf, sources } from './source-files';

const NEEDS = PUSH_TYPE_EVENTS.needs_answer;
const CHANNEL = 'c0ffee00-1111-4222-8333-444455556666';

const row = (
  event_type: string,
  destination: string,
  enabled: boolean,
  channel_connection_id: string | null = null,
): PreferenceRow => ({ event_type, destination, enabled, channel_connection_id });

/** GET as a person with a Slack route and a bell row for questions, and a review push row off. */
const ROWS: readonly PreferenceRow[] = deepFreeze([
  row('question_pending', 'in_app', true),
  row('question_pending', 'push', true),
  row('question_pending', 'slack', false, CHANNEL),
  row('approval_pending', 'in_app', false),
  row('review_pending', 'push', false),
  row('task_complete', 'in_app', true),
  row('daily_digest', 'push', true),
]);

const answer = (rows: readonly PreferenceRow[], push_types?: unknown): Preferences =>
  deepFreeze(preferencesSchema.parse({ success: true, preferences: rows, push_types }));

describe('the push type map (W2 K8, US-014a)', () => {
  it('falls back to the named map: three push types and the digest row', () => {
    expect(PUSH_TYPE_EVENTS).toEqual({
      needs_answer: ['question_pending', 'approval_pending', 'mission_plan_ready'],
      review: ['review_pending'],
      auto_message: ['auto_message'],
      digest: ['daily_digest'],
    });
    expect(pushTypesOf(answer(ROWS))).toBe(PUSH_TYPE_EVENTS);
    expect(pushTypesOf(answer(ROWS, { needs_answer: 'broken' }))).toBe(PUSH_TYPE_EVENTS);
    expect(PUSH_TYPE_SWITCHES).toEqual(['needs_answer', 'review', 'auto_message']);
  });

  it("takes GET's map when it sends one", () => {
    const served = { ...PREFERENCES.push_types, review: ['review_pending', 'review_reopened'] };
    expect(pushTypesOf(answer(ROWS, served))).toEqual(served);
    expect(pushTypesOf(preferencesSchema.parse(PREFERENCES))).toEqual(PREFERENCES.push_types);
  });
});

describe("a switch's state (no push row means on, W2 K7)", () => {
  it('is on when every push row of its events is enabled, whatever the other destinations', () => {
    expect(switchState(ROWS, NEEDS)).toBe(true);
    expect(switchState(ROWS, PUSH_TYPE_EVENTS.digest)).toBe(true);
  });

  it('is off when its push rows are off', () => {
    expect(switchState(ROWS, PUSH_TYPE_EVENTS.review)).toBe(false);
    const off = [row('question_pending', 'push', false), row('approval_pending', 'push', false)];
    expect(switchState(off, NEEDS)).toBe(false);
  });

  it('is off when mixed: one event on and another off', () => {
    const mixed = [row('question_pending', 'push', true), row('mission_plan_ready', 'push', false)];
    expect(switchState(mixed, NEEDS)).toBe(false);
  });

  it('is on for events with no push row, and other events never count', () => {
    expect(switchState([], NEEDS)).toBe(true);
    expect(switchState(ROWS, PUSH_TYPE_EVENTS.auto_message)).toBe(true);
    expect(switchState([row('review_pending', 'push', false)], NEEDS)).toBe(true);
  });
});

describe('the PUT body (KP12: it replaces every row of each event it names)', () => {
  it('sends every row of the named events, only the push rows changed, and adds a missing one', () => {
    expect(setPushType(ROWS, NEEDS, false)).toEqual([
      row('question_pending', 'in_app', true),
      row('question_pending', 'push', false),
      row('question_pending', 'slack', false, CHANNEL),
      row('approval_pending', 'in_app', false),
      row('approval_pending', 'push', false),
      row('mission_plan_ready', 'push', false),
    ]);
  });

  it('turns a switch on the same way and never sends another event', () => {
    const body = setPushType(ROWS, PUSH_TYPE_EVENTS.review, true);
    expect(body).toEqual([row('review_pending', 'push', true)]);
    expect(body.map((item) => item.event_type)).not.toContain('task_complete');
  });

  it('adds one push row per event, even when an event is named twice', () => {
    expect(setPushType([], ['auto_message', 'auto_message'], true)).toEqual([
      row('auto_message', 'push', true),
    ]);
  });

  it('never changes the rows it was given and answers a new, frozen array', () => {
    const before = structuredClone(ROWS);
    const body = setPushType(ROWS, NEEDS, false);
    expect(ROWS).toEqual(before);
    expect(body).not.toBe(ROWS);
    expect(Object.isFrozen(body)).toBe(true);
    expect(body.every((item) => Object.isFrozen(item) && !ROWS.includes(item))).toBe(true);
  });

  it('sends the body to PUT /api/notification-preferences once', async () => {
    const { client, calls } = harness(() => jsonReply(200, { success: true, updated_count: 6 }));
    const saved = await savePushType(client, ROWS, NEEDS, false);
    expect(saved.updated_count).toBe(6);
    expect(calls).toHaveLength(1);
    expect(sent(calls[0])).toMatchObject({
      method: 'PUT',
      path: '/api/notification-preferences',
      body: { preferences: setPushType(ROWS, NEEDS, false) },
    });
  });
});

describe('the daily digest (D-DIGEST, W2 K12)', () => {
  it("offers three times and defaults to the server's 08:00", () => {
    expect(DIGEST_TIMES).toEqual(['07:00', '08:00', '09:00']);
    expect(DIGEST_DEFAULT).toBe('08:00');
    expect(DIGEST_TIMES.every(isDigestTime)).toBe(true);
    expect(['10:00', '7:00', null, 8].some(isDigestTime)).toBe(false);
  });

  it("reads this phone's time from its row, else the default", () => {
    expect(digestTimeOf({ digest_time: '07:00' })).toBe('07:00');
    expect(digestTimeOf({ digest_time: null })).toBe(DIGEST_DEFAULT);
    expect(digestTimeOf(null)).toBe(DIGEST_DEFAULT);
    expect(digestTimeOf(undefined)).toBe(DIGEST_DEFAULT);
  });

  it("PATCHes THIS phone's row with the time, and refuses one the picker does not offer", async () => {
    const { client, calls } = harness(() =>
      jsonReply(200, { ...DEVICE_ROW, digest_time: '07:00' }),
    );
    expect(digestTimeChange('09:00')).toEqual({ digest_time: '09:00' });
    expect((await saveDigestTime(client, DEVICE_ID, '07:00')).digest_time).toBe('07:00');
    expect(sent(calls[0])).toMatchObject({
      method: 'PATCH',
      path: `/api/v1/mobile/devices/${DEVICE_ID}`,
      body: { digest_time: '07:00' },
    });
    expect(() => digestTimeChange('10:00')).toThrow(TypeError);
    expect(() => saveDigestTime(client, DEVICE_ID, '06:30')).toThrow(TypeError);
    expect(calls).toHaveLength(1);
  });

  it("is the 'daily_digest' push row: on with no row, and switched through the bulk PUT", async () => {
    expect(digestOn(preferencesSchema.parse(PREFERENCES))).toBe(false);
    expect(digestOn(answer([]))).toBe(true);
    const both = answer([...ROWS, row('daily_digest', 'in_app', true)]);
    expect(setDigest(both, false)).toEqual([
      row('daily_digest', 'push', false),
      row('daily_digest', 'in_app', true),
    ]);
    const { client, calls } = harness(() => jsonReply(200, { success: true, updated_count: 1 }));
    await saveDigest(client, answer([]), true);
    expect(sent(calls[0]).body).toEqual({ preferences: [row('daily_digest', 'push', true)] });
  });

  it("shows only with the 'push' and 'digest' capabilities and push through Expo", () => {
    const doc = (capabilities: Capability[], expo = true) => ({ capabilities, push: { expo } });
    expect(digestShown(doc(['push', 'digest']))).toBe(true);
    expect(digestShown(doc(['push']))).toBe(false);
    expect(digestShown(doc(['digest']))).toBe(false);
    expect(digestShown(doc(['push', 'digest'], false))).toBe(false);
    expect(digestShown(null)).toBe(false);
  });
});

describe('hiding question text (D-PAYLOAD, D-ROLES, W2 US-014b)', () => {
  it('lets owners and admins change it, nobody else', () => {
    const matrix = (['owner', 'admin', 'editor', 'viewer', null, undefined] as const).map(
      canRedact,
    );
    expect(matrix).toEqual([true, true, false, false, false, false]);
  });

  it("reads the workspace's switch, off until it says otherwise", () => {
    expect(redactState({ redactQuestions: true })).toBe(true);
    expect(redactState({ redactQuestions: false })).toBe(false);
    expect(redactState(null)).toBe(false);
    expect(redactState(undefined)).toBe(false);
  });

  it('tells editors and viewers who can change it', () => {
    expect(redactNote('owner')).toBeNull();
    expect(redactNote('admin')).toBeNull();
    expect(redactNote('editor')).toBe('Your workspace owner or admin can change this.');
    expect(redactNote('viewer')).toBe(PUSH_PREFS_COPY.redactLocked);
    expect(redactNote(null)).toBe(PUSH_PREFS_COPY.redactLocked);
  });

  it('PUTs {redact_questions} for an owner and answers what the server saved', async () => {
    const { client, calls } = harness(() => jsonReply(200, { push: { redact_questions: true } }));
    await expect(saveRedact(client, 'owner', true)).resolves.toBe(true);
    expect(sent(calls[0])).toEqual({
      method: 'PUT',
      path: '/api/v1/mobile/push-settings',
      query: expect.anything(),
      body: { redact_questions: true },
    });
  });

  it('sends nothing for an editor, a viewer or an unknown role', async () => {
    const { client, calls } = harness(() => jsonReply(200, { push: { redact_questions: true } }));
    for (const role of ['editor', 'viewer', null] as const) {
      await expect(saveRedact(client, role, true)).rejects.toThrow(TypeError);
    }
    expect(calls).toHaveLength(0);
  });
});

// The Notifications screen (US-014f) shares the folder: its components (.tsx) and hooks (use-*.ts)
// are the React side; every other module there is logic and stays pure.
const isLogic = (name: string) => name.endsWith('.ts') && !name.startsWith('use-');

describe('the settings modules stay pure', () => {
  it('import no React, React Native or Expo module', () => {
    const files = sources(path.resolve(__dirname, '../settings')).filter((file) =>
      isLogic(path.basename(file.file)),
    );
    expect(files.map((file) => path.basename(file.file))).toEqual(
      expect.arrayContaining([
        'digest.ts',
        'prefs.ts',
        'redact.ts',
        'view-model.ts',
        'phone-link.ts',
        'cache.ts',
        'digest-now.ts',
        'digest-now-store.ts',
      ]),
    );
    const native = files.flatMap((file) =>
      importsOf(file.text, /^(react|react-native|expo)(-|\/|$)/),
    );
    expect(native).toEqual([]);
  });
});
