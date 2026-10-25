// A card: --card ground, 1 pt --border, the hairline shadow; 8 pt radius (board and needs cards)
// or 10 (panels). Pressable cards take the hover look while pressed and must say what they open.
// A5: the dress paints it (Play: 14 pt on the surface with the ground's line; HUD: a square panel
// on the panel fill with the panel border and the corner brackets). A selected or live card is
// HUD's 1.5 pt accent line with a soft accent glow (Studio and Play draw it as any card); a header
// is the panel's header row, its label on the left and a value on the right, in the style's
// panel face (Studio's eyebrow, Play's label, HUD's display face tracked .2em). Buttons inside
// know they are in a panel (HUD's are 46 high there).

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brackets } from '../styles/dress/Brackets';
import type { Dress } from '../styles/dress/dress';
import { InPanelContext, useDress } from '../styles/dress/use-dress';
import { useStyle, useTokens } from '../styles/theme';
import type { SpaceName, Tokens } from '../styles/tokens';
import { Text } from './Text';
import { dressedPanelPaint, panelHeaderStyle } from './dressed';

export type CardHeader = { readonly label: string; readonly value?: string };

type CardBase = {
  readonly children: ReactNode;
  readonly padding?: SpaceName;
  readonly radius?: 'card' | 'panel';
  readonly style?: StyleProp<ViewStyle>;
  /** A selected or live card (HUD: the 1.5 pt accent line and a soft glow). */
  readonly selected?: boolean;
  /** The panel's header row: its label, and a value on the right. */
  readonly header?: CardHeader;
};

export type CardProps = CardBase &
  (
    | { readonly onPress?: undefined; readonly accessibilityLabel?: string }
    | {
        readonly onPress: () => void;
        readonly accessibilityLabel: string;
        readonly accessibilityHint?: string;
      }
  );

type FrameInput = {
  readonly padding: SpaceName;
  readonly radius: 'card' | 'panel';
  readonly pressed: boolean;
  readonly selected: boolean;
};

function frame(tokens: Tokens, dress: Dress, input: FrameInput) {
  const tone = dressedPanelPaint(dress, { pressed: input.pressed, selected: input.selected });
  return {
    padding: tokens.spacing[input.padding],
    borderRadius: tokens.radii[input.radius],
    backgroundColor: tone.background,
    borderColor: tone.border,
    borderWidth: tone.borderWidth,
    boxShadow: tone.glow ?? tokens.shadows.hairline,
  };
}

function PanelHeader({ label, value }: CardHeader) {
  const style = useStyle();
  const dress = useDress();
  const face = panelHeaderStyle(style, dress);
  const { spacing } = style.tokens;
  return (
    <View style={[styles.header, { gap: spacing.space3, marginBottom: spacing.space4 }]}>
      <Text tone="muted" accessibilityRole="header" style={[face, styles.headerLabel]}>
        {label}
      </Text>
      {value === undefined ? null : <Text style={face}>{value}</Text>}
    </View>
  );
}

function CardBody({ children, header }: Pick<CardBase, 'children' | 'header'>) {
  const dress = useDress();
  const { bracket } = dress.paints.panel;
  return (
    <InPanelContext.Provider value>
      {bracket ? <Brackets colour={bracket} /> : null}
      {header ? <PanelHeader {...header} /> : null}
      {children}
    </InPanelContext.Provider>
  );
}

export function Card(props: CardProps) {
  const { children, padding = 'space5', radius = 'card', style, selected = false, header } = props;
  const tokens = useTokens();
  const dress = useDress();
  const body = <CardBody header={header}>{children}</CardBody>;
  if (props.onPress === undefined) {
    return (
      <View
        style={[frame(tokens, dress, { padding, radius, pressed: false, selected }), style]}
        accessibilityLabel={props.accessibilityLabel}
      >
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityHint={props.accessibilityHint}
      accessibilityState={selected ? { disabled: false, selected } : { disabled: false }}
      style={({ pressed }) => [frame(tokens, dress, { padding, radius, pressed, selected }), style]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  headerLabel: { flexShrink: 1 },
});
