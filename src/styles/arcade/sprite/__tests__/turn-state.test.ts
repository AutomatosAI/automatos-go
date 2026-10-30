// The portrait's state from the home's turn (turn-state.ts, D-ARC-5), one test per row of the
// design's README ("Portrait state follows the turn", with its host-event mapping): the events the
// home feeds the vendored reducer, the portrait it then shows. The one-shots end after the kit's
// ONE_SHOT_MS through oneShotEnded, as a clip's end would.

import { describe, expect, it } from 'vitest';

import { INITIAL_MASCOT, mascotReducer } from '../../../../core/frozen/lib/mascot/reducer';
import type { MascotEvent, MascotState } from '../../../../core/frozen/lib/mascot/types';
import { ONE_SHOT_MS, oneShotEndMs, oneShotEnded, portraitState, typingEvent } from '../turn-state';

const SEND: MascotEvent = { type: 'send' };

function turn(events: readonly MascotEvent[], from: MascotState = INITIAL_MASCOT): MascotState {
  return events.reduce(mascotReducer, from);
}

function tool(toolName: string, toolCallId = 'call-1'): MascotEvent {
  return { type: 'tool-start', toolCallId, toolName, input: {} };
}

function portrait(events: readonly MascotEvent[]) {
  return portraitState(turn(events));
}

describe("the portrait follows the turn (the README's rows)", () => {
  it('listens while the person types', () => {
    expect(portrait([typingEvent(true)])).toBe('listening');
  });

  it('is idle again when the person stops typing without sending', () => {
    expect(portrait([typingEvent(true), typingEvent(false)])).toBe('idle');
  });

  it('thinks while waiting for the reply', () => {
    expect(portrait([typingEvent(true), SEND])).toBe('thinking');
  });

  it('works on a tool', () => {
    expect(portrait([SEND, tool('generate_document')])).toBe('working');
  });

  it('searches on a web search', () => {
    expect(portrait([SEND, tool('platform_web_search')])).toBe('searching');
  });

  it('reads on documents', () => {
    expect(portrait([SEND, tool('platform_read_document')])).toBe('reading');
  });

  it('celebrates when a Deliverable lands', () => {
    expect(portrait([SEND, { type: 'deliverable-added' }])).toBe('celebrate');
  });

  it('says oops on an error', () => {
    const error: MascotEvent = { type: 'error', message: 'failed', code: null };
    expect(portrait([SEND, error])).toBe('oops');
  });

  it('is idle otherwise: at first, and once a turn has finished', () => {
    expect(portrait([])).toBe('idle');
    const finish: MascotEvent = { type: 'finish', finishReason: 'stop' };
    expect(portrait([SEND, { type: 'text', text: 'Done.' }, finish])).toBe('idle');
  });
});

describe('a one-shot ends by itself', () => {
  it('after the kit’s ONE_SHOT_MS for hello and celebrate, never for a loop', () => {
    expect(ONE_SHOT_MS).toBe(2400);
    expect(oneShotEndMs('celebrate')).toBe(ONE_SHOT_MS);
    expect(oneShotEndMs('hello')).toBe(ONE_SHOT_MS);
    expect(oneShotEndMs('thinking')).toBeNull();
    expect(oneShotEndMs('idle')).toBeNull();
  });

  it('settles a celebration where the reducer rests, as a clip’s end would', () => {
    const celebrating = turn([SEND, tool('platform_web_search'), { type: 'deliverable-added' }]);
    expect(portraitState(celebrating)).toBe('celebrate');
    // the vendored rest: idle, or listening while an approval card waits
    expect(portraitState(turn([oneShotEnded('celebrate')], celebrating))).toBe('idle');
    const waiting = turn([SEND, { type: 'approval-waiting' }, { type: 'deliverable-added' }]);
    expect(portraitState(turn([oneShotEnded('celebrate')], waiting))).toBe('listening');
  });

  it('ignores a stale end (another state now shows)', () => {
    const thinking = turn([SEND]);
    expect(portraitState(turn([oneShotEnded('celebrate')], thinking))).toBe('thinking');
  });
});
