import { describe, expect, it } from 'vitest';

import { familyOf, isPersistableKey } from '../../api/query-keys';
import type { Route } from '../../api/routes';
import { servedAtPin } from '../../api/__tests__/served';
import { pushQueryKeys } from '../query-keys';
import { PUSH_ROUTES } from '../routes';
import { parsePushData } from '../schemas/payload';
import {
  answerSchema,
  devicesSchema,
  preferencesSchema,
  pushSettingsSchema,
  registrationSchema,
  workspacePushSchema,
} from '../schemas/server';
import { DEVICE_ID, DEVICE_ROW, FULL, IAT, MINIMAL, PREFERENCES, SIG, WS } from './data-fixtures';

describe('the push payload (v2, KP6)', () => {
  it('reads a full question payload, ids as strings, options in order', () => {
    expect(parsePushData(FULL)).toEqual(FULL);
  });

  it('reads a minimal payload: only v, type, workspace_id, iat and sig', () => {
    expect(parsePushData(MINIMAL)).toEqual(MINIMAL);
  });

  it('ignores unknown keys and reads null as absent', () => {
    const parsed = parsePushData({
      ...MINIMAL,
      badge: 3,
      extra: { a: 1 },
      grant_id: null,
      options: null,
    });
    expect(parsed).toEqual(MINIMAL);
    expect(parsed && 'grant_id' in parsed).toBe(false);
  });

  it('reads the same payload sent as a JSON string (an Android data string)', () => {
    expect(parsePushData(JSON.stringify(FULL))).toEqual(FULL);
  });

  it.each([
    ['v 1', { ...FULL, v: 1 }],
    ['v 3', { ...FULL, v: 3 }],
    ['v as a string', { ...FULL, v: '2' }],
    ['no sig', { ...FULL, sig: undefined }],
    ['a null sig', { ...FULL, sig: null }],
    ['no iat', { ...FULL, iat: undefined }],
    ['a fractional iat', { ...FULL, iat: IAT + 0.5 }],
    ['an unsafe iat', { ...FULL, iat: Number.MAX_SAFE_INTEGER + 2 }],
    ['an iat as a string', { ...FULL, iat: String(IAT) }],
    ['no type', { ...FULL, type: undefined }],
    ['no workspace_id', { ...FULL, workspace_id: undefined }],
    ['a numeric grant_id', { ...FULL, grant_id: 42 }],
    ['a numeric ticket_number', { ...FULL, ticket_number: 419 }],
    ['a numeric notification_id', { ...FULL, notification_id: 1001 }],
    ['an option that is not a string', { ...FULL, options: ['Yes', 2] }],
    ['an uppercase sig', { ...FULL, sig: SIG.toUpperCase() }],
    ['a short sig', { ...FULL, sig: SIG.slice(2) }],
  ])('refuses %s: unverifiable, not a crash', (_name, raw) => {
    expect(parsePushData(raw)).toBeNull();
  });

  it.each([
    ['not JSON', '{"v": 2,'],
    ['nothing', undefined],
    ['null', null],
    ['an array', [FULL]],
    ['a number', 2],
  ])('answers null for %s', (_name, raw) => {
    expect(parsePushData(raw)).toBeNull();
  });

  it('hands back a frozen payload', () => {
    expect(Object.isFrozen(parsePushData(FULL))).toBe(true);
  });
});

