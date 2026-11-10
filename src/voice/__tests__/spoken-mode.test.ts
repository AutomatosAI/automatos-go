// spokenMode (US-019f): quick-ask's turn carries spokenMode true only when the server lists
// 'spoken_mode'; false or absent leaves the key out, so a typed turn's body is byte-identical to
// A2's; plan and mission mode are still never sent; the message passes through the thread's send
// (use-thread.ts spreads it into buildChatRequest) unchanged. Every quick-ask turn carries the
// locale it was heard in ("I speak"), and quick-ask's send hands the engine's speech language.

import { describe, expect, it } from 'vitest';

import type { GateInput } from '../../api/capabilities';
import { CAPABILITIES, type Capability } from '../../api/discovery';
import type { ThreadSendInput } from '../../chat/controller/use-thread';
import { ChatRequestSchema, buildChatRequest } from '../../chat/request';
import {
  quickAskMessage,
  replyFeedOptionsFor,
  spokenModeFor,
  withTurn,
} from '../quick-ask/spoken-mode';
import type { ServerSpeech } from '../server/server-speaker-ports';
import { ask, harness } from './quick-ask-harness';
import { frames, wire } from './thread-states';

const CHAT_ID = '0c5a9e1e-0000-4000-8000-00000000c019';
const HEARD = 'What needs me today?';
const BRAZIL = 'pt-BR';

function withCapabilities(capabilities: readonly Capability[]): GateInput {
  return { capabilities, push: { expo: true } };
}

const SPOKEN = withCapabilities(['spoken_mode']);
const PLAIN = withCapabilities(CAPABILITIES.filter((capability) => capability !== 'spoken_mode'));
const PLAIN_UNTIMED = withCapabilities(
  CAPABILITIES.filter((capability) => capability !== 'turn_timing'),
);

/** As the hook's send builds the body: the message spread, the thread's chat id added. */
function sent(message: ThreadSendInput, chatId: string | null = CHAT_ID) {
  return buildChatRequest({ ...message, chatId });
}

describe('buildChatRequest with spokenMode', () => {
  it('carries spokenMode true when asked', () => {
    const body = buildChatRequest({ chatId: CHAT_ID, text: HEARD, spokenMode: true });
    expect(body).toHaveProperty('spokenMode', true);
    expect(JSON.parse(JSON.stringify(body))).toEqual({
      id: CHAT_ID,
      message: { role: 'user', parts: [{ type: 'text', text: HEARD }] },
      selectedVisibilityType: 'private',
      context: { page: 'chat', route: '/chat' },
      spokenMode: true,
    });
  });

  it('leaves the key out when false or absent: the body deep-equals a typed turn', () => {
    const typed = buildChatRequest({ chatId: CHAT_ID, text: HEARD });
    const off = buildChatRequest({ chatId: CHAT_ID, text: HEARD, spokenMode: false });
    expect(typed).not.toHaveProperty('spokenMode');
    expect(off).not.toHaveProperty('spokenMode');
    expect(off).toEqual(typed);
    expect(JSON.stringify(off)).toBe(JSON.stringify(typed));
  });

  it('keeps a draft without an id and the page context as it was', () => {
    const body = buildChatRequest({ text: HEARD, spokenMode: true });
    expect(body).not.toHaveProperty('id');
    expect(body.context).toEqual({ page: 'chat', route: '/chat' });
  });

  it('never sends planMode or missionMode, spoken or not (D30)', () => {
    for (const spokenMode of [true, false, undefined]) {
      const wire = JSON.stringify(buildChatRequest({ text: HEARD, spokenMode }));
      expect(wire).not.toMatch(/planMode|missionMode/);
    }
  });

  it('puts only true on the wire: the strict schema refuses spokenMode false', () => {
    const typed = buildChatRequest({ text: HEARD });
    expect(ChatRequestSchema.safeParse({ ...typed, spokenMode: true }).success).toBe(true);
    expect(ChatRequestSchema.safeParse({ ...typed, spokenMode: false }).success).toBe(false);
  });

  it('never mutates its input', () => {
    const input = Object.freeze({ chatId: CHAT_ID, text: HEARD, spokenMode: true });
    expect(() => buildChatRequest(input)).not.toThrow();
    expect(input).toEqual({ chatId: CHAT_ID, text: HEARD, spokenMode: true });
  });
});

