// One read of the workspace's themes, decided (D-PHONE-CHOICE, D58). Pure: ThemeSync reads
// /active and the offered installs (api.ts, installed.ts) and applies the plan to the style store.
//
//   followed  what 'Same as Studio' paints now (follow.ts followStudio)
//   choice    the phone's own, except a theme picked on the phone that is gone: Studio
//   themes    the picker's rows under Studio, with each install's painting
//   paint     the painting of the install now painted; while a built-in style is painted, the one
//             held is kept when its install is still offered (the next launch's first frame of
//             that theme needs no read) and dropped when it is not (uninstalled, withdrawn)
//   lost      the theme on screen is gone: the toast says the phone is back on Studio

import { paintedChoice, type PhoneChoice, type StyleChoice } from '../registry/style-id';
import { choiceAfterLoss, followStudio, paintedInstall, themeGone } from './follow';
import { offeredPaint, type OfferedTheme } from './installed';
import type { Active, MobileTheme } from './schemas';
import type { ThemePaint } from './types';

/** The style store's part a read changes, as it was before the read. */
export type ThemeSnapshot = {
  readonly choice: PhoneChoice;
  readonly followed: StyleChoice;
  readonly paint: ThemePaint | null;
};

export type ThemeRead = {
  readonly active: Active;
  readonly offered: readonly OfferedTheme[];
};

export type ThemePlan = {
  readonly choice: PhoneChoice;
  readonly followed: StyleChoice;
  readonly themes: readonly OfferedTheme[];
  readonly paint: ThemePaint | null;
  readonly lost: boolean;
};

function offeredAnswer(installId: string, themes: readonly OfferedTheme[]): MobileTheme | null {
  return themes.find((theme) => theme.installId === installId)?.answer ?? null;
}

/** The theme on screen before the read: the one chosen or followed, when its painting was held. */
function shownInstall(snapshot: ThemeSnapshot): string | null {
  const install = paintedInstall(snapshot.choice, snapshot.followed);
  return install !== null && snapshot.paint?.installId === install ? install : null;
}

export function planRead(snapshot: ThemeSnapshot, read: ThemeRead): ThemePlan {
  const activeInstall = read.active.theme?.installId ?? null;
  const answer = activeInstall === null ? null : offeredAnswer(activeInstall, read.offered);
  const followed = followStudio(read.active, answer);
  const gone = themeGone({
    choice: snapshot.choice,
    before: paintedInstall(snapshot.choice, snapshot.followed),
    active: read.active,
    offered: read.offered.map((theme) => theme.installId),
  });
  const choice = gone ? choiceAfterLoss(snapshot.choice) : snapshot.choice;
  const held = snapshot.paint ? offeredPaint(snapshot.paint.installId, read.offered) : null;
  const kept = held ? snapshot.paint : null;
  return Object.freeze({
    choice,
    followed,
    themes: read.offered,
    paint: offeredPaint(paintedInstall(choice, followed), read.offered) ?? kept,
    lost: gone && shownInstall(snapshot) !== null,
  });
}

/** The style painted before and after the plan: a change is crossfaded as a flip is. */
export function paintedChange(
  snapshot: ThemeSnapshot,
  plan: ThemePlan,
): { readonly from: StyleChoice; readonly to: StyleChoice } {
  return {
    from: paintedChoice(snapshot.choice, snapshot.followed),
    to: paintedChoice(plan.choice, plan.followed),
  };
}

/** The painting a newly chosen style needs from the last read, or null when none is needed. */
export function paintForChoice(
  choice: PhoneChoice,
  followed: StyleChoice,
  themes: readonly OfferedTheme[],
): ThemePaint | null {
  return offeredPaint(paintedInstall(choice, followed), themes);
}
