// Shared fixtures of the push data layer's tests (data.test.ts, data-api.test.ts): W1's device row,
// GET /api/notification-preferences with W2's push rows, the v2 payload of W2 K9's first case, and a
// client over the foundation's fake transport, so nothing touches the network.

import { createApiClient } from '../../api/client';
import type { TransportRequest } from '../../api/transport-types';
import {
  SERVER,
  fakeTransport,
  jsonReply,
  reply,
  type FakeTransport,
} from '../../api/__tests__/fake-transport';

export const WS = '5b0c4c8e-2f6a-4d3e-9a7b-1c2d3e4f5a6b';
export const DEVICE_ID = '3f1e2d4c-5b6a-4789-8abc-def012345678';
export const NOTIFICATION_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
export const POST_ID = '0d9f2c51-7a43-4b8e-9c61-2e5f7a1b3c4d';
export const SIG = 'ebbf977c0e83aefa57f52a0559c6907b31be5ebb44112450b8b88c248f4080fa';
export const IAT = 1792540800;

export const FULL = {
  v: 2,
  type: 'needs_answer',
  workspace_id: WS,
  notification_id: '1001',
  grant_id: '42',
  link_type: 'question',
  link_id: '42',
  ticket_number: '0419',
  question: 'Ship the Lisbon deck?',
  options: ['Yes', 'No', 'Later'],
  iat: IAT,
  sig: SIG,
};
export const MINIMAL = { v: 2, type: 'auto_message', workspace_id: WS, iat: IAT, sig: SIG };

export const DEVICE_ROW = {
  id: DEVICE_ID,
  workspace_id: WS,
  user_id: 7,
  kind: 'clerk',
  install_id: 'install-abc-123',
  name: 'iPhone 16 Pro',
  platform: 'ios',
  app_version: '1.0.0',
  locale: 'en-IE',
  timezone: 'Europe/Dublin',
  digest_time: '08:00',
  status: 'active',
  push_registered: true,
  push_enabled: true,
  push_disabled_reason: null,
  last_seen_at: '2026-10-21T10:00:00+00:00',
  events: ['enrolled'],
};

export const PREFERENCES = {
  success: true,
  preferences: [
    {
      event_type: 'question_pending',
      destination: 'in_app',
      enabled: true,
      channel_connection_id: null,
    },
    {
      event_type: 'question_pending',
      destination: 'push',
      enabled: true,
      channel_connection_id: null,
    },
    { event_type: 'daily_digest', destination: 'push', enabled: false },
  ],
  push_types: {
    needs_answer: ['question_pending', 'approval_pending', 'mission_plan_ready'],
    review: ['review_pending'],
    auto_message: ['auto_message'],
    digest: ['daily_digest'],
  },
};

export function harness(
  answer: (request: TransportRequest) => ReturnType<typeof reply> = () => jsonReply(200, {}),
) {
  const transport: FakeTransport = fakeTransport(answer);
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => WS,
    transport,
  });
  return { client, calls: transport.calls };
}

export function sent(call: TransportRequest | undefined) {
  if (!call) throw new Error('nothing was sent');
  const url = new URL(call.url);
  const body: unknown = typeof call.body === 'string' ? JSON.parse(call.body) : undefined;
  return { method: call.method, path: url.pathname, query: url.searchParams, body };
}
