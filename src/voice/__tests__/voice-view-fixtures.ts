// The voice screen view-model's test inputs (US-019i): a voice state reached through the reducer
// (voice-fixtures.ts), the last press's verdict and policy as quick-ask's snapshot holds them, and
// a reply as reply-text.ts makes it. Every input is deep-frozen, so voiceView can never mutate one.

import type { PermissionVerdict } from '../permissions/permission-flow';
import { onDeviceOptions, type RecognitionPolicy } from '../quick-ask/recognition-policy';
import type { QuickAskReply } from '../quick-ask/reply-text';
import { voiceView, type VoiceView, type VoiceViewInput } from '../screen/voice-view-model';
import { AT, deepFreeze } from './voice-fixtures';

export const READY: RecognitionPolicy = Object.freeze({
  kind: 'ready',
  options: onDeviceOptions('en-GB'),
});

export const GRANTED: PermissionVerdict = Object.freeze({
  step: 'granted',
  blocked: null,
  asked: false,
});

export function input(overrides: Partial<VoiceViewInput> = {}): VoiceViewInput {
  return deepFreeze({
    state: AT.idle,
    policy: READY,
    permission: GRANTED,
    roleCanChat: true,
    screenReader: false,
    mascotState: 'idle',
    locale: 'en-GB',
    reply: null,
    failure: null,
    ...overrides,
  });
}

export function reply(overrides: Partial<QuickAskReply> = {}): QuickAskReply {
  return {
    text: 'You have two meetings.',
    streaming: false,
    finished: true,
    stopped: false,
    hasCards: false,
    hasReceipts: false,
    ...overrides,
  };
}

export const view = (overrides: Partial<VoiceViewInput> = {}): VoiceView =>
  voiceView(input(overrides));
