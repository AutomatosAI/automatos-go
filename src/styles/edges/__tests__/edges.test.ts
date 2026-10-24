// The edge screens' decisions and words (US-017f): which edge each error kind is, what Not running
// says for the hosted server and for a self-hosted one (the command only for the latter), that
// Something went wrong shows the taxonomy's words and never what the server sent, First open's
// starters, and Check again's button per style.

import { describe, expect, it } from 'vitest';

import { ApiError, type ApiErrorKind } from '../../../api/errors';
import { API_ERROR_COPY } from '../../../api/strings';
import { SELF_HOSTED_START_COMMAND } from '../../../connect/config';
import { EDGE_COPY } from '../../strings';
import {
  LOST_EDGE,
  STARTERS,
  edgeFor,
  notRunningEdge,
  somethingWrongEdge,
  type EdgeKind,
} from '../edges';
import { checkAgainVariant } from '../metrics';
import { NOT_RUNNING_RECHECK_MS } from '../recheck';

const HOSTED = { apiUrl: 'https://api.automatos.app', source: 'hosted' } as const;
const OWN = { apiUrl: 'http://192.168.1.20:8000', source: 'own' } as const;

describe('edgeFor', () => {
  const expected: Readonly<Record<ApiErrorKind, EdgeKind | null>> = {
    network: 'not-running',
    server: 'something-wrong',
    stream: 'something-wrong',
    invalid_response: 'something-wrong',
    auth: null,
    forbidden: null,
    not_found: null,
    conflict: null,
  };

  it('maps each kind of the taxonomy to its edge, and leaves auth and forbidden to the gate', () => {
    for (const [kind, edge] of Object.entries(expected)) {
      expect({ kind, edge: edgeFor(new ApiError(kind as ApiErrorKind)) }).toEqual({ kind, edge });
    }
  });

  it('reads a gateway that cannot reach the server as not running, any other 5xx as a snag', () => {
    expect(edgeFor(new ApiError('server', { status: 502 }))).toBe('not-running');
    expect(edgeFor(new ApiError('server', { status: 504 }))).toBe('not-running');
    expect(edgeFor(new ApiError('server', { status: 500 }))).toBe('something-wrong');
    expect(edgeFor(new ApiError('server', { status: 503 }))).toBe('something-wrong');
  });

  it('has no edge for anything that is not an ApiError', () => {
    expect(edgeFor(new Error('boom'))).toBeNull();
    expect(edgeFor(null)).toBeNull();
    expect(edgeFor('network')).toBeNull();
  });
});

describe('notRunningEdge', () => {
  it('names the hosted server by its host and shows no command', () => {
    const view = notRunningEdge(HOSTED);
    expect(view.title).toBe("api.automatos.app isn't answering.");
    expect(view.message).toBe('Check your connection, then try again.');
    expect(view.command).toBeNull();
    expect(view.commandLabel).toBeNull();
  });

  it('shows a self-hosted server as asleep, with the one command that starts it', () => {
    const view = notRunningEdge(OWN);
    expect(view.title).toBe('Automatos is asleep.');
    expect(view.message).toBe('Start it on the computer it runs on:');
    expect(view.command).toBe(SELF_HOSTED_START_COMMAND);
    expect(view.command).toMatch(/^docker compose up/);
    expect(view.commandLabel).toBe(`Command: ${SELF_HOSTED_START_COMMAND}`);
  });

  it('says the docker line only for a self-hosted server', () => {
    const hosted = Object.values(notRunningEdge(HOSTED)).join(' ');
    const own = Object.values(notRunningEdge(OWN)).join(' ');
    expect(hosted).not.toMatch(/docker/i);
    expect(own).toMatch(/docker compose up/);
  });

  it('says in words that it is not connected, how often it checks, and HUD’s glyph line', () => {
    const view = notRunningEdge(HOSTED);
    expect(view.status).toBe('Not connected');
    expect(view.checkAgain).toBe('Check again');
    expect(NOT_RUNNING_RECHECK_MS).toBe(5000);
    expect(view.recheck).toBe('Automatos Go also checks every 5 seconds.');
    expect(view.panel).toBe('— Not answering');
    expect(view.panelLabel).toBe('Not answering');
  });
});

describe('somethingWrongEdge', () => {
  it("shows the taxonomy's words for the kind, never the status or what the server sent", () => {
    const error = new ApiError('server', {
      status: 500,
      code: 'internal',
      serverMessage: 'Traceback: KeyError in orchestrator/api/chat.py',
    });
    const view = somethingWrongEdge(error);
    expect(view.message).toBe(API_ERROR_COPY.server);
    const words = Object.values(view).join(' ');
    expect(words).not.toMatch(/500|internal|Traceback|orchestrator/);
  });

  it('gives each snag kind its own words and anything else the server words', () => {
    expect(somethingWrongEdge(new ApiError('stream')).message).toBe(API_ERROR_COPY.stream);
    expect(somethingWrongEdge(new ApiError('invalid_response')).message).toBe(
      API_ERROR_COPY.invalid_response,
    );
    expect(somethingWrongEdge(new Error('boom')).message).toBe(API_ERROR_COPY.server);
  });

  it("titles the card 'I hit a snag.', Auto says 'Hm.', HUD says ✕ and the word", () => {
    const view = somethingWrongEdge(new ApiError('server'));
    expect(view).toMatchObject({
      title: 'I hit a snag.',
      retry: 'Try again',
      autoWord: 'Hm.',
      panel: '✕ Snag',
      panelLabel: 'Snag',
    });
  });
});

describe('First open and Lost', () => {
  it("keeps Ember's three starters, each with what a tap does", () => {
    expect(STARTERS.map((starter) => starter.text)).toEqual([
      'Plan my week',
      'What needs me today?',
      'Summarise what my agents did',
    ]);
    expect(new Set(STARTERS.map((starter) => starter.key)).size).toBe(3);
    for (const starter of STARTERS) expect(starter.hint).toBe('Puts this in the message box');
  });

  it("says Ember's words for every style", () => {
    expect(EDGE_COPY.firstOpen.play).toEqual(['Your Automatos,', 'the fun way.']);
    expect(EDGE_COPY.firstOpen.studio).toBe('Talk to Auto');
    expect(EDGE_COPY.firstOpen.lede).toBe("I'm Auto. Tell me what you need and I'll get it done.");
    expect(EDGE_COPY.firstOpen.hud).toBe('Say or type what you need.');
    expect(LOST_EDGE).toEqual({
      number: '404',
      title: 'This page wandered off.',
      message: "Auto looked everywhere. It's not here.",
      back: 'Back to chat',
    });
  });

  it("draws Check again as Ember's cream button in Play and the primary elsewhere", () => {
    expect(checkAgainVariant('play')).toBe('secondary');
    expect(checkAgainVariant('studio')).toBe('primary');
    expect(checkAgainVariant('hud')).toBe('primary');
  });
});
