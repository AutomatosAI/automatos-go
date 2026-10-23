import { describe, expect, it } from 'vitest';

import { PENDING, chunked, jsonReply, reply } from '../../api/__tests__/fake-transport';
import { ApiError } from '../../api/errors';
import { createLiveHub } from '../../api/live-events';
import { isPersistableKey, queryKeys } from '../../api/query-keys';
import type { Frame } from '../../core/ai-sdk-stream';
import { fetchMessages } from '../api';
import { ensureLiveChatId, isChatChangedFor } from '../controller/live-chat';
import {
  canSend,
  canStop,
  createThread,
  loadedAction,
  openingList,
  shownMessages,
  threadReducer,
  type ThreadAction,
  type ThreadDraft,
  type ThreadState,
} from '../controller/thread';
import { createTurnRunner } from '../controller/turn-runner';
import { buildChatRequest } from '../request';
import type { StoredMessage } from '../schemas';
import {
  AT,
  CHAT_ID,
  OTHER_CHAT_ID,
  afterTurn,
  answerSaved,
  callsTo,
  clientWith,
  deepFreeze,
  line,
  routedTransport,
  saved,
  savedList,
  settle,
  store,
} from './thread-fixtures';

const DRAFT: ThreadDraft = { text: 'What needs me?', files: [], sentAt: AT };
const ASKED = saved('m-1', 'user', 'What needs me?');
const REPLIED = saved('m-2', 'assistant', 'Two things need you.');
const EARLIER = saved('m-0', 'assistant', 'Morning. Nothing needs you.');
const SEND = 'POST /api/chat';
const CANCEL = `POST /api/chat/${CHAT_ID}/cancel`;

function run(state: ThreadState, ...actions: ThreadAction[]): ThreadState {
  return actions.reduce(threadReducer, state);
}

function loaded(messages: readonly StoredMessage[], turnInFlight = false): ThreadState {
  return run(createThread(CHAT_ID), { type: 'loaded', chatId: CHAT_ID, messages, turnInFlight });
}

const frame = (f: Frame): ThreadAction => ({ type: 'frame', frame: f, at: AT });
const TEXT = (text: string): Frame => ({ kind: 'text', text });
const CHAT_ID_FRAME = (chatId: string): Frame => ({ kind: 'chat-id', chatId, aiGenerated: true });

