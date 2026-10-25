// Settings → Notifications in words (PRD-001 §4.7; D19, D21, D22, D24): every US-014c status → its
// sentence and button; the server's gates before the registrar's answer, and the server's row for
// why push is off once it is newer; sections hidden without their capability; the redact switch
// read-only for editors and viewers; the digest time's disabled cases; the Face ID lines on a phone
// with no passcode. All pure: no renderer, no network. The caches, the phone link and the source
// checks are settings-wiring.test.ts's.

import { describe, expect, it, vi } from 'vitest';

import type { Capability } from '../../api/discovery';
import { STEP_UP_SETTING_COPY } from '../../step-up/strings';
import type { RegistrationOutcome } from '../registration/register';
import { pushStatus, type OffReason, type PushStatus } from '../registration/state';
import { deviceSchema, preferencesSchema, type Device } from '../schemas/server';
import {
  digestView,
  faceIdView,
  phoneActionLabel,
  phoneStatusOf,
  phoneStatusView,
  pushTypeRows,
  redactView,
  screenHead,
  sectionsShown,
  switchWord,
  thisPhoneRow,
  type PhoneContext,
} from '../settings/view-model';
import { PUSH_PHONE_COPY, PUSH_SETTINGS_COPY } from '../strings';
import { DEVICE_ID, DEVICE_ROW, PREFERENCES } from './data-fixtures';
import { deepFreeze } from './inbound-fixtures';
import { OTHER_DEVICE_ID, PROJECT_ID, facts, storedRecord } from './registration-fixtures';

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const HOSTED: PhoneContext = { source: 'hosted', serverName: 'Automatos' };
const OWN: PhoneContext = { source: 'own', serverName: 'Home lab (192.168.1.20:8000)' };

const doc = (capabilities: Capability[], expo = true) =>
  deepFreeze({ capabilities, push: { expo } });
const PUSHING = doc(['push', 'digest']);

const device = (overrides: Partial<Device> = {}): Device =>
  deepFreeze({ ...deviceSchema.parse(DEVICE_ROW), ...overrides });
const PREFS = deepFreeze(preferencesSchema.parse(PREFERENCES));

const outcomeOf = (status: PushStatus, overrides = {}): RegistrationOutcome =>
  deepFreeze({ step: 'none', status, facts: facts(overrides) });

const ON: PushStatus = { kind: 'on' };

describe('This phone: every status in one sentence, at most one button (US-014c)', () => {
  const fixed: [PushStatus, string, string | null][] = [
    [{ kind: 'ask' }, PUSH_PHONE_COPY.ask, 'turn_on'],
    [
      { kind: 'denied' },
      "Notifications are off for Automatos Go in your phone's settings.",
      'open_settings',
    ],
    [ON, 'On for this phone.', null],
    [
      { kind: 'off', reason: 'DeviceNotRegistered' },
      'Expo reported that this phone no longer had the app, so notifications stopped.',
      'turn_on_again',
    ],
    [
      { kind: 'off', reason: 'token_moved' },
      'Notifications moved to a newer sign-in on this phone.',
      'turn_on_again',
    ],
    [
      { kind: 'off', reason: 'device_revoked' },
      "This phone was removed from your workspace's devices.",
      'turn_on_again',
    ],
    [{ kind: 'off', reason: 'other' }, PUSH_PHONE_COPY.offOther, 'try_again'],
    [
      { kind: 'revoked_by_admin' },
      'A workspace owner or admin removed this phone in Studio. Ask them to add it back.',
      null,
    ],
    [
      { kind: 'token_elsewhere' },
      'Another account on this phone receives its notifications.',
      null,
    ],
    [
      { kind: 'not_configured' },
      "Notifications aren't set up in this build of Automatos Go yet.",
      null,
    ],
    [{ kind: 'unsupported' }, "This server doesn't send notifications to phones yet.", null],
  ];

  it.each(fixed)('%o → its sentence and button', (status, sentence, action) => {
    expect(phoneStatusView(deepFreeze(status), HOSTED)).toEqual({ sentence, action });
    expect(phoneStatusView(status, OWN)).toEqual({ sentence, action });
  });

  it('operator_off names the server and says how its operator turns push on (D21)', () => {
    expect(phoneStatusView({ kind: 'operator_off' }, OWN)).toEqual({
      sentence:
        "Home lab (192.168.1.20:8000) doesn't send notifications to phones. Its operator can turn them on in Studio → Settings → Phones & devices; they are then sent through Expo's push service.",
      action: null,
    });
  });

  it('key_missing: an own server pairs again; a hosted phone waits for its own recovery', () => {
    expect(phoneStatusView({ kind: 'key_missing' }, OWN).sentence).toBe(
      "This phone can't check its notifications. Pair it again to turn them on.",
    );
    const hosted = phoneStatusView({ kind: 'key_missing' }, HOSTED);
    expect(hosted.sentence).toBe(PUSH_PHONE_COPY.keyMissingHosted);
    expect(hosted.sentence).not.toMatch(/pair/i);
    expect(hosted.action).toBeNull();
  });

  it('no answer yet reads as checking, with no button', () => {
    expect(phoneStatusView(null, HOSTED)).toEqual({
      sentence: PUSH_PHONE_COPY.checking,
      action: null,
    });
  });

  it('each button has its words', () => {
    expect(phoneActionLabel('turn_on')).toBe('Turn on notifications');
    expect(phoneActionLabel('open_settings')).toBe('Open Settings');
    expect(phoneActionLabel('turn_on_again')).toBe('Turn on again');
    expect(phoneActionLabel('try_again')).toBe('Try again');
  });
});

