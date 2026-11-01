// The phone's own check by name (check-copy.ts, check-copy.android.ts): the iPhone keeps its Face ID
// copy word for word, and on Android no step-up sentence names Face ID. Metro picks the Android file
// by platform; here the strings modules are loaded again with it in check-copy's place.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CHECK_COPY as ANDROID } from '../check-copy.android';
import { APPROVAL_SHEET_COPY } from '../../approvals/strings';
import { SUGGESTION_COPY } from '../../suggestions/strings';
import {
  STEP_UP_OUTCOME_COPY,
  STEP_UP_SETTING_COPY,
  STEP_UP_SETTING_REFUSAL_COPY,
} from '../strings';

type Copies = {
  readonly outcome: typeof STEP_UP_OUTCOME_COPY;
  readonly setting: typeof STEP_UP_SETTING_COPY;
  readonly refusal: typeof STEP_UP_SETTING_REFUSAL_COPY;
  readonly allowHint: string;
  readonly faceIdNote: string;
  readonly startHint: string;
};

/** Every step-up sentence the person sees, from the three strings modules. */
const sentencesOf = (copies: Copies): string[] => [
  ...Object.values(copies.outcome),
  ...Object.values(copies.setting),
  ...Object.values(copies.refusal),
  copies.allowHint,
  copies.faceIdNote,
  copies.startHint,
];

async function androidCopies(): Promise<Copies> {
  vi.resetModules();
  vi.doMock('../check-copy', () => import('../check-copy.android'));
  const steps = await import('../strings');
  const approvals = await import('../../approvals/strings');
  const suggestions = await import('../../suggestions/strings');
  return {
    outcome: steps.STEP_UP_OUTCOME_COPY,
    setting: steps.STEP_UP_SETTING_COPY,
    refusal: steps.STEP_UP_SETTING_REFUSAL_COPY,
    allowHint: approvals.APPROVAL_SHEET_COPY.allowHint,
    faceIdNote: approvals.APPROVAL_SHEET_COPY.faceIdNote,
    startHint: suggestions.SUGGESTION_COPY.startHint,
  };
}

afterEach(() => {
  vi.doUnmock('../check-copy');
  vi.resetModules();
});

describe('the iPhone’s check copy', () => {
  it('is Face ID, word for word as before', () => {
    expect(STEP_UP_SETTING_COPY).toEqual({
      label: 'Face ID before approve or answer',
      detail:
        'Asks for Face ID, or your passcode, before you approve or answer in the app. Checked on this phone only.',
      noSecurity: 'This phone has no passcode or Face ID, so nothing is asked.',
    });
    expect(STEP_UP_OUTCOME_COPY.locked_out).toBe(
      'Face ID is locked after too many tries. Unlock your phone with its passcode, then try again. Nothing was sent.',
    );
    expect(STEP_UP_SETTING_REFUSAL_COPY).toEqual({
      cancelled: 'Cancelled. Face ID before approve or answer is still on.',
      failed: "That didn't match. Face ID before approve or answer is still on.",
      locked_out:
        'Face ID is locked after too many tries. Unlock your phone with its passcode, then try again.',
      unavailable:
        "This phone couldn't check it's you. Face ID before approve or answer is still on.",
    });
    expect(APPROVAL_SHEET_COPY.allowHint).toBe('Asks for Face ID first.');
    expect(APPROVAL_SHEET_COPY.faceIdNote).toBe('Face ID to allow. Refusing needs none.');
    expect(SUGGESTION_COPY.startHint).toBe('Asks for Face ID first, then starts it.');
  });
});

describe('Android’s check copy', () => {
  it('names the fingerprint, the face and the screen lock, never Face ID', () => {
    expect(Object.keys(ANDROID).sort()).toEqual(
      ['asksFor', 'first', 'lockedOut', 'name', 'none'].sort(),
    );
    for (const line of Object.values(ANDROID)) expect(line).not.toMatch(/Face ID|passcode/);
    expect(ANDROID.asksFor).toBe('your fingerprint, face or screen lock');
  });

  it('reaches every step-up sentence, which still says nothing was sent and where it is checked', async () => {
    const copies = await androidCopies();
    for (const line of sentencesOf(copies)) expect(line).not.toMatch(/Face ID|passcode/);
    expect(copies.setting.label).toBe('Screen lock before approve or answer');
    expect(copies.setting.detail).toContain('on this phone only');
    expect(copies.setting.noSecurity).toBe('This phone has no screen lock, so nothing is asked.');
    for (const [outcome, line] of Object.entries(copies.outcome)) {
      if (outcome !== 'passed') expect(line).toContain('Nothing was sent');
    }
    expect(copies.startHint).toBe('Asks for your screen lock first, then starts it.');
  });

  it('is picked by Metro by platform, with no React Native import in the copy', () => {
    const dir = path.resolve(__dirname, '..');
    for (const file of ['check-copy.ts', 'check-copy.android.ts']) {
      expect(readFileSync(path.join(dir, file), 'utf8')).not.toMatch(/from 'react-native'/);
    }
  });
});
