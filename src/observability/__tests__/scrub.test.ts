// R01, R02 and KR7 proven on a sample event (PRD-001 US-021 AC2): a TypeError on a chat screen
// that plants a marker in every sensitive place a crash report can carry. Nothing planted survives
// scrubEvent() or scrubBreadcrumb(); what makes the crash debuggable does.

import type { Breadcrumb } from '@sentry/react-native';
import { describe, expect, it } from 'vitest';

import { DROPPED_CATEGORIES, HTTP_CATEGORIES, SENSITIVE_DATA_KEYS } from '../breadcrumbs';
import { REDACTED } from '../redact';
import { scrubBreadcrumb, scrubEvent } from '../scrub';
import { deepFreeze, leaks, loadSample, PLANTED } from './support/sample';

describe('scrubEvent on the sample event (R01, R02)', () => {
  it('plants every marker in the sample, so the test below proves something', () => {
    expect(leaks(JSON.stringify(loadSample())).sort()).toEqual(
      [...Object.keys(PLANTED), 'a PLANTED marker'].sort(),
    );
  });

  it('leaves none of the planted markers anywhere in the event', () => {
    expect(leaks(JSON.stringify(scrubEvent(loadSample())))).toEqual([]);
  });

  it('removes the user entirely and never adds one (R02)', () => {
    const scrubbed = scrubEvent(loadSample());
    expect(scrubbed).not.toHaveProperty('user');
  });

  it('drops the fields that name the screen, the phone or the app state', () => {
    const scrubbed = scrubEvent(loadSample()) as Record<string, unknown>;
    for (const field of [
      'server_name',
      'transaction',
      'fingerprint',
      'modules',
      'threads',
      'extra',
    ]) {
      expect(scrubbed).not.toHaveProperty(field);
    }
  });

  it('keeps the request method, a path template and the harmless headers only', () => {
    expect(scrubEvent(loadSample()).request).toEqual({
      method: 'POST',
      url: '/api/chat',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    });
  });

  it('keeps only the allowlisted tags, with allowed values', () => {
    expect(scrubEvent(loadSample()).tags).toEqual({
      platform: 'ios',
      channel: 'testflight',
      edition: 'own',
      style: 'play',
    });
    const odd = scrubEvent({
      tags: { platform: 'web', edition: 'saas', style: 'theme', channel: 'A B' },
    });
    expect(odd).not.toHaveProperty('tags');
  });

  it('keeps the app, device, os, runtime and release contexts without identifying fields', () => {
    expect(scrubEvent(loadSample()).contexts).toEqual({
      app: {
        app_identifier: 'com.automatos.app',
        app_name: 'Automatos Go',
        app_version: '1.0.0',
        app_build: '12',
        app_start_time: '2026-10-26T09:12:40Z',
        in_foreground: true,
      },
      device: {
        family: 'iOS',
        model: 'iPhone16,1',
        model_id: 'D83AP',
        arch: 'arm64e',
        simulator: false,
        memory_size: 7999832064,
      },
      os: { name: 'iOS', version: '18.1', build: '22B83', rooted: false },
      runtime: { name: 'hermes', version: '0.12.0' },
      release: { channel: 'testflight', edition: 'own', style: 'play', server: REDACTED },
    });
  });

  it('holds extra to the same names as contexts (the app sets none of its own)', () => {
    const scrubbed = scrubEvent({ extra: { os: { name: 'iOS' }, question_text: 'q', app: 'x' } });
    expect(scrubbed.extra).toEqual({ os: { name: 'iOS' } });
  });
});