describe("phoneStatusOf: the server's gates, then the registrar, then the server's row", () => {
  const base = {
    discovery: PUSHING,
    projectId: PROJECT_ID,
    outcome: outcomeOf(ON),
    outcomeAt: 100,
    devices: null,
    devicesAt: 0,
  };

  it('the gates come first, even before the registrar has answered', () => {
    const none = { ...base, outcome: null };
    expect(phoneStatusOf({ ...none, discovery: doc([]) })).toEqual({ kind: 'unsupported' });
    expect(phoneStatusOf({ ...none, discovery: doc(['push'], false) })).toEqual({
      kind: 'operator_off',
    });
    expect(phoneStatusOf({ ...none, projectId: null })).toEqual({ kind: 'not_configured' });
    expect(phoneStatusOf({ ...base, discovery: null })).toEqual({ kind: 'unsupported' });
  });

  it('no answer from the registrar yet → null (checking)', () => {
    expect(phoneStatusOf({ ...base, outcome: null })).toBeNull();
  });

  it("the registrar's status when the server's row is not read, not this phone's, or older", () => {
    const denied = outcomeOf({ kind: 'denied' }, { permission: 'denied' });
    expect(phoneStatusOf({ ...base, outcome: denied })).toEqual({ kind: 'denied' });
    const other = [device({ id: OTHER_DEVICE_ID, push_enabled: false })];
    expect(phoneStatusOf({ ...base, devices: other, devicesAt: 200 })).toEqual(ON);
    const off = [device({ push_enabled: false, push_disabled_reason: 'token_moved' })];
    expect(phoneStatusOf({ ...base, devices: off, devicesAt: 50 })).toEqual(ON);
  });

  const reasons: OffReason[] = ['DeviceNotRegistered', 'token_moved', 'device_revoked'];
  it.each(reasons)('a newer row that says off for %s → that reason', (reason) => {
    const rows = [device({ push_enabled: false, push_disabled_reason: reason })];
    expect(phoneStatusOf({ ...base, devices: rows, devicesAt: 200 })).toEqual({
      kind: 'off',
      reason,
    });
  });

  it('an unknown reason is off/other; an enabled row stays on', () => {
    const odd = [device({ push_enabled: false, push_disabled_reason: 'something_new' })];
    expect(phoneStatusOf({ ...base, devices: odd, devicesAt: 200 })).toEqual({
      kind: 'off',
      reason: 'other',
    });
    expect(phoneStatusOf({ ...base, devices: [device()], devicesAt: 200 })).toEqual(ON);
  });

  it("matches pushStatus over the outcome's facts with the row in, and changes nothing", () => {
    const row = device({ push_enabled: false, push_disabled_reason: 'token_moved' });
    const input = deepFreeze({ ...base, devices: [row], devicesAt: 200 });
    const expected = pushStatus({
      ...base.outcome.facts,
      serverRow: { deviceId: DEVICE_ID, pushEnabled: false, disabledReason: 'token_moved' },
    });
    expect(phoneStatusOf(input)).toEqual(expected);
  });

  it("thisPhoneRow: the registrar's row id first, then the record's", () => {
    const rows = [device({ id: OTHER_DEVICE_ID }), device()];
    const fromRecord = outcomeOf(ON);
    expect(thisPhoneRow(fromRecord, rows)?.id).toBe(DEVICE_ID);
    const fromRow = outcomeOf(ON, {
      record: storedRecord(),
      serverRow: { deviceId: OTHER_DEVICE_ID, pushEnabled: null, disabledReason: null },
    });
    expect(thisPhoneRow(fromRow, rows)?.id).toBe(OTHER_DEVICE_ID);
    expect(thisPhoneRow(outcomeOf(ON, { record: null }), rows)).toBeNull();
    expect(thisPhoneRow(null, rows)).toBeNull();
    expect(thisPhoneRow(fromRecord, null)).toBeNull();
  });
});

describe('sections: hidden without their capability (D-CAPABILITIES)', () => {
  it.each([
    ['no discovery', null, { pushTypes: false, digest: false, redact: false }],
    ['no push', doc(['digest']), { pushTypes: false, digest: false, redact: false }],
    [
      'push, the operator said no',
      doc(['push', 'digest'], false),
      { pushTypes: false, digest: false, redact: false },
    ],
    ['push without digest', doc(['push']), { pushTypes: true, digest: false, redact: true }],
    ['push and digest', PUSHING, { pushTypes: true, digest: true, redact: true }],
  ] as const)('%s', (_name, discovery, shown) => {
    expect(sectionsShown(discovery)).toEqual({ ...shown, faceId: true });
  });
});

