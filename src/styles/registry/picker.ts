// The Style and look screen's state (FR-7, D54, D58): five sections in the registry's order —
// Studio with Light / Dark / System, the 'Same as Studio' row (D-PHONE-CHOICE, the default) and,
// when the server offers mobile themes, its installed theme rows; Play with 'Make it yours'; HUD
// with 'Looks'; Arcade with 'Options'; Candy with 'Make it sweet'. Pure: the screen (US-016h)
// renders it and sends the reducer its taps. The selection shown is what the phone chose: 'Same as Studio' selects its row alone
// (its summary says what it paints now); a style or theme picked on the phone selects that card or
// row, and a theme the workspace no longer offers shows Studio selected (resolveChoice). Every
// state is new; no input is mutated.

import type { ThemeChoice } from '../theme-choice';
import { PICKER_COPY } from '../strings';
import { resolveChoice } from './choice';
import {
  DEFAULT_CHOICE,
  STYLE_REGISTRY,
  styleEntry,
  type LookPage,
  type StyleEntry,
} from './registry';
import {
  FOLLOW_STUDIO,
  builtinChoice,
  isFollowStudio,
  sameChoice,
  samePhoneChoice,
  themeChoice,
  type BuiltInStyleId,
  type FollowStudio,
  type PhoneChoice,
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

/** 'Same as Studio': the first row under Studio, with what it paints now. */
export type PickerFollowRow = {
  readonly choice: FollowStudio;
  readonly title: string;
  readonly summary: string;
  readonly selected: boolean;
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string;
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
  /**
   * Play's 'Make it yours', HUD's 'Looks', Arcade's 'Options', Candy's 'Make it sweet'; null for
   * Studio (its scheme).
   */
  readonly lookLink: string | null;
  /** Studio only, when the server offers mobile themes; empty otherwise. */
  readonly themes: readonly PickerThemeRow[];
  /** Studio only: 'Same as Studio'; null for Play and HUD. */
  readonly follow: PickerFollowRow | null;
};

export type PickerInput = {
  /** The phone's choice: a style or theme picked on the phone, or 'Same as Studio'. */
  readonly choice: PhoneChoice;
  readonly studioScheme: ThemeChoice;
  readonly installedThemes: readonly PickerTheme[];
  readonly canMobileTheme: boolean;
  /** What 'Same as Studio' paints now (themes/follow.ts); Studio when omitted. */
  readonly followed?: StyleChoice;
};

export type PickerState = PickerInput & { readonly sections: readonly PickerSection[] };

export type PickerAction =
  | { readonly type: 'select'; readonly choice: PhoneChoice }
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

function themeRow(theme: PickerTheme, shown: StyleChoice | null): PickerThemeRow {
  const choice = themeChoice(theme.installId);
  const selected = shown !== null && sameChoice(choice, shown);
  return Object.freeze({
    installId: theme.installId,
    choice,
    title: PICKER_COPY.themeTitle(theme.name, theme.version),
    selected,
    accessibilityLabel: PICKER_COPY.themeLabel(theme.name, theme.version, selected),
  });
}

/** The name of what 'Same as Studio' paints: a style's name, or a listed theme's title. */
function followedName(followed: StyleChoice, themes: readonly PickerTheme[]): string {
  if (followed.kind === 'builtin') return styleEntry(followed.id).name;
  const theme = themes.find((listed) => listed.installId === followed.installId);
  return theme ? PICKER_COPY.themeTitle(theme.name, theme.version) : PICKER_COPY.follow.theme;
}

function followRow(input: PickerInput, themes: readonly PickerTheme[]): PickerFollowRow {
  const selected = isFollowStudio(input.choice);
  const painted = followedName(input.followed ?? DEFAULT_CHOICE, themes);
  const copy = PICKER_COPY.follow;
  return Object.freeze({
    choice: FOLLOW_STUDIO,
    title: copy.title,
    summary: copy.summary(painted),
    selected,
    accessibilityLabel: copy.label(painted, selected),
    accessibilityHint: copy.hint,
  });
}

function lookLinkOf(page: LookPage): string | null {
  if (page === 'play') return PICKER_COPY.lookLinks.play;
  if (page === 'hud') return PICKER_COPY.lookLinks.hud;
  if (page === 'arcade') return PICKER_COPY.lookLinks.arcade;
  if (page === 'candy') return PICKER_COPY.lookLinks.candy;
  return null;
}

function section(
  style: StyleEntry,
  input: PickerInput,
  shown: StyleChoice | null,
  themes: readonly PickerTheme[],
): PickerSection {
  const choice = builtinChoice(style.id);
  const selected = shown !== null && sameChoice(choice, shown);
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
    follow: isStudio ? followRow(input, themes) : null,
  });
}

/** The card or row the phone's own choice selects; null while it follows Studio. */
function shownChoice(choice: PhoneChoice, offered: readonly PickerTheme[]): StyleChoice | null {
  if (isFollowStudio(choice)) return null;
  return resolveChoice(
    choice,
    offered.map((theme) => theme.installId),
  );
}

export function pickerState(input: PickerInput): PickerState {
  const installedThemes = Object.freeze(uniqueThemes(input.installedThemes));
  const offered = input.canMobileTheme ? installedThemes : [];
  const shown = shownChoice(input.choice, offered);
  return Object.freeze({
    choice: input.choice,
    studioScheme: input.studioScheme,
    installedThemes,
    canMobileTheme: input.canMobileTheme,
    followed: input.followed ?? DEFAULT_CHOICE,
    sections: Object.freeze(STYLE_REGISTRY.map((style) => section(style, input, shown, offered))),
  });
}

function inputOf(state: PickerState): PickerInput {
  return {
    choice: state.choice,
    studioScheme: state.studioScheme,
    installedThemes: state.installedThemes,
    canMobileTheme: state.canMobileTheme,
    followed: state.followed,
  };
}

export function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case 'select':
      if (samePhoneChoice(state.choice, action.choice)) return state;
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
