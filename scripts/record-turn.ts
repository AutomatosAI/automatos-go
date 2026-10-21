// record-turn (PRD-001 §4.3, K10, OT-9): records ONE real chat turn as a 'recorded' parity
// corpus file. A person runs it against a real workspace; the Ralph loop never does.
//
//   AUTOMATOS_API_URL=https://<api host> \
//   AUTOMATOS_TOKEN=<a Clerk session token> \
//   AUTOMATOS_WORKSPACE_ID=<workspace uuid> \
//     npx tsx scripts/record-turn.ts "What is on my board?" [--out src/core/__fixtures__/parity]
//
// It posts the message to POST /api/chat (a new chat in that workspace), keeps every chunk of the
// body exactly as it arrived, waits until GET /api/chat/{id} says the turn is no longer in flight,
// reads GET /api/chat/{id}/messages and writes recorded-<time>.json. The token and the headers are
// never written: the file holds the server's origin only, and it is refused if it contains the
// token or the workspace id. This repository is public: record in a workspace whose content may
// be published, and read the file before committing it.
//
// Node's http(s), not fetch: in this repo HTTP goes through src/api/ (fetch is the app's).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { z } from 'zod';

import { persistedMessageSchema } from '../src/core/parity/corpus';
import {
  RECORDER_ROUTES,
  recordedFile,
  recordedFileText,
  recorderEnv,
  recordingName,
  routeUrl,
  turnBody,
  type RecorderEnv,
} from '../src/core/parity/recording';
import { replayTurn } from '../src/core/parity/replay';

const REPO = path.resolve(__dirname, '..');
const DEFAULT_OUT = 'src/core/__fixtures__/parity';
const LOCK_PATH = 'core.lock.json';
/** A turn may think for a while between frames; the socket may idle this long. */
const IDLE_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 1_000;
const MAX_POLLS = 120;
const BODY_EXCERPT_CHARS = 300;
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

type Reply = { readonly status: number; readonly chunks: readonly string[] };
type Request = { readonly method: 'GET' | 'POST'; readonly route: string; readonly body?: string };

const chatSchema = z.object({ turnInFlight: z.boolean().optional() });
const lockSchema = z.object({ sha: z.string() });

// CLI output goes to stdout/stderr directly (eslint's no-console holds here too).
function say(stream: NodeJS.WriteStream, line: string): void {
  stream.write(`[record-turn] ${line}\n`);
}

function fail(line: string): never {
  say(process.stderr, line);
  process.exit(1);
}

function headersFor(env: RecorderEnv, body: string | undefined): http.OutgoingHttpHeaders {
  return {
    Accept: '*/*',
    Authorization: `Bearer ${env.AUTOMATOS_TOKEN}`,
    'X-Workspace-ID': env.AUTOMATOS_WORKSPACE_ID,
    ...(body === undefined
      ? {}
      : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }),
  };
}

/** One request; the body comes back as the chunks the socket delivered, decoded as UTF-8. */
function send(env: RecorderEnv, request: Request): Promise<Reply> {
  const url = routeUrl(env.AUTOMATOS_API_URL, request.route);
  const client = url.startsWith('https:') ? https : http;
  const options = { method: request.method, headers: headersFor(env, request.body) };
  return new Promise((resolve, reject) => {
    const req = client.request(url, { ...options, timeout: IDLE_TIMEOUT_MS }, (res) => {
      const chunks: string[] = [];
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, chunks }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`no data for ${IDLE_TIMEOUT_MS / 1000} s`)));
    req.on('error', reject);
    req.end(request.body);
  });
}

async function sendOk(env: RecorderEnv, request: Request): Promise<Reply> {
  const reply = await send(env, request);
  if (reply.status < HTTP_OK_MIN || reply.status > HTTP_OK_MAX) {
    const excerpt = reply.chunks.join('').slice(0, BODY_EXCERPT_CHARS);
    throw new Error(`${request.method} ${request.route} answered ${reply.status}: ${excerpt}`);
  }
  return reply;
}

async function getJson(env: RecorderEnv, route: string): Promise<unknown> {
  const reply = await sendOk(env, { method: 'GET', route });
  return JSON.parse(reply.chunks.join(''));
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The turn runs detached on the server (services/chat_turns.py); wait until it is saved. */
async function waitForTurn(env: RecorderEnv, chatId: string): Promise<void> {
  for (let poll = 0; poll < MAX_POLLS; poll += 1) {
    const chat = chatSchema.parse(await getJson(env, RECORDER_ROUTES.chat(chatId)));
    if (chat.turnInFlight !== true) return;
    await pause(POLL_INTERVAL_MS);
  }
  throw new Error(`the turn was still in flight after ${MAX_POLLS} checks`);
}

function shas(): { appSha: string; coreSha: string } {
  const appSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  const lock = lockSchema.parse(JSON.parse(fs.readFileSync(path.join(REPO, LOCK_PATH), 'utf8')));
  return { appSha, coreSha: lock.sha };
}

function cli(): { message: string; out: string } {
  const { values, positionals } = parseArgs({
    options: { out: { type: 'string' } },
    allowPositionals: true,
  });
  const message = positionals.join(' ').trim();
  if (!message) fail('usage: npx tsx scripts/record-turn.ts "<message>" [--out <dir>]');
  return { message, out: path.resolve(REPO, values.out ?? DEFAULT_OUT) };
}

async function main(): Promise<void> {
  const { message, out } = cli();
  const env = recorderEnv(process.env);
  const recordedAt = new Date().toISOString();
  const body = JSON.stringify(turnBody(message));
  const turn = await sendOk(env, { method: 'POST', route: RECORDER_ROUTES.turn, body });
  const chatId = replayTurn(turn.chunks).turn.chatId;
  if (!chatId) throw new Error('the stream carried no chat-id frame; nothing to read back');
  await waitForTurn(env, chatId);
  const rows = z
    .array(persistedMessageSchema)
    .parse(await getJson(env, RECORDER_ROUTES.messages(chatId)));
  const file = recordedFile({
    apiUrl: env.AUTOMATOS_API_URL,
    recordedAt,
    ...shas(),
    message,
    chunks: turn.chunks,
    persisted: rows,
  });
  const target = path.join(out, recordingName(recordedAt));
  fs.writeFileSync(target, recordedFileText(file, env), { flag: 'wx' });
  say(
    process.stdout,
    `${turn.chunks.length} chunks, ${rows.length} saved messages → ${path.relative(REPO, target)}`,
  );
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
