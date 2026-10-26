// The planted sample event for the crash-report tests (R01, R02): its loader, the markers it
// plants and a leak finder. Test-only (vitest collects *.test.ts, never this folder).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Event } from '@sentry/react-native';

const SAMPLE_PATH = path.resolve(__dirname, '../../__fixtures__/sample-event.json');

/** A fresh copy of the sample event on every call. */
export function loadSample(): Event {
  return JSON.parse(readFileSync(SAMPLE_PATH, 'utf8')) as Event;
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** Every value the sample plants, each of which must be gone after scrubbing. */
export const PLANTED = Object.freeze({
  chatText: 'PLANTED-CHAT-7Q1',
  chatWords: 'Dublin offsite',
  questionText: 'PLANTED-QUESTION-4K8',
  questionWords: 'Meridian invoice',
  pushQuestion: 'PLANTED-PUSH-9Z3',
  pushWords: 'March payroll',
  pushSig: '5e7a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8',
  pushKey: 'Zq8PLANTEDpushKEY3vR7xYw2LmN5sT9uB1cD4eF6gH0j',
  callId: 'call_8PLANTEDc7b6a5f4e3d2c1b0a9f',
  chatId: '0b7e3c1a-5d2f-4e8a-9c6b-7a1d2e3f4a5b',
  bearerToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6InBsYW50ZWQifQ',
  workspaceId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  deviceToken: 'amd_PLANTEDdeviceTOKEN0123456789abcdefghijklmn',
  expoPushToken: 'PLANTEDxR7kLm2Qp9Vt4Wz',
  clerkKey: 'pk_live_UExBTlRFRC1jbGVyay5hdXRvbWF0b3MuYXBwJA',
  email: 'planted.person@example.org',
  userId: 'user_PLANTED2xY9',
  username: 'planted-username',
  ipAddress: '203.0.113.77',
  selfHostedHost: 'planted-host.example',
  lanAddress: '192.168.1.20',
  requestBody: 'PLANTED-BODY-3M5',
  cookie: 'PLANTED-COOKIE',
  deviceName: 'PLANTED-DEVICE-NAME',
  deviceId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
});

/** The names of the planted markers found in the JSON, and 'a PLANTED marker' for any other. */
export function leaks(json: string): string[] {
  const found = Object.entries(PLANTED).filter(([, marker]) => json.includes(marker));
  return [
    ...found.map(([name]) => name),
    ...(json.toLowerCase().includes('planted') ? ['a PLANTED marker'] : []),
  ];
}