describe('scrubEvent keeps a crash debuggable', () => {
  it('keeps the level, release, dist, environment and the SDK facts', () => {
    expect(scrubEvent(loadSample())).toMatchObject({
      event_id: '4f1c2b9e8d7a4c3b9e2f1a0b8c7d6e5f',
      timestamp: 1761471243.512,
      level: 'error',
      platform: 'javascript',
      release: 'com.automatos.app@1.0.0+12',
      dist: '12',
      environment: 'testflight',
    });
  });

  it("keeps the SDK's name, version, integration names and packages, nothing else", () => {
    expect(scrubEvent(loadSample()).sdk).toEqual({
      name: 'sentry.javascript.react-native',
      version: '7.2.0',
      integrations: ['InboundFilters', 'FunctionToString', 'Breadcrumbs', 'DeviceContext'],
      packages: [{ name: 'npm:@sentry/react-native', version: '7.2.0' }],
    });
  });

  it("keeps the bundle's debug ids, without a dev server's address", () => {
    expect(scrubEvent(loadSample()).debug_meta).toEqual({
      images: [
        {
          type: 'sourcemap',
          code_file: 'app:///main.jsbundle',
          debug_id: 'e3a1f0c2-9b8d-4e7f-a6c5-d4b3a2918070',
        },
        {
          type: 'sourcemap',
          code_file: '/index.bundle',
          debug_id: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
        },
      ],
    });
  });

  it("keeps each exception's type, its words and its frames' function, file, line and column", () => {
    const [cause, error] = scrubEvent(loadSample()).exception?.values ?? [];
    expect(cause).toEqual({
      type: 'SyntaxError',
      value: `JSON Parse error: Unexpected character in ${REDACTED}`,
      mechanism: { type: 'chained', source: 'cause', handled: true, exception_id: 1, parent_id: 0 },
      stacktrace: {
        frames: [
          {
            function: 'parseFrame',
            filename: '/index.bundle',
            abs_path: '/index.bundle',
            lineno: 1,
            colno: 481920,
            in_app: true,
          },
        ],
      },
    });
    expect(error?.type).toBe('TypeError');
    expect(error?.value).toBe(
      `Cannot read property 'parts' of undefined while rendering ${REDACTED} for ${REDACTED}`,
    );
    expect(error?.stacktrace?.frames).toEqual([
      {
        function: 'renderWithHooks',
        filename: 'app:///main.jsbundle',
        abs_path: 'app:///main.jsbundle',
        lineno: 1,
        colno: 210334,
        in_app: false,
      },
      {
        function: 'ChatScreen',
        filename: 'app:///main.jsbundle',
        abs_path: 'app:///main.jsbundle',
        lineno: 1,
        colno: 482113,
        in_app: true,
      },
      {
        function: 'loadDraft',
        filename: '/Users/:id/Library/Developer/main.jsbundle',
        lineno: 1,
        colno: 99,
        in_app: true,
      },
    ]);
  });

  it("passes an exception's type through the redactor (an Error's name can be set to anything)", () => {
    const scrubbed = scrubEvent({ exception: { values: [{ type: 'Error for a@b.io' }] } });
    expect(scrubbed.exception?.values?.[0]?.type).toBe(`Error for ${REDACTED}`);
  });

  it('passes the message and the log entry through the redactor, dropping the params', () => {
    const scrubbed = scrubEvent(loadSample());
    expect(scrubbed.message).toBe(`Network request failed for ${REDACTED} with ${REDACTED}`);
    expect(scrubbed.logentry).toEqual({
      message: `push registration failed for ${REDACTED} as ${REDACTED}`,
    });
  });

  it('keeps the breadcrumbs that say what happened, scrubbed, in order', () => {
    expect(scrubEvent(loadSample()).breadcrumbs).toEqual([
      {
        timestamp: 1761471200.1,
        type: 'navigation',
        category: 'app.lifecycle',
        level: 'info',
        data: { state: 'foreground' },
      },
      {
        timestamp: 1761471204.5,
        type: 'http',
        category: 'fetch',
        data: { method: 'GET', url: '/api/chat/:id/messages', status_code: 200 },
      },
      {
        timestamp: 1761471205.6,
        type: 'http',
        category: 'fetch',
        // 'voice' is a route word (the server voice's table, src/voice/routes.ts); Auto Live has
        // no route table yet, so its other words, and the call id, are not
        data: { method: 'POST', url: '/api/voice/:id/:id/:id', status_code: 502 },
      },
      {
        timestamp: 1761471205.9,
        type: 'http',
        category: 'http',
        data: { method: 'POST', url: '/api/v1/mobile/devices', status_code: 201 },
      },
      {
        timestamp: 1761471207.0,
        type: 'navigation',
        category: 'ui.lifecycle',
        data: { screen: 'RNSScreen', beingPresented: false },
      },
      {
        timestamp: 1761471207.5,
        category: 'auth',
        level: 'warning',
        message: `token refresh for ${REDACTED} with ${REDACTED} on workspace ${REDACTED}`,
        data: { attempt: 2 },
      },
      {
        timestamp: 1761471208.2,
        type: 'error',
        category: 'sentry.event',
        level: 'error',
        event_id: '4f1c2b9e8d7a4c3b9e2f1a0b8c7d6e5f',
        message: `TypeError: Cannot read property 'parts' of undefined for key ${REDACTED}`,
      },
    ]);
  });

  it('returns a new event and never writes to a deep-frozen input', () => {
    const sample = deepFreeze(loadSample());
    const before = JSON.stringify(sample);
    const scrubbed = scrubEvent(sample);
    expect(scrubbed).not.toBe(sample);
    expect(scrubbed.sdk).not.toBe(sample.sdk);
    expect(JSON.stringify(sample)).toBe(before);
    expect(Object.isFrozen(scrubbed)).toBe(false);
  });

  it('scrubs an empty event to an empty event', () => {
    expect(scrubEvent({})).toEqual({});
  });
});

