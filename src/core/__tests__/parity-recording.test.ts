import { describe, expect, it } from 'vitest';

import { validateCorpusFile } from '../parity/corpus';
import {
  RECORDER_ROUTES,
  recordedFile,
  recordedFileText,
  recorderEnv,
  recordingName,
  routeUrl,
  secretsIn,
  serverOrigin,
  turnBody,
  type Recording,
} from '../parity/recording';

// The pure half of scripts/record-turn.ts: the file it writes never holds the token or a header.
const TOKEN = 'eyJhbGciOiJSUzI1NiJ9.recorder-test-token.signature';
const WORKSPACE = '0a0a0a0a-0000-4000-8000-0000000000a5';
const ENV = {
  AUTOMATOS_API_URL: 'https://recorder:secret@api.example.test:8443/base?key=1',
  AUTOMATOS_TOKEN: TOKEN,
  AUTOMATOS_WORKSPACE_ID: WORKSPACE,
};
const SHA = '630fc1c85af06c5c76e70c74e9653ee1804fdf41';

const recording = (overrides: Partial<Recording> = {}): Recording => ({
  apiUrl: ENV.AUTOMATOS_API_URL,
  recordedAt: '2026-10-21T08:00:00.000Z',
  appSha: SHA,
  coreSha: SHA,
  message: 'What is on my board?',
  chunks: ['d:{"type":"chat-id","chatId":"c1","ai_generated":true}\n0:"Two cards."\n'],
  persisted: [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'What is on my board?' }] },
    { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Two cards.' }] },
  ],
  ...overrides,
});

describe('recorderEnv', () => {
  it('reads the three variables', () => {
    expect(recorderEnv(ENV)).toEqual(ENV);
  });

  it('names each missing or malformed variable and never echoes a value', () => {
    const bad = { AUTOMATOS_API_URL: 'ftp://files.example.test', AUTOMATOS_TOKEN: TOKEN };
    expect(() => recorderEnv(bad)).toThrowError(/AUTOMATOS_API_URL, AUTOMATOS_WORKSPACE_ID/);
    try {
      recorderEnv(bad);
    } catch (error) {
      expect(String(error)).not.toContain(TOKEN);
      expect(String(error)).not.toContain('ftp://');
    }
  });
});

describe('the request', () => {
  it('posts one user message to POST /api/chat with no chat id (a new chat)', () => {
    expect(RECORDER_ROUTES.turn).toBe('/api/chat');
    expect(turnBody('Hi')).toEqual({
      message: { role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
      selectedVisibilityType: 'private',
    });
  });

  it('keeps the API base path and drops its query and credentials', () => {
    expect(routeUrl(ENV.AUTOMATOS_API_URL, RECORDER_ROUTES.turn)).toBe(
      'https://api.example.test:8443/base/api/chat',
    );
    expect(routeUrl('http://192.168.1.20:8000/', '/api/chat')).toBe(
      'http://192.168.1.20:8000/api/chat',
    );
  });

  it('reads the chat back by its id, encoded', () => {
    expect(RECORDER_ROUTES.chat('a/b')).toBe('/api/chat/a%2Fb');
    expect(RECORDER_ROUTES.messages('c1')).toBe('/api/chat/c1/messages');
  });
});

describe('recordedFile', () => {
  it('is a valid recorded corpus file naming the server by its origin only', () => {
    const file = recordedFile(recording());
    expect(validateCorpusFile('x.json', file)).toMatchObject({ ok: true });
    expect(file).toMatchObject({
      provenance: 'recorded',
      kind: 'chat-turn',
      title: 'Recorded turn: What is on my board?',
      source: { server: 'https://api.example.test:8443', workspace: 'real' },
    });
    expect(serverOrigin(ENV.AUTOMATOS_API_URL)).toBe('https://api.example.test:8443');
  });

  it('keeps the chunks exactly as they arrived', () => {
    const chunks = ['0:"Hel', 'lo"\n', 'd:{"type":"finish","finishReason":"stop"}\n'];
    expect(recordedFile(recording({ chunks })).chunks).toEqual(chunks);
  });

  it('refuses a turn the server saved no reply for', () => {
    const persisted = recording().persisted.slice(0, 1);
    expect(() => recordedFile(recording({ persisted }))).toThrowError(/needs the reply/);
  });

  it('shortens a long message in the title', () => {
    const file = recordedFile(recording({ message: `${'word '.repeat(30)}\n end` }));
    expect(file.title).toMatch(/^Recorded turn: (word ){11}word…$/);
  });
});

describe('the file text', () => {
  it('holds no token, no workspace id, no credentials and no header', () => {
    const text = recordedFileText(recordedFile(recording()), recorderEnv(ENV));
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(WORKSPACE);
    expect(text).not.toContain('secret');
    expect(text).not.toMatch(/authorization|bearer|x-workspace-id/i);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('is refused when the recording carries the token or the workspace id', () => {
    const env = recorderEnv(ENV);
    const leaky = recordedFile(recording({ chunks: [`0:"${TOKEN} in ${WORKSPACE}"\n`] }));
    expect(secretsIn(JSON.stringify(leaky), env)).toEqual([
      'AUTOMATOS_TOKEN',
      'AUTOMATOS_WORKSPACE_ID',
    ]);
    expect(() => recordedFileText(leaky, env)).toThrowError(
      'refusing to write: the recording contains the value of AUTOMATOS_TOKEN, AUTOMATOS_WORKSPACE_ID',
    );
  });
});

describe('recordingName', () => {
  it('sorts by time and is safe as a file name', () => {
    expect(recordingName('2026-10-21T08:00:00.000Z')).toBe(
      'recorded-2026-10-21T08-00-00-000Z.json',
    );
  });
});
