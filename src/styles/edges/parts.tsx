// What the edge screens share (US-017f): their paint, the brand line at the top (Play's italic
// 'Automatos Play' with 'Play' in the accent text, all in text2 when the glow is out; HUD's
// 'AUTOMATOS //'; Arcade's 'AUTOMATOS ARCADE' in its label face, wrapping when the phone is too
// narrow for it and the status word; none in Studio), a status word on its right (the dimmed
// light's text twin), the 48 pt full-width action, the bottom row it sits in, Not running's command
// as selectable mono (no clipboard module, KS7) and HUD's bracket panel round a screen's words (an
// Arcade window with Auto's sprite at its head, US-022i; a plain column in Studio and Play).

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MascotName } from '../../core/frozen/lib/mascot/types';
import { Button, Card, Text } from '../../ui';
import type { ButtonVariant } from '../../ui/variants';
import { useStyle } from '../theme';
import { ArcadeEdgeWindow } from './ArcadeEdgeWindow';
import { brandWords } from './edges';
import { EDGE_METRICS } from './metrics';
import { edgePaint, type EdgePaint } from './paint';

const { brand, action, command } = EDGE_METRICS;

export function useEdgePaint(): EdgePaint {
  return edgePaint(useStyle());
}

type BrandProps = {
  /** The state in words on the right: 'Not connected'. */
  readonly status?: string;
  /** The glow is out (Not running): the brand line in text2, no accent. */
  readonly dimmed?: boolean;
};

function BrandWords({ dimmed }: Pick<BrandProps, 'dimmed'>) {
  const style = useStyle();
  const paint = useEdgePaint();
  const face = style.type.display('brand');
  const base = dimmed ? paint.text2 : paint.text;
  const mark = dimmed ? paint.text2 : paint.accentText;
  const words = brandWords(style.layout);
  return (
    <Text style={[face, { color: base }]} accessibilityLabel={words.label}>
      {words.name} <Text style={[face, { color: mark }]}>{words.mark}</Text>
    </Text>
  );
}

/** The line over an edge screen: the brand (Play, HUD, Arcade) and the status word (every style). */
export function EdgeBrand({ status, dimmed = false }: BrandProps) {
  const style = useStyle();
  const paint = useEdgePaint();
  const showsBrand = style.layout !== 'studio';
  const arcade = style.layout === 'arcade';
  // Arcade's words are labels in its pixel face (README 'Type'), too wide to promise one line
  const statusFace = arcade ? style.type.label : style.type.mono(brand.statusSize);
  if (!showsBrand && status === undefined) return null;
  return (
    <View
      style={[
        styles.brand,
        { paddingVertical: brand.padY, paddingHorizontal: EDGE_METRICS.padX },
        arcade ? styles.wraps : null,
      ]}
    >
      {showsBrand ? <BrandWords dimmed={dimmed} /> : <View />}
      {status === undefined ? null : (
        <Text style={[statusFace, { color: paint.text2 }]}>{status}</Text>
      )}
    </View>
  );
}

type ActionProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
};

/** A screen's one action: 48 high, full width. */
export function EdgeAction({ label, onPress, variant = 'primary' }: ActionProps) {
  return (
    <Button label={label} onPress={onPress} variant={variant} fullWidth minHeight={action.height} />
  );
}

/** The bottom row: the action, then whatever follows it (a note, the way out). */
export function EdgeActions({ children }: { readonly children: ReactNode }) {
  return (
    <View
      style={[
        styles.actions,
        {
          gap: action.gap,
          paddingTop: action.padTop,
          paddingHorizontal: action.padX,
          paddingBottom: action.padBottom,
        },
      ]}
    >
      {children}
    </View>
  );
}

type CommandProps = { readonly command: string; readonly label: string };

/** The command that starts a self-hosted server, selectable to copy by hand (KS7). */
export function CommandBox({ command: words, label }: CommandProps) {
  const style = useStyle();
  const paint = useEdgePaint();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.command,
        {
          minHeight: command.minHeight,
          paddingVertical: command.padY,
          paddingHorizontal: command.padX,
          borderRadius: style.radii.input,
          backgroundColor: paint.commandFill,
          borderColor: paint.commandLine,
        },
      ]}
    >
      <Text selectable style={[style.type.mono(command.size, 500), { color: paint.text }]}>
        {words}
      </Text>
    </View>
  );
}

type PanelProps = {
  /** HUD's header line and Arcade's tab: a glyph and a word ('— NOT ANSWERING'). */
  readonly line: string;
  readonly label: string;
  readonly gap: number;
  /** Arcade: Auto's state, his sprite at the window's head (the other styles draw the Mascot). */
  readonly auto: MascotName;
  readonly children: ReactNode;
};

/**
 * HUD: the words in a bracket panel under a glyph-and-word line; Arcade: a window tabbed with the
 * line, Auto's sprite at its head; Studio and Play: a column.
 */
export function EdgePanel({ line, label, gap, auto, children }: PanelProps) {
  const style = useStyle();
  const paint = useEdgePaint();
  if (style.layout === 'arcade') {
    return (
      <ArcadeEdgeWindow state={auto} title={line} titleLabel={label}>
        {children}
      </ArcadeEdgeWindow>
    );
  }
  if (style.layout !== 'hud') return <View style={{ gap }}>{children}</View>;
  return (
    <Card padding="space8" radius="panel">
      <View style={{ gap }}>
        <Text
          accessibilityRole="header"
          accessibilityLabel={label}
          style={[style.type.display('panel'), { color: paint.text2 }]}
        >
          {line}
        </Text>
        {children}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wraps: { flexWrap: 'wrap', gap: EDGE_METRICS.arcade.brandGap },
  actions: { alignItems: 'center' },
  command: { justifyContent: 'center', borderWidth: 1 },
});