describe('the head and the push types (the handoff §3, D22)', () => {
  it('eyebrow, title and lede; the eyebrow is uppercased by its text role', () => {
    expect(screenHead('Northwind')).toEqual({
      eyebrow: 'Settings · Northwind',
      title: 'Notifications',
      lede: 'Auto only taps you on the shoulder when work is waiting on you.',
    });
  });

  it('three switches with their words, each on or off as its push rows say', () => {
    const rows = pushTypeRows(PREFS);
    expect(rows.map(({ label, detail }) => [label, detail])).toEqual([
      ['Needs an answer', 'Questions, approvals and Mission plans waiting for you'],
      ['Ready for review', 'A ticket reaches Review'],
      ['Auto messaged you', 'Auto writes to you without being asked, and your daily digest'],
    ]);
    expect(rows.map((row) => row.on)).toEqual([true, true, true]);
    expect(PUSH_SETTINGS_COPY.typesScope('Northwind')).toBe(
      'For you in Northwind, on every phone you use.',
    );
  });

  it("a write that is out shows the person's choice and takes no tap", () => {
    const [needs, review] = pushTypeRows(PREFS, { review: false });
    expect(needs).toMatchObject({ on: true, saving: false });
    expect(review).toMatchObject({ key: 'review', on: false, saving: true });
  });

  it('every switch state has a word', () => {
    expect([switchWord(true), switchWord(false)]).toEqual(['On', 'Off']);
  });
});

describe('the daily digest: the switch and the time (D24, W2 K12)', () => {
  const at = (overrides: Partial<Parameters<typeof digestView>[0]> = {}) =>
    digestView({ preferences: PREFS, row: device(), timeZone: 'Europe/Dublin', ...overrides });

  it("on with an active row: the row's time, choosable, in the phone's zone", () => {
    const view = at({ overrides: { digest: true } });
    expect(view).toMatchObject({ on: true, time: '08:00', timeDisabled: false, note: null });
    expect(view.times).toEqual(['07:00', '08:00', '09:00']);
    expect(view.zoneLine).toContain("in this phone's time zone (Europe/Dublin)");
    expect(view.phoneLine).toBe(
      'With more than one phone, the digest follows the one you used last.',
    );
  });

  it('the time is disabled while the digest is off (its push row says off)', () => {
    expect(at()).toMatchObject({ on: false, timeDisabled: true, note: null });
  });

  it('the time is disabled, with words, when this phone has no row or it is not active', () => {
    const on = { overrides: { digest: true } };
    expect(at({ ...on, row: null })).toMatchObject({
      timeDisabled: true,
      time: '08:00',
      note: PUSH_SETTINGS_COPY.digestNoRow,
    });
    expect(at({ ...on, row: device({ status: 'revoked' }) })).toMatchObject({
      timeDisabled: true,
      note: PUSH_SETTINGS_COPY.digestNoRow,
    });
  });

  it('a time being saved shows and takes no second tap; an unknown zone still says whose', () => {
    expect(at({ overrides: { digest: true }, pendingTime: '07:00' })).toMatchObject({
      time: '07:00',
      timeDisabled: true,
    });
    expect(at({ timeZone: null }).zoneLine).toBe("At this time in this phone's time zone.");
  });

  it("the digest's copy: Auto's message in the Auto thread", () => {
    expect(PUSH_SETTINGS_COPY.digestDetail).toMatch(/Auto's message in your Auto thread/);
  });
});

describe('question text: owners and admins change it, everyone else reads it (D-ROLES)', () => {
  const SET = { redactQuestions: true };

  it.each(['owner', 'admin'] as const)('%s: editable, no note', (role) => {
    expect(redactView(role, SET)).toMatchObject({ on: true, editable: true, note: null });
  });

  it.each(['editor', 'viewer', null] as const)('%s: read-only, with who can change it', (role) => {
    expect(redactView(role, SET)).toMatchObject({
      on: true,
      editable: false,
      note: 'Your workspace owner or admin can change this.',
    });
  });

  it('its words, and a write out shows the choice and takes no tap', () => {
    const view = redactView('owner', { redactQuestions: false }, true);
    expect(view).toMatchObject({ on: true, editable: false, saving: true });
    expect(view.label).toBe('Hide question text in notifications');
    expect(view.detail).toBe('Questions then say only that one is waiting, and open the app.');
  });
});

describe('Face ID before approve or answer (D19): always shown, checked on this phone only', () => {
  it('its label and the client-side line', () => {
    expect(faceIdView(true)).toEqual({
      label: 'Face ID before approve or answer',
      detail:
        'Asks for Face ID, or your passcode, before you approve or answer in the app. Checked on this phone only.',
      note: null,
    });
  });

  it('a phone with no passcode is told nothing is asked; an unread phone is told nothing', () => {
    expect(faceIdView(false).note).toBe(
      'This phone has no passcode or Face ID, so nothing is asked.',
    );
    expect(faceIdView(null).note).toBeNull();
    expect(STEP_UP_SETTING_COPY.noSecurity).toBe(faceIdView(false).note);
  });
});