describe('scrubBreadcrumb (beforeBreadcrumb)', () => {
  it('keeps none of the planted markers in any breadcrumb it keeps', () => {
    const kept = (loadSample().breadcrumbs ?? []).map(scrubBreadcrumb).filter(Boolean);
    expect(kept.length).toBeGreaterThan(0);
    expect(leaks(JSON.stringify(kept))).toEqual([]);
  });

  it.each([...DROPPED_CATEGORIES])("drops every '%s' breadcrumb", (category) => {
    expect(scrubBreadcrumb({ category, message: 'tapped Send', data: { x: 1 } })).toBeNull();
  });

  it.each([...SENSITIVE_DATA_KEYS])("drops a breadcrumb whose data has a '%s' key", (key) => {
    expect(scrubBreadcrumb({ category: 'app', data: { [key]: 'x' } })).toBeNull();
    expect(
      scrubBreadcrumb({ category: 'app', data: { outer: { [key.toUpperCase()]: 1 } } }),
    ).toBeNull();
    expect(scrubBreadcrumb({ category: 'fetch', data: { list: [{ [key]: null }] } })).toBeNull();
  });

  it('drops a breadcrumb whose data nests deeper than the SDK ever does', () => {
    expect(
      scrubBreadcrumb({ category: 'app', data: { a: { b: { c: { d: { e: { f: 1 } } } } } } }),
    ).toBeNull();
  });

  it.each([...HTTP_CATEGORIES])(
    "reduces a '%s' breadcrumb to its method, path template and status code",
    (category) => {
      const crumb: Breadcrumb = {
        category,
        type: 'http',
        data: {
          method: 'POST',
          url: 'https://automatos.example:8443/api/v1/approval-grants/42/grant?x=1',
          status_code: 403,
          request_body_size: 12,
          reason: 'Forbidden for user@example.com',
        },
      };
      expect(scrubBreadcrumb(crumb)).toEqual({
        category,
        type: 'http',
        data: { method: 'POST', url: '/api/v1/approval-grants/:id/grant', status_code: 403 },
      });
    },
  );

  it('drops an HTTP method or status that is not one, and data left empty', () => {
    expect(
      scrubBreadcrumb({ category: 'xhr', data: { method: 'post me', status_code: '200' } }),
    ).toEqual({
      category: 'xhr',
    });
  });

  it("passes a kept breadcrumb's message through the redactor", () => {
    expect(
      scrubBreadcrumb({ category: 'app', message: 'paired with amd_abcdefgh12345678' }),
    ).toEqual({
      category: 'app',
      message: `paired with ${REDACTED}`,
    });
  });

  it('keeps single-word data values only: never free text, a URL or a nested object', () => {
    const crumb = scrubBreadcrumb({
      category: 'device.event',
      data: {
        action: 'BATTERY_STATE_CHANGE',
        level: 80,
        charging: true,
        id: '0b7e3c1a-5d2f-4e8a-9c6b-7a1d2e3f4a5b',
        label: 'Dublin offsite',
        link: 'https://example.com/a',
        nested: { ok: 1 },
        nan: Number.NaN,
      },
    });
    expect(crumb).toEqual({
      category: 'device.event',
      data: { action: 'BATTERY_STATE_CHANGE', level: 80, charging: true, id: REDACTED },
    });
  });

  it('returns a new breadcrumb and never writes to a frozen one', () => {
    const crumb = deepFreeze({ category: 'app', message: 'ok', data: { state: 'active' } });
    const scrubbed = scrubBreadcrumb(crumb);
    expect(scrubbed).not.toBe(crumb);
    expect(scrubbed).toEqual({ category: 'app', message: 'ok', data: { state: 'active' } });
  });
});