describe('the server answers (unknown fields ignored)', () => {
  it('reads a registration, the push key only when minted', () => {
    const minted = registrationSchema.parse({
      device_id: DEVICE_ID,
      push_key: 'k'.repeat(43),
      x: 1,
    });
    expect(minted).toEqual({ device_id: DEVICE_ID, push_key: 'k'.repeat(43) });
    expect(registrationSchema.parse({ device_id: DEVICE_ID, push_key: null }).push_key).toBeNull();
    expect(registrationSchema.safeParse({ device_id: 'nope', push_key: null }).success).toBe(false);
  });

  it("reads W1's to_dict and drops what the phone does not use", () => {
    const [device] = devicesSchema.parse({ devices: [DEVICE_ROW] }).devices;
    expect(device).toMatchObject({ id: DEVICE_ID, kind: 'clerk', digest_time: '08:00' });
    expect(device && 'user_id' in device).toBe(false);
    expect(device && 'events' in device).toBe(false);
  });

  it('leaves out a device row it cannot read and reads a broken digest time as none', () => {
    const answer = devicesSchema.parse({
      devices: [
        { ...DEVICE_ROW, kind: 'robot' },
        { ...DEVICE_ROW, digest_time: '25:00', timezone: null },
      ],
    });
    expect(answer.devices).toHaveLength(1);
    expect(answer.devices[0]).toMatchObject({ digest_time: null, timezone: null });
  });

  it('reads every preference row exactly, push_types included', () => {
    const answer = preferencesSchema.parse({ ...PREFERENCES, extra: true });
    expect(answer.preferences).toHaveLength(3);
    expect(answer.preferences[2]).toEqual({
      event_type: 'daily_digest',
      destination: 'push',
      enabled: false,
      channel_connection_id: null,
    });
    expect(answer.push_types?.digest).toEqual(['daily_digest']);
  });

  it('reads a server before W2 (no push_types) and a broken push_types as absent', () => {
    expect(
      preferencesSchema.parse({ ...PREFERENCES, push_types: undefined }).push_types,
    ).toBeUndefined();
    expect(
      preferencesSchema.parse({ ...PREFERENCES, push_types: { review: 1 } }).push_types,
    ).toBeUndefined();
  });

  it('fails the whole list on one unreadable row, so a save never drops a row', () => {
    const broken = {
      ...PREFERENCES,
      preferences: [...PREFERENCES.preferences, { event_type: 'x' }],
    };
    expect(preferencesSchema.safeParse(broken).success).toBe(false);
  });

  it('reads the push settings and the workspace role and redact switch only', () => {
    expect(pushSettingsSchema.parse({ push: { redact_questions: true, x: 1 } })).toEqual({
      push: { redact_questions: true },
    });
    const workspace = {
      id: WS,
      name: 'Lisbon',
      role: 'admin',
      settings: { push: { redact_questions: true } },
    };
    expect(workspacePushSchema.parse(workspace)).toEqual({ role: 'admin', redactQuestions: true });
  });

  it.each([
    ['no settings', { role: 'owner' }],
    ['null settings', { role: 'owner', settings: null }],
    ['no push block', { role: 'owner', settings: { voice: {} } }],
    ['a non-boolean switch', { role: 'owner', settings: { push: { redact_questions: 'yes' } } }],
  ])('reads %s as redaction off', (_name, workspace) => {
    expect(workspacePushSchema.parse(workspace).redactQuestions).toBe(false);
  });

  it('reads an unknown role as viewer (D17)', () => {
    expect(workspacePushSchema.parse({ role: 'superuser' }).role).toBe('viewer');
  });

  it("reads /answer's grant: id, status, kind and the answer kept", () => {
    const grant = {
      id: 42,
      status: 'granted',
      kind: 'question',
      answer_text: 'Yes',
      question_md: 'secret',
    };
    expect(answerSchema.parse({ grant })).toEqual({
      grant: { id: 42, status: 'granted', kind: 'question', answer_text: 'Yes' },
    });
  });
});

describe('the route table (KP4)', () => {
  it("marks no route pendingUpstream: the pin serves W1's and W2's routes and today's brief on request", () => {
    const leaves = (table: object): Route[] =>
      Object.values(table).flatMap((entry: object) =>
        'method' in entry ? [entry as Route] : leaves(entry),
      );
    const routes = leaves(PUSH_ROUTES);
    expect(routes).toContain(PUSH_ROUTES.devices.register);
    expect(routes).toContain(PUSH_ROUTES.pushSettings);
    expect(routes).toContain(PUSH_ROUTES.digestNow);
    expect(routes.filter((route) => 'pendingUpstream' in route)).toEqual([]);
    expect(routes.filter((route) => !servedAtPin(route))).toEqual([]);
    expect(PUSH_ROUTES.digestNow).toEqual({ method: 'POST', path: '/api/v1/mobile/digest/now' });
  });
});

describe('the push query keys', () => {
  it('are never persisted and belong to no foundation family', () => {
    const keys = [
      pushQueryKeys.all(),
      pushQueryKeys.devices(),
      pushQueryKeys.preferences(),
      pushQueryKeys.workspacePush(),
    ];
    for (const key of keys) {
      expect(isPersistableKey(key)).toBe(false);
      expect(familyOf(key)).toBeNull();
    }
  });
});
