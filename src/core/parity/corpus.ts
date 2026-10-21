// The parity corpus (PRD-001 §4.3, K10): files that say what the server sends and what the app
// must make of it. Every file names where it came from. 'recorded' files are real turns written
// only by scripts/record-turn.ts against a real workspace; 'contract' files are built from the
// frame catalogue and name the line they follow. A file is checked against the schema of its
// provenance and kind; unknown keys are refused, so a stray header or token cannot ride along.

import fs from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

export const PROVENANCES = ['recorded', 'contract'] as const;
export const CORPUS_KINDS = ['chat-turn', 'sse'] as const;

export type Provenance = (typeof PROVENANCES)[number];

const CORPUS_EXTENSION = '.json';
/** `<file>:<line>` or `<file>:<first>-<last>`, a path in automatos-ai or the review digests. */
const CATALOGUE_REF = /^[\w./-]+:\d+(?:-\d+)?$/;
const GIT_SHA = /^[0-9a-f]{40}$/;
const ASSISTANT = 'assistant';

const title = z.string().min(1).optional();
const chunks = z.array(z.string()).min(1);

const contractSource = z
  .object({
    catalogue: z.string().regex(CATALOGUE_REF, 'catalogue must be <file>:<line>'),
  })
  .strict();

const recordedSource = z
  .object({
    server: z.string().url(),
    recordedAt: z.string().datetime(),
    appSha: z.string().regex(GIT_SHA, 'appSha must be a full git sha'),
    coreSha: z.string().regex(GIT_SHA, 'coreSha must be a full git sha'),
    workspace: z.literal('real'),
  })
  .strict();

/** One row of GET /api/chat/{id}/messages (orchestrator/api/chat.py:755-788), kept as sent. */
export const persistedMessageSchema = z
  .object({
    id: z.string().min(1),
    role: z.string(),
    parts: z.array(z.object({ type: z.string() }).passthrough()),
  })
  .passthrough();

export type PersistedMessage = z.infer<typeof persistedMessageSchema>;

/** A contract turn states the frames in order, the unread tail, and part of the final turn. */
const contractTurnExpected = z
  .object({
    frames: z.array(z.string()),
    rest: z.string().optional(),
    turn: z.record(z.unknown()),
  })
  .strict();

/** A recorded turn carries what the server saved; the replay must agree with it. */
const recordedTurnExpected = z
  .object({
    persisted: z
      .array(persistedMessageSchema)
      .refine((rows) => rows.some((row) => row.role === ASSISTANT), {
        message: 'a recorded turn needs the reply the server saved',
      }),
  })
  .strict();

const sseExpected = z
  .object({
    events: z.array(z.object({ event: z.string(), data: z.unknown() }).strict()),
    rest: z.string().optional(),
  })
  .strict();

const contractTurn = z
  .object({
    provenance: z.literal('contract'),
    kind: z.literal('chat-turn'),
    title,
    source: contractSource,
    chunks,
    expected: contractTurnExpected,
  })
  .strict();

const contractSse = z
  .object({
    provenance: z.literal('contract'),
    kind: z.literal('sse'),
    title,
    source: contractSource,
    chunks,
    expected: sseExpected,
  })
  .strict();

const recordedTurn = z
  .object({
    provenance: z.literal('recorded'),
    kind: z.literal('chat-turn'),
    title,
    source: recordedSource,
    chunks,
    expected: recordedTurnExpected,
  })
  .strict();

const recordedSse = z
  .object({
    provenance: z.literal('recorded'),
    kind: z.literal('sse'),
    title,
    source: recordedSource,
    chunks,
    expected: sseExpected,
  })
  .strict();

const VARIANTS = {
  contract: { 'chat-turn': contractTurn, sse: contractSse },
  recorded: { 'chat-turn': recordedTurn, sse: recordedSse },
} as const;

/** A corpus file: its provenance and kind pick the schema the rest of it must meet. */
export const corpusFileSchema = z
  .object({ provenance: z.enum(PROVENANCES), kind: z.enum(CORPUS_KINDS) })
  .passthrough()
  .transform((head, ctx) => {
    const result = VARIANTS[head.provenance][head.kind].safeParse(head);
    if (result.success) return result.data;
    for (const issue of result.error.issues) ctx.addIssue(issue);
    return z.NEVER;
  });

export type CorpusFile = z.output<typeof corpusFileSchema>;
export type ContractTurnFile = z.output<typeof contractTurn>;
export type RecordedTurnFile = z.output<typeof recordedTurn>;
export type SseFile = z.output<typeof contractSse> | z.output<typeof recordedSse>;

export type CorpusEntry = { readonly name: string; readonly file: CorpusFile };

export type Validation =
  | { readonly ok: true; readonly entry: CorpusEntry }
  | { readonly ok: false; readonly problems: readonly string[] };

function issueLine(name: string, issue: z.ZodIssue): string {
  const where = issue.path.length > 0 ? issue.path.join('.') : '(file)';
  return `${name}: ${where}: ${issue.message}`;
}

/** One corpus file checked against its schema; every problem is named with the file. */
export function validateCorpusFile(name: string, value: unknown): Validation {
  const result = corpusFileSchema.safeParse(value);
  return result.success
    ? { ok: true, entry: { name, file: result.data } }
    : { ok: false, problems: result.error.issues.map((issue) => issueLine(name, issue)) };
}

function jsonIn(text: string): { readonly value: unknown } | null {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return null; // reported as a problem by the caller
  }
}

function readCorpusFile(dir: string, name: string): Validation {
  const json = jsonIn(fs.readFileSync(path.join(dir, name), 'utf8'));
  return json
    ? validateCorpusFile(name, json.value)
    : { ok: false, problems: [`${name}: not JSON`] };
}

/** Every `.json` file in `dir`, by name, each validated; throws naming every invalid file. */
export function loadCorpus(dir: string): CorpusEntry[] {
  const names = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(CORPUS_EXTENSION))
    .sort();
  const results = names.map((name) => readCorpusFile(dir, name));
  const problems = results.flatMap((result) => (result.ok ? [] : result.problems));
  if (problems.length > 0) {
    throw new Error(`invalid parity corpus in ${dir}:\n${problems.join('\n')}`);
  }
  return results.flatMap((result) => (result.ok ? [result.entry] : []));
}

/** How many files of each provenance the corpus holds (zero recorded is allowed). */
export function countByProvenance(entries: readonly CorpusEntry[]): Record<Provenance, number> {
  const count = (provenance: Provenance) =>
    entries.filter((entry) => entry.file.provenance === provenance).length;
  return { recorded: count('recorded'), contract: count('contract') };
}
