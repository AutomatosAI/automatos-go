// Every word on the phone: a role from the type scale (Title 1–6, Body 1–6, Mono label or figure
// 1–3, Eyebrow) in a tone from the tokens. Dynamic Type stays on (TEXT_SCALING) and nothing in the
// scale is below 11 pt (D38); a weight or italic the app does not bundle falls back to the role's.
// A5: the dress (dressed.ts) gives Play and HUD their own titles (Play's display face only at 19
// and above), eyebrows and labels; Studio and an installed theme are the scale, unchanged.

import { useMemo } from 'react';
import {
  Text as NativeText,
  type StyleProp,
  type TextProps as NativeTextProps,
  type TextStyle,
} from 'react-native';

import type { FontWeight } from '../styles/fonts';
import { useStyle } from '../styles/theme';
import { TEXT_SCALING } from '../styles/type';
import { dressedTextFace } from './dressed';
import {
  TEXT_TONES,
  defaultTone,
  textRole,
  type TextLevel,
  type TextTone,
  type TextVariant,
} from './variants';

export type TextProps = Omit<NativeTextProps, 'style' | 'allowFontScaling'> & {
  readonly variant?: TextVariant;
  readonly level?: TextLevel;
  readonly tone?: TextTone;
  readonly weight?: FontWeight;
  readonly italic?: boolean;
  readonly style?: StyleProp<TextStyle>;
};

export function Text({ variant = 'body', level, tone, weight, italic, style, ...rest }: TextProps) {
  const painted = useStyle();
  const role = textRole(variant, level);
  const face = useMemo(
    () => dressedTextFace(painted, role, { weight, italic }),
    [painted, role, weight, italic],
  );
  const color = painted.tokens.colours[TEXT_TONES[tone ?? defaultTone(variant)]];
  return <NativeText {...rest} {...TEXT_SCALING} style={[face, { color }, style]} />;
}
