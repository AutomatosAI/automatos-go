// What the edge screens paint with (US-017f), pure: the resolved style's colours under the names
// the screens use, and tokens/edge-colours.ts's derived ones for its ground. Play reads its look's
// variables (Ember's cream, text-2 and text-3, the accent and error text), HUD its README's (text,
// text2, the accent, the error), Arcade its palette's (US-022i: the window its ground, tx and tx2,
// the accent, HP red for the snag; tokens/edge-colours.ts arcadeEdgeSource), Candy its palette's
// (US-023l: the window its ground, the text and the quiet text, the accent as text, Candy's red for
// the snag; candyEdgeSource), Studio the Studio-keyed set (an installed theme's too). Built once
// per resolved style object.

import type { ResolvedStyle } from '../provider/resolve';
import type { ArcadeVars } from '../tokens/arcade';
import type { CandyVars } from '../tokens/candy';
import {
  arcadeEdgeSource,
  candyEdgeSource,
  edgeColours,
  type EdgeColourSource,
  type EdgeColours,
} from '../tokens/edge-colours';
import { oncePerObject } from '../tokens/style-tokens';
import type { Colours } from '../tokens/types';

export type EdgePaint = EdgeColours & {
  readonly text: string;
  readonly text2: string;
  readonly text3: string;
  /** The accent as text: Play's 'Play' and its greeting's second line, HUD's '//', 'ARCADE', 'Candy'. */
  readonly accentText: string;
  /** The snag card's title: Play's error text, HUD's error, Arcade's HP red, Candy's red, Studio's ink. */
  readonly snagTitle: string;
};

type Picked = Omit<EdgePaint, keyof EdgeColours> & { readonly source: EdgeColourSource };

type PaintSource = Pick<
  ResolvedStyle,
  'layout' | 'tone' | 'tokens' | 'play' | 'hud' | 'arcade' | 'candy'
>;

/** Arcade: the window its ground (its words sit in one), the accent, HP red for the snag. */
function fromArcade(arcade: ArcadeVars): Picked {
  return {
    source: arcadeEdgeSource(arcade),
    text: arcade.tx,
    text2: arcade.tx2,
    text3: arcade.tx2,
    accentText: arcade.ac,
    snagTitle: arcade.hp,
  };
}

/** Candy: the window its ground (its words sit in one), the quiet text, the accent as text, its red. */
function fromCandy(candy: CandyVars, colours: Colours): Picked {
  return {
    source: candyEdgeSource(candy, colours),
    text: candy.text,
    text2: candy.quiet,
    text3: candy.quiet,
    accentText: candy.accentText,
    snagTitle: colours.destructive,
  };
}

/** Studio and an installed theme: the Studio-keyed set. */
function fromStudio(colours: Colours): Picked {
  return {
    source: {
      ground: colours.background,
      text: colours.foreground,
      surface: colours.muted,
      error: colours.destructive,
      shade: false,
    },
    text: colours.foreground,
    text2: colours.mutedForeground,
    text3: colours.fg3,
    accentText: colours.accent,
    snagTitle: colours.foreground,
  };
}

function pick(style: PaintSource): Picked {
  const { colours } = style.tokens;
  const { play, hud, arcade, candy } = style;
  if (style.layout === 'play' && play) {
    const source = {
      ground: play.groundBg,
      text: play.groundText,
      surface: play.groundSurface,
      error: play.error,
      shade: style.tone === 'dark',
    };
    return {
      source,
      text: play.groundText,
      text2: play.groundText2,
      text3: colours.fg3,
      accentText: play.accentText,
      snagTitle: play.errorText,
    };
  }
  if (style.layout === 'hud' && hud) {
    const source = { ground: hud.bg, text: hud.text, surface: hud.panelFill, error: hud.error };
    return {
      source: { ...source, shade: true },
      text: hud.text,
      text2: hud.text2,
      text3: hud.text2,
      accentText: hud.accent,
      snagTitle: hud.error,
    };
  }
  if (style.layout === 'arcade' && arcade) return fromArcade(arcade);
  if (style.layout === 'candy' && candy) return fromCandy(candy, colours);
  return fromStudio(colours);
}

function build(style: PaintSource): EdgePaint {
  const { source, ...picked } = pick(style);
  return Object.freeze({ ...picked, ...edgeColours(source) });
}

/** The edge screens' paint for a resolved style, once per style object. */
export const edgePaint: (style: PaintSource) => EdgePaint = oncePerObject(build);