describe('the chat controller (US-008b)', () => {
  it('send → frames → finished: the turn streams, then the saved reply retires it', async () => {
    const transport = routedTransport({
      [SEND]: () =>
        chunked([
          line.chatId(CHAT_ID) + line.text('Two '),
          line.text('things need you.') + line.toolStart('t1', 'board_list'),
          line.finish,
        ]),
    });
    const thread = store(createThread(null));
    const runner = createTurnRunner({
      client: clientWith(transport),
      dispatch: thread.dispatch,
      now: () => AT,
    });
    await runner.send(buildChatRequest({ text: DRAFT.text }), DRAFT);

    expect(thread.types()).toEqual([
      'send',
      'frame',
      'frame',
      'frame',
      'frame',
      'frame',
      'finished',
    ]);
    const state = thread.state();
    expect(state).toMatchObject({ chatId: CHAT_ID, status: 'idle', failure: null });
    expect(state.live?.draft).toEqual(DRAFT);
    expect(state.live?.turn.text).toBe('Two things need you.');
    expect(state.live?.turn.toolCalls).toEqual([
      expect.objectContaining({ toolCallId: 't1', state: 'completed', startedAt: AT, endedAt: AT }),
    ]);

    thread.dispatch({ type: 'refetched', messages: [ASKED, REPLIED] });
    expect(thread.state().live).toBeNull();
    expect(shownMessages(thread.state())).toEqual([ASKED, REPLIED]);
  });

  it('Stop aborts the read AND cancels on the server; the thread shows stopped, not failed', async () => {
    const response = chunked([line.chatId(CHAT_ID) + line.text('Working on it'), PENDING]);
    const transport = routedTransport({
      [SEND]: () => response,
      [CANCEL]: () => jsonReply(200, { cancelled: true }),
    });
    const thread = store(loaded([EARLIER]));
    const runner = createTurnRunner({
      client: clientWith(transport),
      dispatch: thread.dispatch,
      now: () => AT,
    });
    const turn = runner.send(buildChatRequest({ chatId: CHAT_ID, text: DRAFT.text }), DRAFT);
    await settle();
    expect(canStop(thread.state())).toBe(true);

    await runner.stop(CHAT_ID);
    await turn.then(() => afterTurn([EARLIER]).forEach(thread.dispatch));

    expect(callsTo(transport, 'POST', `/api/chat/${CHAT_ID}/cancel`)).toHaveLength(1);
    expect(callsTo(transport, 'POST', '/api/chat')[0]?.signal.aborted).toBe(true);
    expect(thread.state()).toMatchObject({ status: 'stopped', failure: null });
    expect(thread.state().live?.turn.text).toBe('Working on it');
    expect(thread.types()).not.toContain('failed');
    expect(thread.types()).not.toContain('finished');
    expect(canSend(thread.state())).toBe(true);
  });

  it('a stale id (404) or another user’s chat (403) starts a draft; the next send carries no id', async () => {
    for (const status of [404, 403]) {
      const transport = routedTransport({
        [`GET /api/chat/${CHAT_ID}`]: () =>
          reply(status, JSON.stringify({ detail: 'Chat not found' })),
      });
      const live = await ensureLiveChatId(clientWith(transport), CHAT_ID);
      expect(live).toBeNull();
      const action = loadedAction(null, undefined);
      const state = run(createThread(CHAT_ID), action as ThreadAction);
      expect(state).toMatchObject({ chatId: null, status: 'idle', messages: [] });
      expect(buildChatRequest({ chatId: state.chatId, text: 'Hello' })).not.toHaveProperty('id');
    }
  });

  it('turnInFlight → working → chat_changed for this chat → refetched, merged by id', async () => {
    const transport = routedTransport({
      [`GET /api/chat/${CHAT_ID}/messages`]: () => jsonReply(200, [ASKED, REPLIED]),
    });
    const client = clientWith(transport);
    const thread = store(loaded([ASKED], true));
    expect(thread.state().status).toBe('working');
    expect(thread.state().live).toMatchObject({ draft: null, since: 1 });
    expect(canSend(thread.state())).toBe(false);

    const hub = createLiveHub();
    hub.on('chat_changed', (data) => {
      if (!isChatChangedFor(thread.state().chatId, data)) return;
      void fetchMessages(client, CHAT_ID).then((messages) =>
        thread.dispatch({ type: 'refetched', messages }),
      );
    });
    hub.emit({ type: 'chat_changed', data: { workspace_id: 'w', chat_id: OTHER_CHAT_ID } });
    await settle();
    expect(transport.calls).toHaveLength(0);

    hub.emit({ type: 'chat_changed', data: { workspace_id: 'w', chat_id: CHAT_ID } });
    await settle();
    expect(thread.state()).toMatchObject({ status: 'idle', live: null });
    expect(thread.state().messages.map((message) => message.id)).toEqual(['m-1', 'm-2']);
  });

  it('reopened mid-turn, a chat opens on this visit’s list, never the cached one (D-STALE-CHAT)', () => {
    const cached = savedList(false, [EARLIER]);
    const fresh = savedList(true, [EARLIER, ASKED]);
    expect([openingList(cached), openingList(fresh)]).toEqual([undefined, fresh.data]);
    const waiting = answerSaved(createThread(CHAT_ID), cached);
    const working = answerSaved(waiting, fresh);
    expect([waiting.status, working.status]).toEqual(['loading', 'working']);
    expect(working.live).toMatchObject({ draft: null, since: 2 });
    const replied = answerSaved(working, savedList(true, [EARLIER, ASKED, REPLIED]));
    expect(replied).toMatchObject({ status: 'idle', live: null });
    expect(shownMessages(replied)).toEqual([EARLIER, ASKED, REPLIED]);
  });

  it('an e: line → failed with the taxonomy kind (turn + its code); a refusal → the client’s kind', async () => {
    const failing = routedTransport({
      [SEND]: () =>
        chunked([
          line.chatId(CHAT_ID) + line.text('Let me'),
          line.error('Slow down', 'rate_limited'),
        ]),
    });
    const thread = store(loaded([]));
    const runner = createTurnRunner({ client: clientWith(failing), dispatch: thread.dispatch });
    await runner.send(buildChatRequest({ chatId: CHAT_ID, text: DRAFT.text }), DRAFT);
    expect(thread.state()).toMatchObject({
      status: 'failed',
      failure: { kind: 'turn', code: 'rate_limited' },
    });

    const refused = routedTransport({
      [SEND]: () => reply(403, JSON.stringify({ detail: 'Access denied' })),
    });
    const viewer = store(loaded([]));
    await createTurnRunner({ client: clientWith(refused), dispatch: viewer.dispatch }).send(
      buildChatRequest({ chatId: CHAT_ID, text: DRAFT.text }),
      DRAFT,
    );
    expect(viewer.state()).toMatchObject({
      status: 'failed',
      failure: { kind: 'forbidden', code: null },
    });
  });

  it('keeps chat threads and messages out of the phone’s cache (D-CACHE)', () => {
    expect(isPersistableKey(queryKeys.chat.thread(CHAT_ID))).toBe(false);
    expect(isPersistableKey(queryKeys.chat.messages(CHAT_ID))).toBe(false);
  });
});

