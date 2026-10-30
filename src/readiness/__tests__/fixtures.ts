// Readiness@1 as core writes it (orchestrator/services/readiness: service.render, the en strings),
// and this phone's facts, for the readiness tests.

import type { PermissionVerdict } from '../../voice/permissions/permission-flow';
import { onDeviceOptions } from '../../voice/quick-ask/recognition-policy';
import type { ClientFacts, ClientPorts, SpeechFacts } from '../client-facts';

export const CHECKED_AT = '2026-10-30T07:58:00+00:00';

export const CORE_ITEM = Object.freeze({
  id: 'core',
  label: 'Automatos server',
  detail: 'The server and its database answer.',
  state: 'ready',
  needed_by: ['brief', 'voice', 'push', 'check_in'],
});

export const MODEL_ITEM = Object.freeze({
  id: 'model_route',
  label: "Auto's model",
  detail: 'No model is chosen for Auto.',
  state: 'needs_setup',
  fix: { label: "Choose Auto's model", href: '/settings?tab=orchestrator' },
  needed_by: ['brief', 'check_in'],
});

export const SEARCH_ITEM = Object.freeze({
  id: 'web_search',
  label: 'Web search',
  detail: "Didn't answer in time.",
  state: 'not_checked',
  needed_by: ['voice'],
});

/** Core's own push item: whether the install may send through Expo. */
export const SERVER_PUSH_ITEM = Object.freeze({
  id: 'push',
  label: 'Phone notifications',
  detail: 'Notifications can reach your phone.',
  state: 'ready',
  needed_by: ['push'],
});

export const READINESS_BODY = Object.freeze({
  v: 1,
  checked_at: CHECKED_AT,
  items: [CORE_ITEM, MODEL_ITEM, SEARCH_ITEM, SERVER_PUSH_ITEM],
});

export const GRANTED: PermissionVerdict = Object.freeze({
  step: 'granted',
  blocked: null,
  asked: false,
});
export const ASK: PermissionVerdict = Object.freeze({ step: 'ask', blocked: null, asked: false });
export const MIC_OFF: PermissionVerdict = Object.freeze({
  step: 'settings',
  blocked: 'microphone',
  asked: false,
});
export const SPEECH_OFF: PermissionVerdict = Object.freeze({
  step: 'settings',
  blocked: 'speech',
  asked: false,
});
export const RESTRICTED: PermissionVerdict = Object.freeze({
  step: 'restricted',
  blocked: null,
  asked: false,
});

export const EN_GB = 'en-GB';

export function speech(overrides: Partial<SpeechFacts> = {}): SpeechFacts {
  return Object.freeze({
    verdict: GRANTED,
    policy: Object.freeze({ kind: 'ready', options: onDeviceOptions(EN_GB) }),
    locale: EN_GB,
    ...overrides,
  });
}

export const ALL_READY: ClientFacts = Object.freeze({
  push: Object.freeze({ kind: 'on' }),
  microphone: GRANTED,
  speech: speech(),
  serverVoice: 'speaks',
});

/** Ports that answer like a phone with everything allowed; each may be replaced. */
export function ports(overrides: Partial<ClientPorts> = {}): ClientPorts {
  return Object.freeze({
    pushStatus: () => Object.freeze({ kind: 'on' }),
    checkPermission: async () => GRANTED,
    recognitionPolicy: async (locale: string) =>
      Object.freeze({ kind: 'ready', options: onDeviceOptions(locale) }),
    listeningLocale: () => EN_GB,
    voiceSource: () => 'server' as const,
    serverVoices: async () => true,
    ...overrides,
  });
}
