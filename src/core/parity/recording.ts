// The pure half of scripts/record-turn.ts (OT-9): what it reads from the environment, what it
// posts, and the 'recorded' corpus file it writes. The file holds the server's origin, the body
// chunks and the saved messages, never a token or a header; recordedFileText refuses to return
// text that contains the token or the workspace id the recorder sent.

import { z } from 'zod';

import { corpusFileSchema, type CorpusFile, type PersistedMessage } from './corpus';

/** The routes the recorder calls (orchestrator/api/chat.py:416, 728-753, 755-788). */
export const RECORDER_ROUTES = {
  turn: '/api/chat',
  chat: (chatId: string) => `/api/chat/${encodeURIComponent(chatId)}`,
  messages: (chatId: string) => `/api/chat/${encodeURIComponent(chatId)}/messages`,
} as const;

export const RECORDING_PREFIX = 'recorded-';
const TITLE_CHARS = 60;
const ELLIPSIS = '…';

const recorderEnvSchema = z.object({
  AUTOMATOS_API_URL: z
    .string()
    .url()
    .refine((value) => /^https?:$/.test(new URL(value).protocol), 'must be http(s)'),
  AUTOMATOS_TOKEN: z.string().min(1),
  AUTOMATOS_WORKSPACE_ID: z.string().min(1),
});

export type RecorderEnv = z.infer<typeof recorderEnvSchema>;

/** The three variables, or an error naming each one missing or malformed (never its value). */
export function recorderEnv(env: Readonly<Record<string, string | undefined>>): RecorderEnv {
  const result = recorderEnvSchema.safeParse(env);
  if (result.success) return result.data;
  const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
  throw new Error(`set ${names.join(', ')} (see the top of scripts/record-turn.ts)`);
}

/** A ChatRequest with one user message (orchestrator/api/chat.py:51-75); the server opens a chat. */
export function turnBody(message: string) {
  return {
    message: { role: 'user', parts: [{ type: 'text', text: message }] },
    selectedVisibilityType: 'private',
  };
}

/** The server as the file names it: scheme, host and port only, no path, query or credentials. */
export function serverOrigin(apiUrl: string): string {
  return new URL(apiUrl).origin;
}

/** A route under the API's base path (a prefix is kept; the query and credentials are not). */
export function routeUrl(apiUrl: string, route: string): string {
  const base = new URL(apiUrl);
  return `${base.origin}${base.pathname.replace(/\/+$/, '')}${route}`;
}

/** recorded-<ISO time with ':' and '.' as '-'>.json, so recordings sort by time. */
export function recordingName(recordedAt: string): string {
  return `${RECORDING_PREFIX}${recordedAt.replace(/[:.]/g, '-')}.json`;
}

function titleOf(message: string): string {
  const line = message.replace(/\s+/g, ' ').trim();
  const short =
    line.length > TITLE_CHARS ? `${line.slice(0, TITLE_CHARS).trimEnd()}${ELLIPSIS}` : line;
  return `Recorded turn: ${short}`;
}

export type Recording = {
  readonly apiUrl: string;
  readonly recordedAt: string;
  readonly appSha: string;
  readonly coreSha: string;
  readonly message: string;
  readonly chunks: readonly string[];
  readonly persisted: readonly PersistedMessage[];
};

/** The 'recorded' corpus file for one turn, checked against the corpus schema. */
export function recordedFile(recording: Recording): CorpusFile {
  return corpusFileSchema.parse({
    provenance: 'recorded',
    kind: 'chat-turn',
    title: titleOf(recording.message),
    source: {
      server: serverOrigin(recording.apiUrl),
      recordedAt: recording.recordedAt,
      appSha: recording.appSha,
      coreSha: recording.coreSha,
      workspace: 'real',
    },
    chunks: recording.chunks,
    expected: { persisted: recording.persisted },
  });
}

/** The names of the values the recorder sent that appear in `text`. */
export function secretsIn(text: string, env: RecorderEnv): string[] {
  const sent = {
    AUTOMATOS_TOKEN: env.AUTOMATOS_TOKEN,
    AUTOMATOS_WORKSPACE_ID: env.AUTOMATOS_WORKSPACE_ID,
  };
  return Object.entries(sent).flatMap(([name, value]) => (text.includes(value) ? [name] : []));
}

/** The file as written to disk; throws, naming the variable, when it would carry a sent value. */
export function recordedFileText(file: CorpusFile, env: RecorderEnv): string {
  const text = `${JSON.stringify(file, null, 2)}\n`;
  const found = secretsIn(text, env);
  if (found.length > 0) {
    throw new Error(`refusing to write: the recording contains the value of ${found.join(', ')}`);
  }
  return text;
}
