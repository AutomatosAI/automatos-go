// How "Pause suggestions" is wired (PRD-268 §6.9), read from the source (nothing renders in node):
// Settings places the switch after Voice and before What Auto depends on; the section draws
// nothing and reads nothing where discovery does not list `suggestions`; the switch is named for
// VoiceOver and shows its failure as a line; and the home's open list shares the pause, is not
// read while paused, and shows none.

import { describe, expect, it } from 'vitest';

import { canSuggestions } from '../../api/capabilities';
import { CAPABILITIES, hostedDefaults } from '../../api/discovery';
import { SERVER } from '../../api/__tests__/fake-transport';
import { readRepoFile } from '../../release/__tests__/support/tree';

const section = readRepoFile('src/suggestions/PauseSection.tsx');
const hook = readRepoFile('src/suggestions/use-pause.ts');

describe('Settings', () => {
  const settings = readRepoFile('app/(app)/settings/index.tsx');

  it('places the switch after Voice and before What Auto depends on', () => {
    const voice = settings.indexOf('VOICE_SCREENS.settings');
    const pause = settings.indexOf('<PauseSection />');
    const readiness = settings.indexOf('<ReadinessSection />');
    expect(voice).toBeGreaterThan(-1);
    expect(pause).toBeGreaterThan(voice);
    expect(readiness).toBeGreaterThan(pause);
  });
});

describe('the capability', () => {
  it('is hidden without `suggestions`: an older server shows Settings unchanged', () => {
    expect(section).toContain('if (!pause.shown) return null;');
    expect(hook).toContain('const shown = canSuggestions(discovery);');
    expect(hook).toContain('useMyProactive(shown)');
    expect(hook).toMatch(/fetchMyProactive\(client, signal\),\n\s+enabled,\n/);
  });

  it('is closed before discovery loads and where the server does not list it', () => {
    const others = CAPABILITIES.filter((capability) => capability !== 'suggestions');
    expect(canSuggestions(null)).toBe(false);
    expect(canSuggestions(hostedDefaults(SERVER))).toBe(false);
    expect(canSuggestions({ capabilities: others, push: { expo: true } })).toBe(false);
    expect(canSuggestions({ capabilities: ['suggestions'], push: { expo: true } })).toBe(true);
  });
});

describe('the switch', () => {
  it('is the Settings switch row, named "Pause suggestions" with its line as the hint', () => {
    expect(section).toContain("import { SwitchRow } from '../push/settings/components/Switch';");
    expect(section).toMatch(/title=\{PAUSE_COPY\.title\}\s+detail=\{PAUSE_COPY\.detail\}/);
  });

  it('shows a failure as a line under it, announced, never thrown', () => {
    expect(section).toMatch(/\{view\.line \? \(/);
    expect(section).toContain('accessibilityLiveRegion="polite"');
    expect(hook).toContain('announce(pauseFailureLine(next));');
  });
});

describe('the home', () => {
  const open = readRepoFile('src/suggestions/use-suggestions.ts');

  it('shares the pause, reads no list until it is read or while paused, and shows none', () => {
    expect(open).toContain('const paused = useSuggestionsPaused(offered);');
    expect(open).toContain('enabled: offered && paused === false,');
    expect(open).toContain('shownSuggestions({ offered, paused, list: data, now: Date.now() })');
  });

  it("reads the pause again on the open list's cadence, so a change elsewhere arrives", () => {
    expect(hook).toContain('useMyProactive(offered, NEEDS_YOU_REFETCH_INTERVAL_MS)');
    expect(hook).toMatch(/\n\s+refetchInterval,\n/);
  });
});
