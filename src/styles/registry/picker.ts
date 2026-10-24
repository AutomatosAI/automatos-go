// The Style and look screen's state (FR-7, D54, D58): three sections in the registry's order —
// Studio with Light / Dark / System and, when the server offers mobile themes, its installed theme
// rows; Play with 'Make it yours'; HUD with 'Looks'. Pure: the screen (US-016h) renders it and
// sends the reducer its taps. The selection shown is what the app paints (resolveChoice): a theme
// the workspace no longer offers shows Studio selected. Every state is new; no input is mutated.

import type { ThemeChoice } from '../theme-choice';
import { PICKER_COPY } from '../strings';
import { resolveChoice } from './choice';
import { STYLE_REGISTRY, type LookPage, type StyleEntry } from './registry';
import {
  builtinChoice,
  sameChoice,
  themeChoice,
  type BuiltInStyleId,
  type StyleChoice,
} from './style-id';

/** An installed theme with a mobile block, as US-016i lists it (sorted by name). */
export type PickerTheme = {
  readonly installId: string;
  readonly name: string;
  readonly version: string;
};

export type SchemeOption = {
  readonly value: ThemeChoice;
  readonly label: string;
  readonly selected: boolean;
};

export type PickerThemeRow = {
  readonly installId: string;
  readonly choice: StyleChoice;
  readonly title: string;
  readonly selected: boolean;
  readonly accessibilityLabel: string;
};

export type PickerSection = {
  readonly id: BuiltInStyleId;
  readonly name: string;
  readonly tagline: string;
  readonly choice: StyleChoice;
  readonly lookPage: LookPage;
  readonly selected: boolean;
  readonly accessibilityLabel: string;
  /** Studio only: Light / Dark / System (the foundation's scheme); empty for Play and HUD. */
  readonly schemes: readonly SchemeOption[];
  /** Play's 'Make it yours', HUD's 'Looks'; null for Studio, whose look is the scheme. */
  readonly lookLink: string | null;
  /** Studio only, when the server offers mobile themes; empty otherwise. */
  readonly themes: readonly PickerThemeRow[];
};

export type PickerInput = {
  readonly choice: StyleChoice;
  readonly studioScheme: ThemeChoice;
  readonly installedThemes: readonly PickerTheme[];
  readonly canMobileTheme: boolean;
};

export type PickerState = PickerInput & { readonly sections: readonly PickerSection[] };

export type PickerAction =
  | { readonly type: 'select'; readonly choice: StyleChoice }
  | { readonly type: 'scheme'; readonly scheme: ThemeChoice }
  | {
      readonly type: 'themesLoaded';
      readonly themes: readonly PickerTheme[];
      /** The discovery document's mobile_theme, when it came with the list; kept when omitted. */
      readonly canMobileTheme?: boolean;
    };

/** Light / Dark / System, in the order the design lists them (D-LOOK-PAGES). */
const SCHEME_ORDER: readonly ThemeChoice[] = Object.freeze(['light', 'dark', 'system']);

function schemeOptions(scheme: ThemeChoice): readonly SchemeOption[] {
  return Object.freeze(
    SCHEME_ORDER.map((value) =>
      Object.freeze({ value, label: PICKER_COPY.schemes[value], selected: value === scheme }),
    ),
  );
}

/** One row per install id, in the order given. */
function uniqueThemes(themes: readonly PickerTheme[]): readonly PickerTheme[] {
  return themes.filter(
    (theme, index) => themes.findIndex((other) => other.installId === theme.installId) === index,
  );
}

function themeRow(theme: PickerTheme, shown: StyleChoice): PickerThemeRow {
  const choice = themeChoice(theme.installId);
  const selected = sameChoice(choice, shown);
  return Object.freeze({
    installId: theme.installId,
    choice,
    title: PICKER_COPY.themeTitle(theme.name, theme.version),
    selected,
    accessibilityLabel: PICKER_COPY.themeLabel(theme.name, theme.version, selected),
  });
}

function lookLinkOf(page: LookPage): string | null {
  if (page === 'play') return PICKER_COPY.lookLinks.play;
  if (page === 'hud') return PICKER_COPY.lookLinks.hud;
  return null;
}

function section(
  style: StyleEntry,
  input: PickerInput,
  shown: StyleChoice,
  themes: readonly PickerTheme[],
): PickerSection {
  const choice = builtinChoice(style.id);
  const selected = sameChoice(choice, shown);
  const isStudio = style.lookPage === 'scheme';
  return Object.freeze({
    id: style.id,
    name: style.name,
    tagline: style.tagline,
    choice,
    lookPage: style.lookPage,
    selected,
    accessibilityLabel: PICKER_COPY.styleLabel(style.name, selected),
    schemes: isStudio ? schemeOptions(input.studioScheme) : Object.freeze([]),
    lookLink: lookLinkOf(style.lookPage),
    themes: Object.freeze(isStudio ? themes.map((theme) => themeRow(theme, shown)) : []),
  });
}

export function pickerState(input: PickerInput): PickerState {
  const installedThemes = Object.freeze(uniqueThemes(input.installedThemes));
  const offered = input.canMobileTheme ? installedThemes : [];
  const shown = resolveChoice(
    input.choice,
    offered.map((theme) => theme.installId),
  );
  return Object.freeze({
    choice: input.choice,
    studioScheme: input.studioScheme,
    installedThemes,
    canMobileTheme: input.canMobileTheme,
    sections: Object.freeze(STYLE_REGISTRY.map((style) => section(style, input, shown, offered))),
  });
}

function inputOf(state: PickerState): PickerInput {
  return {
    choice: state.choice,
    studioScheme: state.studioScheme,
    installedThemes: state.installedThemes,
    canMobileTheme: state.canMobileTheme,
  };
}

export function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case 'select':
      if (sameChoice(state.choice, action.choice)) return state;
      return pickerState({ ...inputOf(state), choice: action.choice });
    case 'scheme':
      if (state.studioScheme === action.scheme) return state;
      return pickerState({ ...inputOf(state), studioScheme: action.scheme });
    case 'themesLoaded':
      return pickerState({
        ...inputOf(state),
        installedThemes: action.themes,
        canMobileTheme: action.canMobileTheme ?? state.canMobileTheme,
      });
  }
}