describe('threadReducer', () => {
  it('opens a cached id as loading (checked first) and no id as a ready draft', () => {
    expect(createThread(CHAT_ID)).toMatchObject({ chatId: CHAT_ID, status: 'loading' });
    expect(createThread(null)).toMatchObject({ chatId: null, status: 'idle' });
    expect([canSend(createThread(CHAT_ID)), canSend(createThread(null))]).toEqual([false, true]);
  });

  it('loads idle, or working when a turn is in flight and the reply is not saved yet', () => {
    expect(loaded([ASKED, REPLIED])).toMatchObject({ status: 'idle', live: null });
    expect(loaded([ASKED, REPLIED], true)).toMatchObject({ status: 'idle', live: null });
    expect(loaded([ASKED], true)).toMatchObject({ status: 'working' });
    const reloaded = run(loaded([ASKED]), {
      type: 'loaded',
      chatId: CHAT_ID,
      messages: [ASKED, REPLIED],
      turnInFlight: true,
    });
    expect(reloaded).toMatchObject({ status: 'idle', messages: [ASKED, REPLIED] });
  });

  it('a send is refused while loading, streaming or working', () => {
    const streaming = run(loaded([]), { type: 'send', draft: DRAFT });
    expect(streaming.status).toBe('streaming');
    expect(run(streaming, { type: 'send', draft: { ...DRAFT, text: 'again' } })).toBe(streaming);
    expect(run(createThread(CHAT_ID), { type: 'send', draft: DRAFT }).status).toBe('loading');
    expect(run(loaded([ASKED], true), { type: 'send', draft: DRAFT }).status).toBe('working');
  });

  it('the chat-id frame names a draft; another id than a cached one is a new chat', () => {
    const named = run(
      createThread(null),
      { type: 'send', draft: DRAFT },
      frame(CHAT_ID_FRAME(CHAT_ID)),
    );
    expect(named.chatId).toBe(CHAT_ID);
    expect(named.live?.turn.chatId).toBe(CHAT_ID);

    const moved = run(
      loaded([EARLIER]),
      { type: 'send', draft: DRAFT },
      frame(CHAT_ID_FRAME(OTHER_CHAT_ID)),
    );
    expect(moved).toMatchObject({ chatId: OTHER_CHAT_ID, messages: [] });
    expect(moved.live?.since).toBe(0);
  });

  it('ignores frames, finished and failed when no turn is streaming', () => {
    const state = loaded([EARLIER]);
    expect(run(state, frame(TEXT('late')))).toBe(state);
    expect(run(state, { type: 'finished' })).toBe(state);
    expect(run(state, { type: 'failed', error: new ApiError('network') })).toBe(state);
  });

  it('holds back the saved copies of a streaming turn and never retires it mid-stream', () => {
    const streaming = run(loaded([EARLIER]), { type: 'send', draft: DRAFT }, frame(TEXT('Two')));
    const refetched = run(streaming, { type: 'refetched', messages: [EARLIER, ASKED, REPLIED] });
    expect(refetched.messages).toEqual([EARLIER, ASKED, REPLIED]);
    expect(shownMessages(refetched)).toEqual([EARLIER]);
    expect(refetched.live?.turn.text).toBe('Two');
    expect(refetched.status).toBe('streaming');
  });

  it('keeps a turn the server failed until the next send; a refetch does not retire it', () => {
    const failed = run(
      loaded([]),
      { type: 'send', draft: DRAFT },
      frame({ kind: 'error', message: 'Out of runs', code: 'brand_new_code' }),
      { type: 'finished' },
    );
    expect(failed).toMatchObject({
      status: 'failed',
      failure: { kind: 'turn', code: 'turn_failed' },
    });
    const refetched = run(failed, ...afterTurn([ASKED, REPLIED]));
    expect(refetched.live).not.toBeNull();
    expect(shownMessages(refetched)).toEqual([]);
    const next = run(refetched, { type: 'send', draft: DRAFT });
    expect(next).toMatchObject({ status: 'streaming', failure: null });
    expect(shownMessages(next)).toEqual([ASKED, REPLIED]);
  });

  it('maps a thrown failure to the client taxonomy, and retires a broken read once its reply lands', () => {
    const streaming = run(loaded([]), { type: 'send', draft: DRAFT });
    const trial = new ApiError('server', { status: 402, code: 'trial_exhausted' });
    expect(run(streaming, { type: 'failed', error: trial }).failure).toEqual({
      kind: 'server',
      code: 'trial_exhausted',
    });
    expect(run(streaming, { type: 'failed', error: new TypeError('x') }).failure).toEqual({
      kind: 'server',
      code: null,
    });
    const broken = run(streaming, { type: 'failed', error: new ApiError('stream') });
    expect(broken.failure).toEqual({ kind: 'stream', code: null });
    const landed = run(broken, { type: 'refetched', messages: [ASKED, REPLIED] });
    expect(landed).toMatchObject({ status: 'idle', live: null, failure: null });
  });

  it('Stop leaves a running tool call running, so it reads stopped; refused when nothing runs', () => {
    const running = run(
      loaded([]),
      { type: 'send', draft: DRAFT },
      frame({ kind: 'tool-start', toolCallId: 't1', toolName: 'board_list' }),
    );
    const stopped = run(running, { type: 'stopped', at: AT });
    expect(stopped).toMatchObject({ status: 'stopped', live: running.live, failure: null });
    expect(stopped.live?.turn.toolCalls).toEqual([
      expect.objectContaining({ toolCallId: 't1', state: 'running' }),
    ]);
    expect(run(stopped, frame(TEXT('after')))).toBe(stopped);
    const idle = loaded([]);
    expect(run(idle, { type: 'stopped', at: AT })).toBe(idle);
  });

  it('a Stop that did not reach the server goes back to working until the reply lands', () => {
    const stopped = run(loaded([]), { type: 'send', draft: DRAFT }, { type: 'stopped', at: AT });
    const working = run(stopped, { type: 'stopFailed', error: new ApiError('network') });
    expect(working).toMatchObject({ status: 'working', failure: { kind: 'network', code: null } });
    expect(canStop(working)).toBe(true);
    expect(run(working, { type: 'refetched', messages: [ASKED, REPLIED] })).toMatchObject({
      status: 'idle',
      live: null,
      failure: null,
    });
    expect(run(loaded([]), { type: 'stopFailed', error: null }).status).toBe('idle');
  });

  it('names a draft stopped before its chat-id frame, only while nothing newer started', () => {
    const stopped = run(
      createThread(null),
      { type: 'send', draft: DRAFT },
      { type: 'stopped', at: AT },
    );
    expect(run(stopped, { type: 'named', chatId: CHAT_ID })).toMatchObject({
      chatId: CHAT_ID,
      status: 'stopped',
    });
    const again = run(stopped, { type: 'send', draft: DRAFT });
    expect(run(again, { type: 'named', chatId: CHAT_ID })).toBe(again);
  });

  it('gives up on a detached reply (the guard) and opens another chat fresh', () => {
    expect(run(loaded([ASKED], true), { type: 'gaveUp' })).toMatchObject({
      status: 'idle',
      live: null,
    });
    const idle = loaded([ASKED]);
    expect(run(idle, { type: 'gaveUp' })).toBe(idle);
    expect(run(idle, { type: 'opened', chatId: null })).toEqual(createThread(null));
  });

  it('never mutates its input (deep-frozen states and actions all the way through)', () => {
    const actions: ThreadAction[] = [
      { type: 'loaded', chatId: CHAT_ID, messages: [EARLIER], turnInFlight: false },
      { type: 'send', draft: DRAFT },
      frame(CHAT_ID_FRAME(CHAT_ID)),
      frame({ kind: 'tool-start', toolCallId: 't1', toolName: 'board_list' }),
      frame(TEXT('Two things')),
      { type: 'refetched', messages: [EARLIER, ASKED] },
      { type: 'stopped', at: AT },
      { type: 'stopFailed', error: new ApiError('network') },
      { type: 'stopped', at: AT },
      { type: 'refetched', messages: [EARLIER, ASKED, REPLIED] },
      { type: 'send', draft: DRAFT },
      frame({ kind: 'error', message: 'No', code: 'rate_limited' }),
      { type: 'finished' },
      { type: 'failed', error: new ApiError('stream') },
      { type: 'gaveUp' },
      { type: 'named', chatId: CHAT_ID },
      { type: 'opened', chatId: null },
    ];
    let state = deepFreeze(createThread(CHAT_ID));
    for (const action of actions) {
      const before = JSON.stringify(state);
      const next = threadReducer(state, deepFreeze(action));
      expect(JSON.stringify(state)).toBe(before);
      state = deepFreeze(next);
    }
    expect(state).toEqual(createThread(null));
  });
});
