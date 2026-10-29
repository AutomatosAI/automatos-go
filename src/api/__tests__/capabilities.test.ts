import { describe, expect, it } from 'vitest';

import {
  canBrief,
  canDigest,
  canDigestNow,
  canMobileTheme,
  canPush,
  canReportContent,
  canServerVoice,
  canSpokenMode,
  canSuggestions,
  canVoiceLive,
  type GateInput,
} from '../capabilities';
import { CAPABILITIES, hostedDefaults, type Capability } from '../discovery';
import { SERVER } from './fake-transport';

function withCapabilities(capabilities: readonly Capability[], expo = true): GateInput {
  return { capabilities, push: { expo } };
}

const GATES: readonly [Capability, (discovery: GateInput) => boolean][] = [
  ['push', canPush],
  ['spoken_mode', canSpokenMode],
  ['voice_live', canVoiceLive],
  ['mobile_theme', canMobileTheme],
  ['report_content', canReportContent],
  ['digest', canDigest],
  ['tts', canServerVoice],
  ['digest_now', canDigestNow],
  ['brief', canBrief],
  ['suggestions', canSuggestions],
];

describe('capability gates', () => {
  it.each(GATES)('%s: open when listed', (capability, gate) => {
    expect(gate(withCapabilities([capability]))).toBe(true);
  });

  it.each(GATES)('%s: closed when absent', (capability, gate) => {
    const others = CAPABILITIES.filter((other) => other !== capability);
    expect(gate(withCapabilities(others))).toBe(false);
  });

  it.each(GATES)('%s: closed before discovery has loaded', (_capability, gate) => {
    expect(gate(undefined)).toBe(false);
    expect(gate(null)).toBe(false);
  });

  it.each(GATES)('%s: closed on the hosted defaults (K3)', (_capability, gate) => {
    expect(gate(hostedDefaults(SERVER))).toBe(false);
  });

  it('push also needs the server to send through Expo', () => {
    expect(canPush(withCapabilities(['push'], false))).toBe(false);
    expect(canPush(withCapabilities(['push'], true))).toBe(true);
  });

  it('every capability has exactly one gate', () => {
    expect(GATES.map(([capability]) => capability)).toEqual([...CAPABILITIES]);
  });
});
