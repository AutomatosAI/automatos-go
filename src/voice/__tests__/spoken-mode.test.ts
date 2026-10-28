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
import { quickAskMessage, spokenModeFor } from '../quick-ask/spoken-mode';
import { ask, harness } from './quick-ask-harness';

const CHAT_ID = '0c5a9e1e-0000-4000-8000-00000000c019';
const HEARD = 'What needs me today?';
const BRAZIL = 'pt-BR';

function withCapabilities(capabilities: readonly Capability[]): GateInput {
  return { capabilities, push: { expo: true } };
}

const SPOKEN = withCapabilities(['spoken_mode']);
const PLAIN = withCapabilities(CAPABILITIES.filter((capability) => capability !== 'spoken_mode'));

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