describe('spokenModeFor', () => {
  it('is on when the server lists spoken_mode', () => {
    expect(spokenModeFor(SPOKEN)).toBe(true);
    expect(spokenModeFor(withCapabilities(CAPABILITIES))).toBe(true);
  });

  it('is off when the capability is absent or discovery has not loaded', () => {
    expect(spokenModeFor(PLAIN)).toBe(false);
    expect(spokenModeFor(withCapabilities([]))).toBe(false);
    expect(spokenModeFor(null)).toBe(false);
    expect(spokenModeFor(undefined)).toBe(false);
  });
});

describe('quickAskMessage through the thread send', () => {
  it('flags the turn spoken when the capability is on', () => {
    const message = quickAskMessage(HEARD, SPOKEN, BRAZIL);
    expect(message).toEqual({ text: HEARD, spokenMode: true, locale: BRAZIL });
    expect(Object.isFrozen(message)).toBe(true);
    expect(sent(message)).toHaveProperty('spokenMode', true);
  });

  it('sends a plain turn when the capability is off: a typed one with its locale', () => {
    const message = quickAskMessage(HEARD, PLAIN, 'en-GB');
    expect(message).toEqual({ text: HEARD, locale: 'en-GB' });
    expect(message).not.toHaveProperty('spokenMode');
    const typed = { text: HEARD, locale: 'en-GB' };
    expect(JSON.stringify(sent(message))).toBe(JSON.stringify(sent(typed)));
    expect(JSON.stringify(sent(message, null))).toBe(JSON.stringify(sent(typed, null)));
  });

  it('sends a plain turn before discovery has loaded', () => {
    expect(sent(quickAskMessage(HEARD, undefined, BRAZIL))).not.toHaveProperty('spokenMode');
  });

  it('carries the locale on the wire', () => {
    expect(sent(quickAskMessage(HEARD, SPOKEN, BRAZIL))).toHaveProperty('locale', BRAZIL);
  });
});

describe('quick-ask sends the locale it listens in', () => {
  it('"I speak" Portuguese (Brazil): the turn says pt-BR', async () => {
    const h = harness({ speech: { language: BRAZIL } });
    await ask(h, 'Me dá três ideias de posts');
    expect(h.sends).toEqual([
      { text: 'Me dá três ideias de posts', spokenMode: true, locale: BRAZIL },
    ]);
    expect(sent(h.sends[0] ?? { text: '' })).toHaveProperty('locale', BRAZIL);
  });

  it('English or Automatic: the turn says the speech language (the phone’s on Automatic)', async () => {
    const h = harness({ speech: { language: 'en-GB' } });
    await ask(h, HEARD);
    expect(h.sends[0]).toHaveProperty('locale', 'en-GB');
  });
});

