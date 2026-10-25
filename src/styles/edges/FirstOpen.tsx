// First open (PRD-001 §4.7 Edges, Ember 06, US-017f): the home before the first message, Auto at
// hello. FirstOpenHello is the words; FirstOpen the whole screen with the home's composer under them,
// lifted over the keyboard on iOS as A2's ChatFrame lifts its own. US-016k mounts it.
//
//   Play    the brand line; Auto 170 (right); 'Your Automatos,' / 'the fun way.' (the hero slot,
//           58/0.92, the second line in the accent text); the lede (15/1.5, text2); three starter
//           chips (44 high, round, 1 pt line of the ground's text at 0.2) that fill the composer
//           and never send (KS13); the composer (PlayComposer firstOpen: the accent Send)
//   Studio  the sail mark, 'Talk to Auto' (Newsreader 28) and the same lede; no chips (D29); Auto
//           only when an installed theme brings him
//   HUD     its core with an empty transcript, 'Say or type what you need.' (HudCore, EMPTY_TURN)

import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';

import { BrandMark } from '../../connect/components/BrandMark';
import { Screen, Text } from '../../ui';
import { useDress } from '../dress/use-dress';
import { HudCore, type HudCoreProps } from '../hud/core/HudCore';
import { EMPTY_TURN } from '../hud/core/model';
import { MASCOT_SIZES } from '../mascot/geometry';
import { Mascot } from '../mascot/Mascot';
import { EDGE_COPY } from '../strings';
import { useStyle } from '../theme';
import { STARTERS } from './edges';
import { EDGE_METRICS } from './metrics';
import { EdgeBrand, useEdgePaint } from './parts';

const KEYBOARD_BEHAVIOUR = Platform.OS === 'ios' ? 'padding' : undefined;
const PRESSED_OPACITY = 0.7;
const { starter } = EDGE_METRICS;
const copy = EDGE_COPY.firstOpen;

export type FirstOpenHelloProps = {
  /** A Play starter was tapped: put its words in the composer, never send (KS13). */
  readonly onStarter: (words: string) => void;
};

function Starters({ onStarter }: FirstOpenHelloProps) {
  const style = useStyle();
  const dress = useDress();
  const paint = useEdgePaint();
  const line = dress.paints.pill.rest.border;
  return (
    <View style={[styles.starters, { gap: starter.gap, paddingHorizontal: starter.rowPadX }]}>
      {STARTERS.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => onStarter(item.text)}
          accessibilityRole="button"
          accessibilityLabel={item.text}
          accessibilityHint={item.hint}
          style={({ pressed }) => [
            styles.starter,
            {
              minHeight: starter.height,
              paddingHorizontal: starter.padX,
              borderRadius: style.radii.pill,
              borderColor: line,
              opacity: pressed ? PRESSED_OPACITY : 1,
            },
          ]}
        >
          <Text style={[style.type.body(starter.size), { color: paint.text }]}>{item.text}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Greeting() {
  const style = useStyle();
  const paint = useEdgePaint();
  const hero = style.type.display('hero');
  if (style.layout !== 'play') {
    return (
      <Text accessibilityRole="header" style={[hero, { color: paint.text }]}>
        {copy.studio}
      </Text>
    );
  }
  const [first, second] = copy.play;
  return (
    <Text accessibilityRole="header" style={[hero, { color: paint.text }]}>
      {first}
      {'\n'}
      <Text style={[hero, { color: paint.accentText }]}>{second}</Text>
    </Text>
  );
}

/** The hello: Auto, the greeting, the lede, and Play's starters. */
export function FirstOpenHello({ onStarter }: FirstOpenHelloProps) {
  const style = useStyle();
  const paint = useEdgePaint();
  const play = style.layout === 'play';
  const lede = style.type.body(EDGE_METRICS.ledeSize, 400, { leading: EDGE_METRICS.ledeLeading });
  return (
    <View style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.middle, { gap: EDGE_METRICS.gap }]}
        keyboardShouldPersistTaps="handled"
      >
        {play ? null : <BrandMark height={EDGE_METRICS.brandMark} />}
        <View style={styles.auto}>
          <Mascot size={MASCOT_SIZES.firstOpen} state="hello" />
        </View>
        <Greeting />
        <Text style={[lede, { color: paint.text2 }]}>{copy.lede}</Text>
      </ScrollView>
      {play ? (
        <View style={{ paddingBottom: starter.rowPadBottom }}>
          <Starters onStarter={onStarter} />
        </View>
      ) : null}
    </View>
  );
}

export type FirstOpenProps = FirstOpenHelloProps & {
  /** The home's composer under the hello (Play: PlayComposer with firstOpen; Studio: A2's). */
  readonly composer?: ReactNode;
  /** HUD: its core's props but the turn; HUD's First open is the core, empty. */
  readonly hud?: Omit<HudCoreProps, 'turn'>;
};

export function FirstOpen({ onStarter, composer, hud }: FirstOpenProps) {
  const style = useStyle();
  const { y: stackTop } = useSafeAreaFrame();
  if (style.layout === 'hud') return hud ? <HudCore {...hud} turn={EMPTY_TURN} /> : null;
  const { composer: pad } = EDGE_METRICS;
  return (
    <Screen ground="first-open" autoState="hello">
      <EdgeBrand />
      <KeyboardAvoidingView
        behavior={KEYBOARD_BEHAVIOUR}
        keyboardVerticalOffset={stackTop}
        style={styles.fill}
      >
        <FirstOpenHello onStarter={onStarter} />
        {composer ? (
          <View
            style={{
              paddingTop: pad.padTop,
              paddingHorizontal: pad.padX,
              paddingBottom: pad.padBottom,
            }}
          >
            {composer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  middle: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: EDGE_METRICS.padX },
  auto: { alignSelf: 'flex-end' },
  starters: { flexDirection: 'row', flexWrap: 'wrap' },
  starter: { justifyContent: 'center', borderWidth: 1 },
});
