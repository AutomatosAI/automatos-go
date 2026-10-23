// The shape every style's tokens take (D-TOKENS, PRD-001 §4.6). A layout reads a Tokens value
// through useTokens() and never a colour. Studio is built here (FND-1); Play and HUD (wave A5)
// add a StyleId and a tokens file that fills the same shape, so the accessor never changes: the
// colour names are Studio's, because the web already paints every Studio page under a look by
// Studio's token names (PRD-260 D3, core look-kit studio-tokens.ts).

import type { TypeScale } from '../type';
import type { STUDIO_LIGHT_SOURCE } from './studio-source';

export type ColourScheme = 'light' | 'dark';

/** The built-in styles (§4.6). A5 adds 'play' and 'hud'. */
export type StyleId = 'studio';

/** 'muted-foreground' → 'mutedForeground', 'chart-1' → 'chart1'. */
type Camel<S extends string> = S extends `${infer Head}-${infer Tail}`
  ? `${Head}${Capitalize<Camel<Tail>>}`
  : S;

/** A '--' source key as the property a layout reads: '--cc-hover-border' → 'ccHoverBorder'. */
export type TokenName<Key> = Key extends `--${infer Name}` ? Camel<Name> : never;

export type ColourName = TokenName<keyof typeof STUDIO_LIGHT_SOURCE>;

/** Every colour as #RRGGBB, or #RRGGBBAA where the source carries an alpha (accent2). */
export type Colours = Readonly<Record<ColourName, string>>;

export type RadiusName =
  'tag' | 'chip' | 'segment' | 'control' | 'card' | 'panel' | 'pill' | 'sheet' | 'full';
export type Radii = Readonly<Record<RadiusName, number>>;

export type SpaceName = `space${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`;
export type Spacing = Readonly<Record<SpaceName, number>>;

/** One layer of React Native's boxShadow (new architecture), structurally its BoxShadowValue. */
export type ShadowLayer = {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blurRadius: number;
  readonly color: string;
};

export type ShadowName = 'hairline' | 'card' | 'active' | 'toast' | 'dialog';
export type Shadows = Readonly<Record<ShadowName, readonly ShadowLayer[]>>;

/** The chat thread's two boxes and Auto's avatar (D72), resolved opaque as #RRGGBB. */
export type ThreadPaint = {
  /** Auto's box: a Studio card. */
  readonly autoFill: string;
  /** Auto's box's 1 pt edge: the card's border. */
  readonly autoBorder: string;
  /** The user's box: primary at 10 % over the page (the web's bg-primary/10). */
  readonly userFill: string;
  /** The user's box's 1 pt edge: primary at 10 % over its fill (the web's border-primary/10). */
  readonly userBorder: string;
  /** The disc behind Auto's sail. */
  readonly avatar: string;
  /** The sail on the disc: the web's white mark. */
  readonly sail: string;
};

export type Tokens = {
  readonly style: StyleId;
  readonly scheme: ColourScheme;
  readonly colours: Colours;
  readonly radii: Radii;
  readonly spacing: Spacing;
  readonly shadows: Shadows;
  readonly type: TypeScale;
  readonly thread: ThreadPaint;
};