describe('replyFeedOptionsFor', () => {
  const SERVER_VOICE = {} as ServerSpeech;
  const PHONE = {};
  const WITH_SERVER = { server: SERVER_VOICE };

  it('is all off with no capabilities, on the hosted defaults and before discovery has loaded', () => {
    const off = { unitEnds: false, firstClause: false };
    expect(replyFeedOptionsFor(withCapabilities([]), WITH_SERVER)).toEqual(off);
    expect(replyFeedOptionsFor(SPOKEN, WITH_SERVER)).toEqual(off);
    expect(replyFeedOptionsFor(null, WITH_SERVER)).toEqual(off);
    expect(replyFeedOptionsFor(undefined, PHONE)).toEqual(off);
    expect(Object.isFrozen(replyFeedOptionsFor(SPOKEN, PHONE))).toBe(true);
  });

  it('unitEnds needs both spoken_mode and spoken_unit_ends', () => {
    const both = withCapabilities(['spoken_mode', 'spoken_unit_ends']);
    expect(replyFeedOptionsFor(both, PHONE).unitEnds).toBe(true);
    expect(replyFeedOptionsFor(both, WITH_SERVER).unitEnds).toBe(true);
    // Listed without spoken_mode: the turn went out plain, so its frames are not whole units.
    expect(replyFeedOptionsFor(withCapabilities(['spoken_unit_ends']), PHONE).unitEnds).toBe(false);
    expect(replyFeedOptionsFor(SPOKEN, PHONE).unitEnds).toBe(false);
    expect(replyFeedOptionsFor(both, PHONE).firstClause).toBe(false);
  });

  it('firstClause needs tts_first_clause and a server voice', () => {
    const listed = withCapabilities(['tts_first_clause']);
    expect(replyFeedOptionsFor(listed, WITH_SERVER).firstClause).toBe(true);
    expect(replyFeedOptionsFor(listed, PHONE).firstClause).toBe(false);
    expect(replyFeedOptionsFor(listed, { server: undefined }).firstClause).toBe(false);
    expect(replyFeedOptionsFor(SPOKEN, WITH_SERVER).firstClause).toBe(false);
    expect(replyFeedOptionsFor(listed, WITH_SERVER).unitEnds).toBe(false);
  });
});

describe('quick-ask cuts the reply the way the server lists', () => {
  const spoken = (h: ReturnType<typeof harness>) =>
    h.speaker.speak.mock.calls.map(([sentence]) => sentence).slice(1);

  it('speaks the first unit as its frame lands when the server lists spoken_unit_ends', async () => {
    const h = harness({ discovery: withCapabilities(['spoken_mode', 'spoken_unit_ends']) });
    await ask(h, HEARD);
    h.feed(...frames(wire.text('You have two meetings.')));
    expect(spoken(h)).toEqual(['You have two meetings.']);
    h.feed(...frames(wire.text(' One at ten.'), wire.finish), { type: 'finished' });
    expect(spoken(h)).toEqual(['You have two meetings.', 'One at ten.']);
  });

  it('waits for the next unit, as before, when the server does not list it', async () => {
    const h = harness();
    await ask(h, HEARD);
    h.feed(...frames(wire.text('You have two meetings.')));
    expect(spoken(h)).toEqual([]);
    h.feed(...frames(wire.text(' One at ten.')));
    expect(spoken(h)).toEqual(['You have two meetings.']);
    h.feed(...frames(wire.finish), { type: 'finished' });
    expect(spoken(h)).toEqual(['You have two meetings.', 'One at ten.']);
  });

  // The cost of spoken_unit_ends, pinned: a one-sentence line said before a tool call, which the
  // server then takes out of the answer (a narration frame), has already been spoken. Without the
  // capability the last sentence of the text so far is held, so that line is never heard.
  describe('a one-sentence line the server then takes out of the answer', () => {
    const UNIT_ENDS = withCapabilities(['spoken_mode', 'spoken_unit_ends']);
    const NARRATION = 'Let me check that.';
    const CLAIM = 'I have approved the invoice.';
    const ANSWER = 'You have two meetings.';
    const CORRECTED = 'The invoice still needs your approval.';
    const stops = (h: ReturnType<typeof harness>) =>
      h.speaker.stop.mock.calls.length + h.speaker.handOver.mock.calls.length;

    it('narration is spoken once, then the answer, when the server lists spoken_unit_ends', async () => {
      const h = harness({ discovery: UNIT_ENDS });
      await ask(h, HEARD);
      h.feed(...frames(wire.text(NARRATION)));
      expect(spoken(h)).toEqual([NARRATION]);
      h.feed(...frames(wire.narration(NARRATION), wire.toolStart('call_1', 'calendar')));
      h.feed(...frames(wire.toolEnd('call_1', 'calendar')));
      expect(spoken(h)).toEqual([NARRATION]);
      h.feed(...frames(wire.text(ANSWER), wire.finish), { type: 'finished' });
      expect(spoken(h)).toEqual([NARRATION, ANSWER]);
      expect(stops(h)).toBe(0);
    });

    it('a retracted claim stays spoken and is not cut off; the corrected reply follows', async () => {
      const h = harness({ discovery: UNIT_ENDS });
      await ask(h, HEARD);
      h.feed(...frames(wire.text(CLAIM)));
      expect(spoken(h)).toEqual([CLAIM]);
      h.feed(...frames(wire.narration(CLAIM, true)));
      expect(spoken(h)).toEqual([CLAIM]);
      h.feed(...frames(wire.text(CORRECTED), wire.finish), { type: 'finished' });
      expect(spoken(h)).toEqual([CLAIM, CORRECTED]);
      expect(stops(h)).toBe(0);
    });

    it('neither is ever spoken when the server does not list it, as before', async () => {
      for (const [line, retracted, rest] of [
        [NARRATION, false, ANSWER],
        [CLAIM, true, CORRECTED],
      ] as const) {
        const h = harness();
        await ask(h, HEARD);
        h.feed(...frames(wire.text(line)));
        h.feed(...frames(wire.narration(line, retracted)));
        expect(spoken(h)).toEqual([]);
        h.feed(...frames(wire.text(rest), wire.finish), { type: 'finished' });
        expect(spoken(h)).toEqual([rest]);
      }
    });
  });
});

