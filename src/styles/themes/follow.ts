// 'Same as Studio' (D-PHONE-CHOICE, D58, Gerard 24 Oct): the phone follows the theme Studio shows
// this member (GET /api/themes/active) until a style is picked on the phone. Pure.
//
//   active.theme is Play's, HUD's or Arcade's  → the phone's built-in style of that id: installing
//   web theme                                    Play, HUD or Arcade in Studio flips the phone's layout
//   any other theme with a phone painting      → that theme over the Studio layout (D-THEMES)
//   'studio' / 'classic', no theme, a revoked
//   theme or no painting                       → Studio
//
// Play then paints the member's Play look (the looks API, US-017d) and HUD the phone's own HUD
// look (US-018a). A theme the phone chose or followed that is gone (uninstalled, withdrawn, no
// longer offered) is back on Studio (themeGone), with one toast when it was on screen (plan.ts).

import {
  builtinChoice,
  isFollowStudio,
  themeChoice,
  type BuiltInStyleId,
  type PhoneChoice,
  type StyleChoice,
} from '../registry/style-id';
import { DEFAULT_CHOICE } from '../registry/registry';
import type { Active, MobileTheme } from './schemas';

/** The web themes that ARE a built-in phone style: the phone paints its own Play, HUD or Arcade. */
export const BUILT_IN_THEME_STYLES: Readonly<Record<string, BuiltInStyleId>> = Object.freeze({
  'automatos/play': 'play',
  'automatos/hud': 'hud',
  'automatos/arcade': 'arcade',
});

export function builtInStyleOf(themeId: string): BuiltInStyleId | null {
  return Object.prototype.hasOwnProperty.call(BUILT_IN_THEME_STYLES, themeId)
    ? BUILT_IN_THEME_STYLES[themeId]
    : null;
}

/** A phone painting for this install: the answer is that install's and carries a mobile block. */
function paints(installId: string, answer: MobileTheme | null): boolean {
  return answer !== null && answer.installId === installId && answer.mobile !== null;
}

/** The style 'Same as Studio' paints for this /active answer and the active theme's phone answer. */
export function followStudio(active: Active, mobileAnswer: MobileTheme | null): StyleChoice {
  const { theme } = active;
  if (active.revoked || !theme || theme.revoked?.level === 'disable') return DEFAULT_CHOICE;
  const builtIn = builtInStyleOf(theme.themeId);
  if (builtIn) return builtinChoice(builtIn);
  return paints(theme.installId, mobileAnswer) ? themeChoice(theme.installId) : DEFAULT_CHOICE;
}

/** The install a phone painting is needed for, or null when a built-in style is painted. */
export function paintedInstall(choice: PhoneChoice, followed: StyleChoice): string | null {
  const painted = isFollowStudio(choice) ? followed : choice;
  return painted.kind === 'theme' ? painted.installId : null;
}

export type ThemeGoneInput = {
  /** The phone's stored choice. */
  readonly choice: PhoneChoice;
  /** The install the phone chose or followed before this read, or null for a built-in style. */
  readonly before: string | null;
  readonly active: Active;
  /** The installs the phone may paint now (installed.ts), by id. */
  readonly offered: readonly string[];
};

/**
 * true when the theme the phone chose or followed before this read is gone, so the phone is back
 * on Studio: a theme picked on the phone that is no longer offered; a followed one that Studio
 * still names but the phone can no longer paint, or that /active reports withdrawn. Studio
 * switching to another style or theme is an ordinary follow, never a loss.
 */
export function themeGone({ choice, before, active, offered }: ThemeGoneInput): boolean {
  if (before === null) return false;
  if (!isFollowStudio(choice)) return choice.kind === 'theme' && !offered.includes(before);
  if (active.revoked?.installId === before) return true;
  return active.theme?.installId === before && !offered.includes(before);
}

/** A theme picked on the phone that is gone becomes Studio; 'Same as Studio' stays as it is. */
export function choiceAfterLoss(choice: PhoneChoice): PhoneChoice {
  return isFollowStudio(choice) ? choice : DEFAULT_CHOICE;
}
