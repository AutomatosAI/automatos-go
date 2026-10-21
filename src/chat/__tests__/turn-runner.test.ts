import { describe, expect, it } from 'vitest';

import { PENDING, chunked, jsonReply, reply } from '../../api/__tests__/fake-transport';
import { createThread, threadReducer, type ThreadDraft } from '../controller/thread';
import { createTurnRunner } from '../controller/turn-runner';
import { buildChatRequest } from '../request';
import {
  AT,
  CHAT_ID,
  callsTo,
  clientWith,
  gatedReply,
  line,
  routedTransport,
  saved,
  settle,
  store,
} from './thread-fixtures';

const DRAFT: ThreadDraft = { text: 'Plan my week', files: [], sentAt: AT };
const CANCEL_PATH = `/api/chat/${CHAT_ID}/cancel`;
const DRAFT_BODY = buildChatRequest({ text: DRAFT.text });
const CHAT_BODY = buildChatRequest({ chatId: CHAT_ID, text: DRAFT.text });

function loadedThread(turnInFlight = false) {
  return threadReducer(createThread(CHAT_ID), {
    type: 'loaded',
    chatId: CHAT_ID,
    messages: [saved('m-1', 'user', DRAFT.text)],
    turnInFlight,
  });
}

describe('createTurnRunner', () => {
  it('Stop before the chat-id frame reads on, out of sight, then cancels the chat it names', async () => {
    const body = gatedReply();
    const transport = routedTransport({
      'POST /api/chat': () => body,
      [`POST ${CANCEL_PATH}`]: () => jsonReply(200, { cancelled: true }),
    });
    const thread = store(createThread(null));
    const runner = createTurnRunner({
      client: clientWith(transport),
      dispatch: thread.dispatch,
      now: () => AT,
    });
    const turn = runner.send(DRAFT_BODY, DRAFT);
    await settle();

    await runner.stop(null);
    expect(thread.state().status).toBe('stopped');
    expect(callsTo(transport, 'POST', CANCEL_PATH)).toHaveLength(0);

    body.push(line.chatId(CHAT_ID) + line.text('Here is your week'));
    await turn;
    await settle();

    expect(callsTo(transport, 'POST', CANCEL_PATH)).toHaveLength(1);
    expect(callsTo(transport, 'POST', '/api/chat')[0]?.signal.aborted).toBe(true);
    expect(thread.types()).toEqual(['send', 'stopped', 'named']);
    expect(thread.state()).toMatchObject({ chatId: CHAT_ID, status: 'stopped' });
    expect(thread.state().live?.turn.text).toBe('');
  });

  it('a stopped draft whose stream ends without naming its chat cancels nothing', async () => {
    const body = gatedReply();
    const transport = routedTransport({ 'POST /api/chat': () => body });
    const thread = store(createThread(null));
    const runner = createTurnRunner({ client: clientWith(transport), dispatch: thread.dispatch });
    const turn = runner.send(DRAFT_BODY, DRAFT);
    await settle();
    await runner.stop(null);
    body.push(line.text('Too late'));
    body.end();
    await turn;
    expect(transport.calls).toHaveLength(1);
    expect(thread.types()).toEqual(['send', 'stopped']);
  });

  it('a Stop the server never heard goes back to working (the turn is still running there)', async () => {
    const transport = routedTransport({
      'POST /api/chat': () => chunked([line.chatId(CHAT_ID), PENDING]),
      [`POST ${CANCEL_PATH}`]: () => reply(500, JSON.stringify({ detail: 'boom' })),
    });
    const thread = store(loadedThread());
    const runner = createTurnRunner({ client: clientWith(transport), dispatch: thread.dispatch });
    void runner.send(CHAT_BODY, DRAFT);
    await settle();
    await runner.stop(CHAT_ID);
    expect(thread.types()).toContain('stopFailed');
    expect(thread.state()).toMatchObject({ status: 'working', failure: { kind: 'server' } });
  });

  it('Stop on a chat reopened mid-turn (no read of ours) cancels it by the screen’s id', async () => {
    const transport = routedTransport({
      [`POST ${CANCEL_PATH}`]: () => jsonReply(200, { cancelled: true }),
    });
    const thread = store(loadedThread(true));
    expect(thread.state().status).toBe('working');
    await createTurnRunner({ client: clientWith(transport), dispatch: thread.dispatch }).stop(
      CHAT_ID,
    );
    expect(callsTo(transport, 'POST', CANCEL_PATH)).toHaveLength(1);
    expect(thread.state().status).toBe('stopped');
  });

  it('Stop with no read and no chat sends nothing', async () => {
    const transport = routedTransport({});
    const thread = store(createThread(null));
    await createTurnRunner({ client: clientWith(transport), dispatch: thread.dispatch }).stop(null);
    expect(transport.calls).toHaveLength(0);
    expect(thread.state()).toEqual(createThread(null));
  });

  it('release lets go of the read without cancelling; nothing it reads later reaches the thread', async () => {
    const body = gatedReply();
    const transport = routedTransport({ 'POST /api/chat': () => body });
    const thread = store(loadedThread());
    const runner = createTurnRunner({ client: clientWith(transport), dispatch: thread.dispatch });
    const turn = runner.send(CHAT_BODY, DRAFT);
    body.push(line.text('Mon'));
    await settle();
    runner.release();
    body.push(line.text('day') + line.finish);
    await turn;
    expect(thread.types()).toEqual(['send', 'frame']);
    expect(callsTo(transport, 'POST', '/api/chat')[0]?.signal.aborted).toBe(true);
    expect(transport.calls).toHaveLength(1);
  });

  it('runs one turn at a time, and a new one once the last is let go of', async () => {
    const transport = routedTransport({ 'POST /api/chat': () => chunked([PENDING]) });
    const thread = store(loadedThread());
    const runner = createTurnRunner({ client: clientWith(transport), dispatch: thread.dispatch });
    void runner.send(CHAT_BODY, DRAFT);
    void runner.send(CHAT_BODY, DRAFT);
    await settle();
    expect(callsTo(transport, 'POST', '/api/chat')).toHaveLength(1);
    runner.release();
    void runner.send(CHAT_BODY, DRAFT);
    await settle();
    expect(callsTo(transport, 'POST', '/api/chat')).toHaveLength(2);
  });

  it('a read that breaks after the status is a stream failure', async () => {
    const transport = routedTransport({
      'POST /api/chat': () => chunked([line.chatId(CHAT_ID), new Error('connection reset')]),
    });
    const thread = store(loadedThread());
    await createTurnRunner({ client: clientWith(transport), dispatch: thread.dispatch }).send(
      CHAT_BODY,
      DRAFT,
    );
    expect(thread.state()).toMatchObject({
      status: 'failed',
      failure: { kind: 'stream', code: null },
    });
  });
});