describe('the turn reference (voice latency A-5)', () => {
  const REF = 'vt-mhq2k1ab-3';
  const TIMED = withCapabilities(['spoken_mode', 'turn_timing']);
  const SERVER: ServerSpeech = {
    voice: 'af_heart',
    speed: 1,
    client: { binary: async () => ({}) as never },
  };

  it('goes with the message only when the server lists turn_timing', () => {
    expect(quickAskMessage(HEARD, TIMED, BRAZIL, REF)).toEqual({
      text: HEARD,
      spokenMode: true,
      locale: BRAZIL,
      turnRef: REF,
    });
    expect(sent(quickAskMessage(HEARD, TIMED, BRAZIL, REF))).toHaveProperty('turnRef', REF);
    for (const discovery of [SPOKEN, PLAIN_UNTIMED, null, undefined]) {
      expect(quickAskMessage(HEARD, discovery, BRAZIL, REF)).not.toHaveProperty('turnRef');
    }
  });

  it('is left out when there is none, whatever the server lists', () => {
    expect(quickAskMessage(HEARD, TIMED, BRAZIL)).not.toHaveProperty('turnRef');
    expect(quickAskMessage(HEARD, TIMED, BRAZIL, null)).not.toHaveProperty('turnRef');
  });

  it('withTurn hands back the same speech for no turn or no server voice', () => {
    const phone = { language: 'en-GB' };
    const server = { language: 'en-GB', server: SERVER };
    expect(withTurn(phone, REF, true)).toBe(phone);
    expect(withTurn(server, null, true)).toBe(server);
  });

  it('withTurn puts the turn on a new speech, and says whether it is sent', () => {
    const speech = Object.freeze({ language: 'en-GB', rate: 1.1, server: Object.freeze(SERVER) });
    const timed = withTurn(speech, REF, true);
    expect(timed).not.toBe(speech);
    expect(timed).toEqual({ ...speech, server: { ...SERVER, turn: { ref: REF, send: true } } });
    expect(withTurn(speech, REF, false).server?.turn).toEqual({ ref: REF, send: false });
    expect(speech.server).not.toHaveProperty('turn');
    expect(Object.isFrozen(timed)).toBe(true);
  });
});
