// Accept-Language from "I speak" (PRD-268 §6.11; core picks en or pt-BR from it, en by default):
// English sends 'en', Portuguese (Brazil) 'pt-BR', and Automatic, an unknown choice or none sends
// no header, so the platform's own default stands. Every call the client builds carries it, read
// at call time, and a getter that throws never fails the call.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { SPEAK_CHOICES } from '../../voice/settings/voice-setting';
import {
  ACCEPT_LANGUAGE_HEADER,
  acceptLanguageHeaders,
  acceptLanguageOf,
  readLanguage,
} from '../accept-language';
import { createApiClient, type ApiClientOptions } from '../client';
import type { Route } from '../routes';
import { SERVER, fakeTransport, reply, type FakeTransport } from './fake-transport';

const NEEDS_YOU: Route = { method: 'GET', path: '/api/activity/needs-you' };

function clientWith(transport: FakeTransport, overrides: Partial<ApiClientOptions> = {}) {
  return createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => null,
    transport,
    ...overrides,
  });
}

afterEach(() => vi.restoreAllMocks());

describe('acceptLanguageOf', () => {
  it('sends the two languages core writes in, as core reads them', () => {
    expect(acceptLanguageOf('en')).toBe('en');
    expect(acceptLanguageOf('pt-BR')).toBe('pt-BR');
  });

  it('sends nothing for Automatic, an unknown choice or none', () => {
    for (const choice of ['auto', 'pt-PT', 'fr', 'EN', 'toString', '', null, undefined]) {
      expect(acceptLanguageOf(choice), String(choice)).toBeNull();
      expect(acceptLanguageHeaders(choice), String(choice)).toEqual({});
    }
  });

  it('covers every "I speak" choice: each but Automatic sends a header', () => {
    const sent = SPEAK_CHOICES.map((choice) => [choice, acceptLanguageOf(choice)]);
    expect(sent).toEqual([
      ['auto', null],
      ['en', 'en'],
      ['pt-BR', 'pt-BR'],
    ]);
  });

  it('is the one header', () => {
    expect(acceptLanguageHeaders('pt-BR')).toEqual({ 'Accept-Language': 'pt-BR' });
    expect(ACCEPT_LANGUAGE_HEADER).toBe('Accept-Language');
  });
});

describe('readLanguage', () => {
  it('reads the getter, and none as null', () => {
    expect(readLanguage(() => 'en')).toBe('en');
    expect(readLanguage(() => undefined)).toBeNull();
    expect(readLanguage(undefined)).toBeNull();
  });

  it('reads a getter that throws as null, and says so in the log', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    expect(
      readLanguage(() => {
        throw new Error('storage gone');
      }),
    ).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('the client sends it', () => {
  it('on every kind of call, beside the bearer', async () => {
    const transport = fakeTransport(() => reply(200, ''));
    const client = clientWith(transport, { getLanguage: () => 'pt-BR' });
    await client.request(NEEDS_YOU);
    await client.stream(NEEDS_YOU);
    await client.binary(NEEDS_YOU);
    for (const call of transport.calls) {
      expect(call.headers).toEqual({
        Authorization: 'Bearer jwt.token.value',
        'Accept-Language': 'pt-BR',
      });
    }
    expect(transport.calls).toHaveLength(3);
  });

  it('reads the choice at call time, so a change applies to the next call', async () => {
    let choice = 'en';
    const transport = fakeTransport(() => reply(204));
    const client = clientWith(transport, { getLanguage: () => choice });
    await client.request(NEEDS_YOU);
    choice = 'auto';
    await client.request(NEEDS_YOU);
    choice = 'pt-BR';
    await client.request(NEEDS_YOU);
    expect(transport.calls.map((call) => call.headers[ACCEPT_LANGUAGE_HEADER])).toEqual([
      'en',
      undefined,
      'pt-BR',
    ]);
  });

  it('sends none without a getter, or for Automatic', async () => {
    const transport = fakeTransport(() => reply(204));
    await clientWith(transport).request(NEEDS_YOU);
    await clientWith(transport, { getLanguage: () => 'auto' }).request(NEEDS_YOU);
    for (const call of transport.calls) expect(call.headers).not.toHaveProperty('Accept-Language');
  });

  it('still sends the call when the getter throws', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const transport = fakeTransport(() => reply(204));
    const client = clientWith(transport, {
      getLanguage: () => {
        throw new Error('storage gone');
      },
    });
    await client.request(NEEDS_YOU);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.headers).not.toHaveProperty('Accept-Language');
  });
});
