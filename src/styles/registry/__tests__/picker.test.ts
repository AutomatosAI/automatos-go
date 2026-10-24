import { describe, expect, it } from 'vitest';

import { PICKER_COPY } from '../../strings';
import {
  pickerReducer,
  pickerState,
  type PickerInput,
  type PickerState,
  type PickerTheme,
} from '../picker';
import { builtinChoice, themeChoice } from '../style-id';

const HARBOUR: PickerTheme = { installId: 'inst-harbour', name: 'Harbour', version: '1.1.0' };
const MOSS: PickerTheme = { installId: 'inst-moss', name: 'Moss', version: '2.0.3' };

function input(overrides: Partial<PickerInput> = {}): PickerInput {
  return {
    choice: builtinChoice('studio'),
    studioScheme: 'system',
    installedThemes: [HARBOUR, MOSS],
    canMobileTheme: true,
    ...overrides,
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function frozenState(overrides: Partial<PickerInput> = {}): PickerState {
  const state = pickerState(input(overrides));
  return deepFreeze(JSON.parse(JSON.stringify(state)) as PickerState);
}

function selectedIds(state: PickerState) {
  return {
    sections: state.sections.filter((s) => s.selected).map((s) => s.id),
    themes: state.sections
      .flatMap((s) => s.themes)
      .filter((t) => t.selected)
      .map((t) => t.installId),
  };
}

describe('the picker sections', () => {
  it('has Studio, Play and HUD in order, each with its look page and link', () => {
    const { sections } = pickerState(input());
    expect(
      sections.map(({ id, name, lookPage, lookLink }) => ({ id, name, lookPage, lookLink })),
    ).toEqual([
      { id: 'studio', name: 'Studio', lookPage: 'scheme', lookLink: null },
      { id: 'play', name: 'Play', lookPage: 'play', lookLink: 'Make it yours' },
      { id: 'hud', name: 'HUD', lookPage: 'hud', lookLink: 'Looks' },
    ]);
    expect(sections.map((s) => s.choice)).toEqual([
      builtinChoice('studio'),
      builtinChoice('play'),
      builtinChoice('hud'),
    ]);
  });

  it('gives Studio Light / Dark / System with the foundation scheme selected', () => {
    const [studio, play, hud] = pickerState(input({ studioScheme: 'dark' })).sections;
    expect(studio.schemes).toEqual([
      { value: 'light', label: 'Light', selected: false },
      { value: 'dark', label: 'Dark', selected: true },
      { value: 'system', label: 'System', selected: false },
    ]);
    expect(play.schemes).toEqual([]);
    expect(hud.schemes).toEqual([]);
  });

  it('lists the installed themes under Studio when the server offers mobile themes', () => {
    const [studio, play, hud] = pickerState(input()).sections;
    expect(
      studio.themes.map(({ installId, title, choice }) => ({ installId, title, choice })),
    ).toEqual([
      { installId: 'inst-harbour', title: 'Harbour · 1.1.0', choice: themeChoice('inst-harbour') },
      { installId: 'inst-moss', title: 'Moss · 2.0.3', choice: themeChoice('inst-moss') },
    ]);
    expect(play.themes).toEqual([]);
    expect(hud.themes).toEqual([]);
  });

  it('lists no themes without canMobileTheme (D-CAPABILITIES)', () => {
    const [studio] = pickerState(input({ canMobileTheme: false })).sections;
    expect(studio.themes).toEqual([]);
  });

  it('lists an install once', () => {
    const [studio] = pickerState(input({ installedThemes: [HARBOUR, MOSS, HARBOUR] })).sections;
    expect(studio.themes.map((t) => t.installId)).toEqual(['inst-harbour', 'inst-moss']);
  });

  it('selects exactly the chosen style or theme', () => {
    expect(selectedIds(pickerState(input()))).toEqual({ sections: ['studio'], themes: [] });
    expect(selectedIds(pickerState(input({ choice: builtinChoice('hud') })))).toEqual({
      sections: ['hud'],
      themes: [],
    });
    expect(selectedIds(pickerState(input({ choice: themeChoice('inst-moss') })))).toEqual({
      sections: [],
      themes: ['inst-moss'],
    });
  });

  it('shows Studio selected for a theme no longer offered, keeping the stored choice', () => {
    const gone = pickerState(input({ choice: themeChoice('inst-gone') }));
    expect(selectedIds(gone)).toEqual({ sections: ['studio'], themes: [] });
    expect(gone.choice).toEqual(themeChoice('inst-gone'));
    const noCapability = pickerState(
      input({ choice: themeChoice('inst-moss'), canMobileTheme: false }),
    );
    expect(selectedIds(noCapability)).toEqual({ sections: ['studio'], themes: [] });
  });
});

describe('the label words (never colour alone)', () => {
  it('names each style card and says which one is selected', () => {
    const labels = pickerState(input({ choice: builtinChoice('play') })).sections.map(
      (s) => s.accessibilityLabel,
    );
    expect(labels).toEqual(['Studio style', 'Play style, selected', 'HUD style']);
    expect(pickerState(input()).sections[0].accessibilityLabel).toBe('Studio style, selected');
  });

  it('names each theme row with its version and its selected state', () => {
    const [studio] = pickerState(input({ choice: themeChoice('inst-harbour') })).sections;
    expect(studio.themes.map((t) => t.accessibilityLabel)).toEqual([
      'Harbour theme, version 1.1.0, selected',
      'Moss theme, version 2.0.3',
    ]);
  });

  it('carries the taglines and the Selected word', () => {
    expect(pickerState(input()).sections.map((s) => s.tagline)).toEqual([
      'Cream paper or Studio Dark',
      'Auto and the Ember look',
      'Voice first, glow and grid',
    ]);
    expect(PICKER_COPY.selected).toBe('Selected');
    expect(PICKER_COPY.schemeGroup).toBe('Studio appearance');
  });
});

describe('pickerReducer on a deep-frozen state', () => {
  it('selects a style without touching the state it was given', () => {
    const state = frozenState();
    const snapshot = JSON.stringify(state);
    const next = pickerReducer(state, { type: 'select', choice: builtinChoice('hud') });
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(next.choice).toEqual(builtinChoice('hud'));
    expect(selectedIds(next)).toEqual({ sections: ['hud'], themes: [] });
  });

  it('selects a theme', () => {
    const next = pickerReducer(frozenState(), { type: 'select', choice: themeChoice('inst-moss') });
    expect(selectedIds(next)).toEqual({ sections: [], themes: ['inst-moss'] });
  });

  it('changes the Studio scheme', () => {
    const state = frozenState();
    const next = pickerReducer(state, { type: 'scheme', scheme: 'light' });
    expect(next.studioScheme).toBe('light');
    expect(next.sections[0].schemes.filter((o) => o.selected).map((o) => o.value)).toEqual([
      'light',
    ]);
    expect(state.studioScheme).toBe('system');
  });

  it('returns the same state when nothing changes', () => {
    const state = frozenState({ choice: builtinChoice('play'), studioScheme: 'dark' });
    expect(pickerReducer(state, { type: 'select', choice: builtinChoice('play') })).toBe(state);
    expect(pickerReducer(state, { type: 'scheme', scheme: 'dark' })).toBe(state);
  });

  it('loads the themes, and with them the capability when it comes along', () => {
    const state = frozenState({
      installedThemes: [],
      canMobileTheme: false,
      choice: themeChoice('inst-moss'),
    });
    expect(selectedIds(state)).toEqual({ sections: ['studio'], themes: [] });
    const listed = pickerReducer(state, {
      type: 'themesLoaded',
      themes: [MOSS],
      canMobileTheme: true,
    });
    expect(listed.sections[0].themes.map((t) => t.title)).toEqual(['Moss · 2.0.3']);
    expect(selectedIds(listed)).toEqual({ sections: [], themes: ['inst-moss'] });
    const kept = pickerReducer(listed, { type: 'themesLoaded', themes: [HARBOUR] });
    expect(kept.canMobileTheme).toBe(true);
    expect(selectedIds(kept)).toEqual({ sections: ['studio'], themes: [] });
    expect(kept.choice).toEqual(themeChoice('inst-moss'));
    expect(state.installedThemes).toEqual([]);
  });

  it('hands back frozen states', () => {
    const next = pickerReducer(frozenState(), { type: 'select', choice: builtinChoice('play') });
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.sections)).toBe(true);
    expect(next.sections.every((s) => Object.isFrozen(s) && Object.isFrozen(s.themes))).toBe(true);
  });
});
