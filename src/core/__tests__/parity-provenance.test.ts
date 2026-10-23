import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadCorpus, validateCorpusFile } from '../parity/corpus';

// K10: a file says where it came from. 'recorded' needs the full source block a real recording
// carries; 'contract' needs the catalogue line it follows. Nothing else is accepted.
const SHA = '630fc1c85af06c5c76e70c74e9653ee1804fdf41';
const RECORDED_SOURCE = {
  server: 'https://api.example.test',
  recordedAt: '2026-10-21T08:00:00.000Z',
  appSha: SHA,
  coreSha: SHA,
  workspace: 'real',
};
const REPLY = { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'Hello.' }] };

const contract = (overrides: Record<string, unknown> = {}) => ({
  provenance: 'contract',
  kind: 'chat-turn',
  source: { catalogue: 'orchestrator/consumers/chatbot/streaming.py:40-43' },
  chunks: ['0:"Hello."\n'],
  expected: { frames: ['text'], turn: { text: 'Hello.' } },
  ...overrides,
});

const recorded = (overrides: Record<string, unknown> = {}) => ({
  provenance: 'recorded',
  kind: 'chat-turn',
  source: RECORDED_SOURCE,
  chunks: ['0:"Hello."\n'],
  expected: { persisted: [REPLY] },
  ...overrides,
});

const problemsOf = (value: unknown) => {
  const result = validateCorpusFile('probe.json', value);
  return result.ok ? [] : result.problems;
};

describe('recorded files', () => {
  it('pass with the full source block and the saved reply', () => {
    expect(problemsOf(recorded())).toEqual([]);
  });

  it('fail without the source block', () => {
    const { source: _source, ...bare } = recorded();
    expect(problemsOf(bare)).toEqual([expect.stringMatching(/^probe\.json: source: Required/)]);
  });

  it.each(['server', 'recordedAt', 'appSha', 'coreSha', 'workspace'])('fail without %s', (key) => {
    const source = Object.fromEntries(
      Object.entries(RECORDED_SOURCE).filter(([name]) => name !== key),
    );
    expect(problemsOf(recorded({ source }))).toContainEqual(
      expect.stringContaining(`source.${key}`),
    );
  });

  it('fail when the workspace is not a real one, or the shas are short', () => {
    const fake = recorded({ source: { ...RECORDED_SOURCE, workspace: 'c1-fake' } });
    expect(problemsOf(fake)).toContainEqual(expect.stringContaining('source.workspace'));
    const short = recorded({ source: { ...RECORDED_SOURCE, appSha: SHA.slice(0, 9) } });
    expect(problemsOf(short)).toContainEqual(expect.stringContaining('full git sha'));
  });

  it('fail with only a catalogue line as their source', () => {
    const labelled = recorded({ source: { catalogue: 'orchestrator/api/chat.py:416' } });
    expect(problemsOf(labelled)).not.toEqual([]);
  });

  it('fail without the reply the server saved', () => {
    const userOnly = { persisted: [{ ...REPLY, role: 'user' }] };
    expect(problemsOf(recorded({ expected: userOnly }))).toContainEqual(
      expect.stringContaining('needs the reply the server saved'),
    );
  });

  it('fail when they carry anything else, a header or a token', () => {
    expect(problemsOf(recorded({ headers: { Authorization: 'Bearer x' } }))).toContainEqual(
      expect.stringContaining("Unrecognized key(s) in object: 'headers'"),
    );
    const leaky = recorded({ source: { ...RECORDED_SOURCE, token: 'x' } });
    expect(problemsOf(leaky)).toContainEqual(expect.stringContaining("'token'"));
  });
});

describe('contract files', () => {
  it('pass with a catalogue line', () => {
    expect(problemsOf(contract())).toEqual([]);
    const range = contract({ source: { catalogue: 'digests/chat-api.md:9' } });
    expect(problemsOf(range)).toEqual([]);
  });

  it('fail without a catalogue', () => {
    expect(problemsOf(contract({ source: {} }))).toEqual([
      expect.stringMatching(/^probe\.json: source\.catalogue: Required/),
    ]);
    const { source: _source, ...bare } = contract();
    expect(problemsOf(bare)).not.toEqual([]);
  });

  it('fail when the catalogue is not <file>:<line>', () => {
    const vague = contract({ source: { catalogue: 'the digest' } });
    expect(problemsOf(vague)).toContainEqual(expect.stringContaining('<file>:<line>'));
  });

  it('fail when they claim a recording source', () => {
    expect(problemsOf(contract({ source: RECORDED_SOURCE }))).not.toEqual([]);
  });

  it('fail without the frames and the turn they state', () => {
    expect(problemsOf(contract({ expected: { turn: {} } }))).toContainEqual(
      expect.stringContaining('expected.frames'),
    );
  });
});

describe('any file', () => {
  it('fails with an unknown provenance or kind', () => {
    expect(problemsOf(contract({ provenance: 'synthesised' }))).not.toEqual([]);
    expect(problemsOf(contract({ kind: 'websocket' }))).not.toEqual([]);
    expect(problemsOf('0:"Hello."')).not.toEqual([]);
  });

  it('fails with no chunks', () => {
    expect(problemsOf(contract({ chunks: [] }))).toContainEqual(expect.stringContaining('chunks'));
  });

  it('of kind sse states its events', () => {
    const sse = contract({
      kind: 'sse',
      chunks: [': hb\n\n'],
      expected: { events: [], rest: '' },
    });
    expect(problemsOf(sse)).toEqual([]);
    expect(problemsOf({ ...sse, expected: { frames: [], turn: {} } })).not.toEqual([]);
  });
});

describe('loadCorpus', () => {
  const made: string[] = [];
  const dirWith = (files: Record<string, string>) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-'));
    made.push(dir);
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
    return dir;
  };

  afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads every .json file by name and skips anything else', () => {
    const dir = dirWith({
      'b.json': JSON.stringify(recorded()),
      'a.json': JSON.stringify(contract()),
      'README.md': '# not corpus',
    });
    expect(loadCorpus(dir).map((entry) => [entry.name, entry.file.provenance])).toEqual([
      ['a.json', 'contract'],
      ['b.json', 'recorded'],
    ]);
  });

  it('throws naming every invalid file', () => {
    const { source: _source, ...bare } = recorded();
    const dir = dirWith({
      'good.json': JSON.stringify(contract()),
      'no-source.json': JSON.stringify(bare),
      'broken.json': '{"provenance": ',
    });
    expect(() => loadCorpus(dir)).toThrowError(/broken\.json: not JSON[\s\S]*no-source\.json/);
  });
});
