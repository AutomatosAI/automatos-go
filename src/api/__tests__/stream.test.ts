import { describe, expect, it } from 'vitest';

import type { Frame } from '../../core/ai-sdk-stream';
import { decodeChunks } from '../body';
import { createApiClient } from '../client';
import { ApiError } from '../errors';
import type { Route } from '../routes';
import { readChunks, streamTurn } from '../stream';
import type { StreamingResponse } from '../transport-types';
import {
  PENDING,
  SERVER,
  chunked,
  fakeTransport,
  flush,
  hangUntilAborted,
  jsonReply,
  type FakeTransport,
} from './fake-transport';

const CHAT: Route = { method: 'POST', path: '/api/chat' };
const BODY = { message: { role: 'user', parts: [{ type: 'text', text: 'hi' }] } };

function clientWith(transport: FakeTransport, connectTimeoutMs?: number) {
  return createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => 'ws-1',
    transport,
    ...(connectTimeoutMs === undefined ? {} : { connectTimeoutMs }),
  });
}

async function turn(chunks: Parameters<typeof chunked>[0], signal?: AbortSignal) {
  const response = chunked(chunks);
  const transport = fakeTransport(() => response);
  const frames: Frame[] = [];
  const outcome = await streamTurn(
    clientWith(transport),
    CHAT,
    BODY,
    (f) => frames.push(f),
    signal,
  );
  return { frames, outcome, response, transport };
}

describe('streamTurn', () => {
  it('posts the turn as JSON with both headers through the stream transport', async () => {
    const { transport } = await turn(['0:"ok"\n']);
    expect(transport.calls[0]).toMatchObject({
      url: 'https://api.example.test/api/chat',
      method: 'POST',
      body: JSON.stringify(BODY),
      headers: { Authorization: 'Bearer jwt.token.value', 'X-Workspace-ID': 'ws-1' },
    });
  });

  it('feeds frames in order with lines and JSON cut across chunks', async () => {
    const { frames, outcome } = await turn([
      'd:{"type":"chat-id","chatId":"c-1","ai_generated":true}\n0:"Hel',
      'lo"\nd:{"type": "progress", "da',
      'ta": {"text": "Reading the board"}}\n',
      '0:" world"\nd:{"type":"finish","finishReason":"stop","ai_generated":true}\n',
    ]);
    expect(outcome).toBe('complete');
    expect(frames).toEqual([
      { kind: 'chat-id', chatId: 'c-1', aiGenerated: true },
      { kind: 'text', text: 'Hello' },
      { kind: 'progress', text: 'Reading the board' },
      { kind: 'text', text: ' world' },
      { kind: 'finish', finishReason: 'stop', aiGenerated: true },
    ]);
  });

  it('parses the last line when the body ends without a newline', async () => {
    const { frames } = await turn([
      '0:"a"\n',
      'e:{"message":"Provider failed","code":"provider_failed"}',
    ]);
    expect(frames).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'error', message: 'Provider failed', code: 'provider_failed' },
    ]);
  });

  it('passes unknown lines on as unknown frames, never throwing', async () => {
    const { frames, outcome } = await turn(['x:garbage\nd:{"type":"from-the-future"}\nd:{oops\n']);
    expect(outcome).toBe('complete');
    expect(frames.map((frame) => frame.kind)).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('maps a non-OK status before the body through the taxonomy', async () => {
    const transport = fakeTransport(() => jsonReply(403, { detail: 'Not your chat' }));
    const frames: Frame[] = [];
    const error = await streamTurn(clientWith(transport), CHAT, BODY, (f) => frames.push(f)).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'forbidden', status: 403, serverMessage: 'Not your chat' });
    expect(frames).toEqual([]);
  });

  it('maps a read that fails after the status to a stream error', async () => {
    const error = await turn(['0:"part"\n', new Error('connection reset')]).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('stream');
  });

  it('stops on abort between chunks and cancels the read', async () => {
    const controller = new AbortController();
    const response = chunked(['0:"one"\n', '0:"two"\n', '0:"three"\n']);
    const frames: Frame[] = [];
    const outcome = await streamTurn(
      clientWith(fakeTransport(() => response)),
      CHAT,
      BODY,
      (frame) => {
        frames.push(frame);
        controller.abort();
      },
      controller.signal,
    );
    await flush();
    expect(outcome).toBe('aborted');
    expect(frames).toEqual([{ kind: 'text', text: 'one' }]);
    expect(response.finished()).toBe(false);
    expect(response.closed()).toBe(true);
  });

  it('resolves aborted at once when the abort lands while a read is pending', async () => {
    const controller = new AbortController();
    const frames: Frame[] = [];
    const response = chunked(['0:"one"\n', PENDING]);
    const done = streamTurn(
      clientWith(fakeTransport(() => response)),
      CHAT,
      BODY,
      (frame) => frames.push(frame),
      controller.signal,
    );
    await flush();
    controller.abort();
    expect(await done).toBe('aborted');
    expect(frames).toEqual([{ kind: 'text', text: 'one' }]);
  });

  it('resolves aborted when the caller aborts before the server answers', async () => {
    const controller = new AbortController();
    const transport = fakeTransport(hangUntilAborted);
    const done = streamTurn(clientWith(transport), CHAT, BODY, () => undefined, controller.signal);
    await flush();
    controller.abort();
    expect(await done).toBe('aborted');
    expect(transport.calls[0]?.signal.aborted).toBe(true);
  });

  it('maps no answer within the connect timeout to network', async () => {
    const transport = fakeTransport(hangUntilAborted);
    const error = await streamTurn(clientWith(transport, 5), CHAT, BODY, () => undefined).catch(
      (caught: unknown) => caught,
    );
    expect((error as ApiError).kind).toBe('network');
  });

  it("forwards the caller's abort to the transport after the status arrived", async () => {
    const controller = new AbortController();
    const transport = fakeTransport(() => chunked(['0:"one"\n', PENDING]));
    const done = streamTurn(
      clientWith(transport, 5),
      CHAT,
      BODY,
      () => undefined,
      controller.signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 20)); // past the connect timeout: no timeout fires
    expect(transport.calls[0]?.signal.aborted).toBe(false);
    controller.abort();
    expect(await done).toBe('aborted');
    expect(transport.calls[0]?.signal.aborted).toBe(true);
  });
});

describe('readChunks over a real byte stream', () => {
  function byteStream(parts: readonly string[], onCancel: () => void): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let index = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        const part = parts[index];
        index += 1;
        if (part === undefined) controller.close();
        else controller.enqueue(encoder.encode(part));
      },
      cancel: onCancel,
    });
  }

  it('cancels the underlying body when the caller aborts mid-stream', async () => {
    let cancelled = false;
    const body = byteStream(['0:"one"\n', '0:"two"\n', '0:"three"\n'], () => {
      cancelled = true;
    });
    const response: StreamingResponse = {
      status: 200,
      text: async () => '',
      chunks: () => decodeChunks(body),
    };
    const controller = new AbortController();
    const seen: string[] = [];
    const outcome = await readChunks(
      response,
      (chunk) => {
        seen.push(chunk);
        controller.abort();
      },
      controller.signal,
    );
    await flush();
    expect(outcome).toBe('aborted');
    expect(seen).toEqual(['0:"one"\n']);
    expect(cancelled).toBe(true);
  });
});
