// First open (PRD-001 §4.7 Edges, Ember 06, US-017f): the home before the first message, Auto at
// hello. FirstOpenHello is the words; FirstOpen the whole screen with the home's composer under them,
// lifted over the keyboard on iOS as A2's ChatFrame lifts its own. US-016k mounts it. Like every
// thread, it opens with the AI label's one muted caption (D73): PlayThreadCaption above the hello,
// HUD's in its core's transcript.
//
//   Play    the brand line; Auto 170 (right); 'Your Automatos,' / 'the fun way.' (the hero slot,
//           58/0.92, the second line in the accent text); the lede (15/1.5, text2); three starter
//           chips (44 high, round, 1 pt line of the ground's text at 0.2) that fill the composer
//           and never send (KS13); the composer (PlayComposer firstOpen: the accent Send)
//   Studio  the sail mark, 'Talk to Auto' (Newsreader 28) and the same lede; no chips (D29); Auto
//           only when an installed theme brings him
//   HUD     its core with an empty transcript, 'Say or type what you need.' (HudCore, EMPTY_TURN)
//   Arcade  the brand line; a window tabbed AUTO with his sprite waving (hello) and its word at its
//           head, and the greeting his dialogue says before any reply (Pixelify Sans 17/1.3, the
//           dialogue's line), which says the lede's words too; no chips (US-022i)
//   Candy   the brand line; Candy's window with the band across its top, Auto at 140 waving
//           (hello) on it with his state word, 'Hi, I'm Auto' (the hero slot, Outfit 600 28) and
//           the kit's empty-thread line (15/1.5, the quiet text); no chips (US-023l)

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
import { PlayThreadCaption } from '../play/companion';
import { ARCADE_COPY, EDGE_COPY } from '../strings';
import { useStyle } from '../theme';
import { ARCADE_DIALOGUE } from '../typeface/arcade-type';
import { CANDY_EDGE_COPY } from '../candy/strings';
import { ArcadeEdgeWindow } from './ArcadeEdgeWindow';
import { CandyEdgeWindow } from './CandyEdgeWindow';
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

/** Arcade's hello: Auto's window, his sprite waving at its head, and his greeting. */
function ArcadeHello() {
  const style = useStyle();
  const paint = useEdgePaint();
  const line = style.type.body(ARCADE_DIALOGUE.size);
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.middle}
      keyboardShouldPersistTaps="handled"
    >
      <ArcadeEdgeWindow state="hello" title={ARCADE_COPY.dialogue.speaker} centred>
        <Text style={[line, styles.centred, { color: paint.text }]}>{EDGE_COPY.arcade.greeting}</Text>
      </ArcadeEdgeWindow>
    </ScrollView>
  );
}

/** Candy's hello: its window, Auto waving on its band, his greeting and its line. */
function CandyHello() {
  const style = useStyle();
  const paint = useEdgePaint();
  const lede = style.type.body(EDGE_METRICS.ledeSize, 400, { leading: EDGE_METRICS.ledeLeading });
  const { greeting } = CANDY_EDGE_COPY;
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.middle}
      keyboardShouldPersistTaps="handled"
    >
      <CandyEdgeWindow state="hello" centred>
        <Text
          accessibilityRole="header"
          style={[style.type.display('hero'), styles.centred, { color: paint.text }]}
        >
          {greeting.title}
        </Text>
        <Text style={[lede, styles.centred, { color: paint.text2 }]}>{greeting.line}</Text>
      </CandyEdgeWindow>
    </ScrollView>
  );
}

/** Studio's and Play's hello: Auto, the greeting, the lede, and Play's starters. */
function Hello({ onStarter }: FirstOpenHelloProps) {
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

/** The hello: Auto, the greeting, the lede, and Play's starters; Arcade's and Candy's window. */
export function FirstOpenHello({ onStarter }: FirstOpenHelloProps) {
  const { layout } = useStyle();
  if (layout === 'arcade') return <ArcadeHello />;
  if (layout === 'candy') return <CandyHello />;
  return <Hello onStarter={onStarter} />;
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
        <PlayThreadCaption />
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
  centred: { textAlign: 'center' },
});
