import { describe, expect, it } from 'vitest';

import type { ApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { jsonReply, reply } from '../../api/__tests__/fake-transport';
import * as api from '../api';
import { deviceConflictOf } from '../schemas/server';
import {
  DEVICE_ID,
  DEVICE_ROW,
  harness,
  NOTIFICATION_ID,
  POST_ID,
  PREFERENCES,
  sent,
  WS,
} from './data-fixtures';

describe('the push calls, through the one client', () => {
  const INPUT: api.RegistrationInput = {
    installId: 'install-abc-123',
    platform: 'ios',
    appVersion: '1.0.0',
    locale: 'en-IE',
    timezone: 'Europe/Dublin',
  };

  it('registers with the five facts, the name when known and the token only when given', async () => {
    const { client, calls } = harness(() =>
      jsonReply(200, { device_id: DEVICE_ID, push_key: 'key' }),
    );
    await api.registerDevice(client, INPUT);
    await api.registerDevice(client, {
      ...INPUT,
      name: '  iPhone 16 Pro ',
      expoPushToken: 'ExponentPushToken[abc]',
    });
    await api.registerDevice(client, { ...INPUT, name: '   ', expoPushToken: null });
    const [bare, full, blank] = calls.map(sent);
    const facts = {
      install_id: 'install-abc-123',
      platform: 'ios',
      app_version: '1.0.0',
      locale: 'en-IE',
      timezone: 'Europe/Dublin',
    };
    expect(bare).toMatchObject({ method: 'POST', path: '/api/v1/mobile/devices', body: facts });
    expect(full?.body).toEqual({
      ...facts,
      name: 'iPhone 16 Pro',
      expo_push_token: 'ExponentPushToken[abc]',
    });
    expect(blank?.body).toEqual(facts);
  });

  it('lists, updates (only the keys given) and revokes a device', async () => {
    const { client, calls } = harness((request) =>
      jsonReply(200, request.method === 'GET' ? { devices: [DEVICE_ROW] } : DEVICE_ROW),
    );
    expect((await api.listDevices(client)).devices).toHaveLength(1);
    expect(
      (await api.updateDevice(client, DEVICE_ID, { push_enabled: false, digest_time: undefined }))
        .id,
    ).toBe(DEVICE_ID);
    await expect(api.revokeDevice(client, DEVICE_ID)).resolves.toBeUndefined();
    const [list, update, revoke] = calls.map(sent);
    expect(list).toMatchObject({ method: 'GET', path: '/api/v1/mobile/devices' });
    expect(update).toMatchObject({
      method: 'PATCH',
      path: `/api/v1/mobile/devices/${DEVICE_ID}`,
      body: { push_enabled: false },
    });
    expect(revoke).toMatchObject({
      method: 'DELETE',
      path: `/api/v1/mobile/devices/${DEVICE_ID}`,
      body: undefined,
    });
  });

  it('gets and puts the preference rows as given, and the push settings', async () => {
    const { client, calls } = harness((request) => {
      if (request.url.endsWith('/push-settings'))
        return jsonReply(200, { push: { redact_questions: true } });
      return jsonReply(
        200,
        request.method === 'GET' ? PREFERENCES : { success: true, updated_count: 3 },
      );
    });
    const { preferences } = await api.getPreferences(client);
    expect((await api.putPreferences(client, preferences)).updated_count).toBe(3);
    expect((await api.putPushSettings(client, true)).push.redact_questions).toBe(true);
    const [get, put, settings] = calls.map(sent);
    expect(get).toMatchObject({ method: 'GET', path: '/api/notification-preferences' });
    expect(put).toMatchObject({
      method: 'PUT',
      path: '/api/notification-preferences',
      body: { preferences },
    });
    expect(settings).toMatchObject({
      method: 'PUT',
      path: '/api/v1/mobile/push-settings',
      body: { redact_questions: true },
    });
  });

  it("reads the workspace through the foundation's route", async () => {
    const { client, calls } = harness(() =>
      jsonReply(200, { id: WS, role: 'editor', settings: {} }),
    );
    expect(await api.getWorkspacePush(client)).toEqual({ role: 'editor', redactQuestions: false });
    expect(sent(calls[0])).toMatchObject({ method: 'GET', path: '/api/workspaces/current' });
  });

  it('answers with exactly one of option or answer_text, and marks read', async () => {
    const grant = { id: 42, status: 'granted', kind: 'question', answer_text: 'Yes' };
    const { client, calls } = harness((request) =>
      request.url.endsWith('/read') ? jsonReply(200, { success: true }) : jsonReply(200, { grant }),
    );
    expect((await api.answerQuestion(client, '42', { option: 'Yes' })).grant).toEqual(grant);
    await api.answerQuestion(client, '42', { answer_text: 'After lunch' });
    await expect(api.markNotificationRead(client, NOTIFICATION_ID)).resolves.toBeUndefined();
    const [option, words, read] = calls.map(sent);
    expect(option).toMatchObject({
      method: 'POST',
      path: '/api/v1/approval-grants/42/answer',
      body: { option: 'Yes' },
    });
    expect(words?.body).toEqual({ answer_text: 'After lunch' });
    expect(read).toMatchObject({
      method: 'POST',
      path: `/api/notifications/${NOTIFICATION_ID}/read`,
      body: undefined,
    });
  });

  it('runs the stale checks: the open question ids, a ticket, a post, a chat', async () => {
    const { client, calls } = harness((request) => {
      const path = new URL(request.url).pathname;
      if (path === '/api/v1/approval-grants')
        return jsonReply(200, { grants: [{ id: 42 }, { id: 'x' }, { id: 7 }] });
      if (path.startsWith('/api/v1/tasks/'))
        return jsonReply(200, { id: 8812, status: 'review', title: 't' });
      if (path.startsWith('/api/socials/'))
        return jsonReply(200, { id: POST_ID, status: 'needs_approval' });
      return jsonReply(200, { id: 'chat-1', title: 'x' });
    });
    expect(await api.pendingQuestionIds(client)).toEqual(['42', '7']);
    expect(await api.getTicket(client, '8812')).toEqual({ id: 8812, status: 'review' });
    expect(await api.getSocialPost(client, POST_ID)).toEqual({
      id: POST_ID,
      status: 'needs_approval',
    });
    expect(await api.getChat(client, 'chat-1')).toEqual({ id: 'chat-1' });
    const [questions, ticket, post, chat] = calls.map(sent);
    expect(questions?.path).toBe('/api/v1/approval-grants');
    expect(Object.fromEntries(questions?.query ?? [])).toEqual({
      status: 'pending',
      kind: 'question',
    });
    expect(ticket).toMatchObject({ method: 'GET', path: '/api/v1/tasks/8812' });
    expect(post).toMatchObject({ method: 'GET', path: `/api/socials/posts/${POST_ID}` });
    expect(chat).toMatchObject({ method: 'GET', path: '/api/chat/chat-1' });
  });

  it.each([
    ['a device id that is not a UUID', (c: ApiClient) => api.revokeDevice(c, '../etc')],
    [
      'a question id that is not a row id',
      (c: ApiClient) => api.answerQuestion(c, '4/2', { option: 'Yes' }),
    ],
    ['a notification id that is not a UUID', (c: ApiClient) => api.markNotificationRead(c, '1001')],
    ['a ticket id that is not digits', (c: ApiClient) => api.getTicket(c, '88a')],
    ['a post id that is not a UUID', (c: ApiClient) => api.getSocialPost(c, 'post')],
    ['a blank chat id', (c: ApiClient) => api.getChat(c, ' ')],
  ])('refuses %s before anything is sent', async (_name, call) => {
    const { client, calls } = harness();
    const attempt = async (): Promise<unknown> => call(client);
    await expect(attempt()).rejects.toBeInstanceOf(TypeError);
    expect(calls).toHaveLength(0);
  });

  it("hands a 409's code to the caller as the client's ApiError", async () => {
    const { client } = harness(() => jsonReply(409, { detail: { code: 'push_token_missing' } }));
    const error = await api
      .updateDevice(client, DEVICE_ID, { push_enabled: true })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'conflict', status: 409, code: 'push_token_missing' });
    expect(deviceConflictOf(error)).toBe('push_token_missing');
  });

  it.each([
    [
      'a concurrent change (words, no code)',
      409,
      { detail: 'This device changed at the same moment.' },
    ],
    ['a code W1 does not send', 409, { detail: { code: 'something_else' } }],
    ['a code on another status', 404, { detail: { code: 'push_token_in_use' } }],
  ])('reads %s as no device conflict', async (_name, status, body) => {
    const { client } = harness(() => jsonReply(status, body));
    const error = await api.registerDevice(client, INPUT).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(deviceConflictOf(error)).toBeNull();
  });

  it('passes a server failure and an unreadable answer through as ApiErrors', async () => {
    const failing = harness(() => reply(503, ''));
    await expect(api.getPreferences(failing.client)).rejects.toMatchObject({
      kind: 'server',
      status: 503,
    });
    const garbled = harness(() => jsonReply(200, { device_id: DEVICE_ID }));
    await expect(api.registerDevice(garbled.client, INPUT)).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });
});
