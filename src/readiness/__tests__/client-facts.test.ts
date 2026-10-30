// Reading this phone's facts (US-G07): through the ports only, read only (the permissions are
// checked for 'live' and 'quick-ask', never asked), each read on its own: one that throws or does
// not answer in time is null and the others still land. The server voice is off without tts, and
// a fresh read happens only on Check again.

import { describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import type { PermissionPurpose } from '../../voice/permissions/permission-flow';
import { readClientFacts } from '../client-facts';
import { ASK, EN_GB, GRANTED, ports } from './fixtures';

describe('readClientFacts', () => {
  it('reads every fact through the ports', async () => {
    const checkPermission = vi.fn(async (_purpose: PermissionPurpose) => GRANTED);
    const recognitionPolicy = vi.fn(ports().recognitionPolicy);
    const facts = await readClientFacts(ports({ checkPermission, recognitionPolicy }));
    expect(facts).toEqual({
      push: { kind: 'on' },
      microphone: GRANTED,
      speech: expect.objectContaining({ verdict: GRANTED, locale: EN_GB }),
      serverVoice: 'speaks',
    });
    expect(checkPermission.mock.calls.map(([purpose]) => purpose).sort()).toEqual([
      'live',
      'quick-ask',
    ]);
    expect(recognitionPolicy).toHaveBeenCalledWith(EN_GB);
    expect(Object.isFrozen(facts)).toBe(true);
  });

  it('a read that throws is null, logged, and the others still land', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const facts = await readClientFacts(
      ports({
        pushStatus: () => {
          throw new Error('keychain');
        },
        recognitionPolicy: async () => {
          throw new Error('module');
        },
      }),
    );
    expect(facts.push).toBeNull();
    expect(facts.speech).toBeNull();
    expect(facts.microphone).toEqual(GRANTED);
    expect(facts.serverVoice).toBe('speaks');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('a read that does not answer in time is null', async () => {
    vi.useFakeTimers();
    try {
      const reading = readClientFacts(
        ports({
          checkPermission: (purpose) =>
            purpose === 'live' ? new Promise(() => {}) : Promise.resolve(ASK),
        }),
        { timeoutMs: 50 },
      );
      await vi.advanceTimersByTimeAsync(50);
      const facts = await reading;
      expect(facts.microphone).toBeNull();
      expect(facts.speech?.verdict).toEqual(ASK);
    } finally {
      vi.useRealTimers();
    }
  });

  it('the server voice: off without tts, unanswered when its list did not load', async () => {
    expect((await readClientFacts(ports({ serverVoices: null }))).serverVoice).toBe('off');
    expect((await readClientFacts(ports({ serverVoices: async () => false }))).serverVoice).toBe(
      'unanswered',
    );
    expect((await readClientFacts(ports({ voiceSource: () => 'phone' }))).serverVoice).toBe(
      'phone_chosen',
    );
  });

  it("reads the server's voices afresh only when asked (Check again)", async () => {
    const serverVoices = vi.fn(async () => true);
    await readClientFacts(ports({ serverVoices }));
    await readClientFacts(ports({ serverVoices }), { fresh: true });
    expect(serverVoices.mock.calls).toEqual([[false], [true]]);
  });
});
