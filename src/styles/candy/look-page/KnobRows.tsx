// Make it sweet's knob rows (the kit's looks/look-controls.tsx at 3920359d5, over knobs.ts): each
// knob a row under the dress's rule (dressedRow: Candy's 52 pt rows and 1.5 pt rules), its label
// in Nunito 700 over its control. Palette is three 38 pt circles, each its palette's first two card
// colours, named by the palette; Card colours and Gradient are rows of round pills (Gradient's note
// under it); each is a radio group whose chosen one is checked, filled or ringed, and marked ✓.
// Roundness (16–40, whole points) and Glow (0–10) are the shared slider, its value beside the
// label; Motion is React Native's own Switch, its words beside it, off and fixed under Reduce
// Motion. Every change goes to the style store at once (use-sweet-page.ts).

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { dressedRow } from '../../../ui/dressed';
import { Slider } from '../../../ui/Slider';
import { useDress } from '../../dress/use-dress';
import { useStyle } from '../../theme';
import type { CandyLook } from '../look-schema';
import { pillPaint } from '../parts/chips';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_SWEET_COPY } from '../strings';
import {
  glowRow,
  motionRow,
  paletteRow,
  roundnessRow,
  segmentRow,
  type PaletteRow,
  type SegmentKnob,
  type SegmentRow,
  type SliderRow,
  type SweetChoice,
} from './knobs';
import { SWEET_PAGE } from './sweet';
import type { SweetPage } from './use-sweet-page';

const { swatch, row } = SWEET_PAGE;
const CHOSEN = CANDY_SWEET_COPY.chosen;
const NOTE_SIZE = 13;
const PRESSED_OPACITY = 0.7;

type RowProps = {
  readonly title: string;
  /** Beside the label: a slider's value (hidden from VoiceOver, which hears the slider's). */
  readonly value?: string;
  readonly children: ReactNode;
};

function KnobRow({ title, value, children }: RowProps) {
  const style = useStyle();
  const { vars, type } = useCandyPaint();
  const rule = dressedRow(useDress(), style.tokens.colours);
  const frame = {
    minHeight: rule.minHeight,
    borderTopWidth: rule.separatorWidth,
    borderTopColor: rule.separatorColour,
  };
  return (
    <View style={[styles.row, frame]}>
      <View style={styles.head}>
        <Text style={[type.label, styles.title, { color: vars.text }]}>{title}</Text>
        {value === undefined ? null : (
          <Text
            accessible={false}
            importantForAccessibility="no"
            style={[type.label, { color: vars.quiet }]}
          >
            {value}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

type PickProps = { readonly onPick: (value: string) => void };

function Swatches({ item, onPick }: PickProps & { readonly item: PaletteRow }) {
  const { vars, type } = useCandyPaint();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={item.title} style={styles.swatches}>
      {item.choices.map((choice) => (
        <Pressable
          key={choice.value}
          onPress={() => onPick(choice.value)}
          accessibilityRole="radio"
          accessibilityLabel={choice.label}
          accessibilityState={{ checked: choice.selected }}
          style={({ pressed }) => [
            styles.swatchFrame,
            { borderColor: choice.selected ? vars.text : vars.page },
            { opacity: pressed ? PRESSED_OPACITY : 1 },
          ]}
        >
          <View style={styles.swatch}>
            <View style={[styles.half, { backgroundColor: choice.swatch?.a ?? vars.chip }]} />
            <View style={[styles.half, { backgroundColor: choice.swatch?.b ?? vars.chip }]} />
            {choice.selected ? (
              <Text style={[type.button, styles.check, { color: vars.cardInk }]}>{CHOSEN}</Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function Segment({ choice, onPick }: PickProps & { readonly choice: SweetChoice }) {
  const { vars, type, round } = useCandyPaint();
  const paint = pillPaint(choice.selected);
  return (
    <Pressable
      onPress={() => onPick(choice.value)}
      accessibilityRole="radio"
      accessibilityLabel={choice.label}
      accessibilityState={{ checked: choice.selected }}
      style={({ pressed }) => [
        styles.segment,
        { borderRadius: round, opacity: pressed ? PRESSED_OPACITY : 1 },
        paint.fill ? { backgroundColor: vars[paint.fill] } : null,
      ]}
    >
      <Text style={[type.button, { color: vars[paint.ink] }]}>
        {choice.selected ? `${CHOSEN} ${choice.word}` : choice.word}
      </Text>
    </Pressable>
  );
}

function Segments({ item, onPick }: PickProps & { readonly item: SegmentRow }) {
  const { vars, type } = useCandyPaint();
  return (
    <>
      <View accessibilityRole="radiogroup" accessibilityLabel={item.title} style={styles.segments}>
        {item.choices.map((choice) => (
          <Segment key={choice.value} choice={choice} onPick={onPick} />
        ))}
      </View>
      {item.note === null ? null : (
        <Text style={[type.body(NOTE_SIZE, 700), { color: vars.quiet }]}>{item.note}</Text>
      )}
    </>
  );
}

function SliderKnob({
  item,
  onSlide,
}: {
  readonly item: SliderRow;
  readonly onSlide: (n: number) => void;
}) {
  return (
    <KnobRow title={item.title} value={item.shown}>
      <Slider
        value={item.value}
        min={item.min}
        max={item.max}
        onChange={onSlide}
        accessibilityLabel={item.title}
        valueText={item.spoken}
      />
    </KnobRow>
  );
}

function MotionKnob({ look, page }: { readonly look: CandyLook; readonly page: KnobPage }) {
  const { vars, type } = useCandyPaint();
  const item = motionRow(look, page.reduceMotion);
  return (
    <KnobRow title={item.title}>
      <View style={styles.motion}>
        <Switch
          value={item.on}
          onValueChange={page.switchMotion}
          disabled={item.disabled}
          accessibilityRole="switch"
          accessibilityLabel={item.title}
          accessibilityHint={item.words}
          accessibilityState={{ checked: item.on, disabled: item.disabled }}
          trackColor={{ false: vars.quiet, true: vars.accent }}
          thumbColor={vars.win}
          ios_backgroundColor={vars.quiet}
        />
        <Text
          accessible={false}
          importantForAccessibility="no"
          style={[type.body(NOTE_SIZE, 700), styles.title, { color: vars.quiet }]}
        >
          {item.words}
        </Text>
      </View>
    </KnobRow>
  );
}

type KnobPage = Pick<
  SweetPage,
  'reduceMotion' | 'choose' | 'slideRoundness' | 'slideGlow' | 'switchMotion'
>;

export type KnobRowsProps = { readonly look: CandyLook; readonly page: KnobPage };

export function KnobRows({ look, page }: KnobRowsProps) {
  const palette = paletteRow(look);
  const segments = (knob: SegmentKnob) => {
    const item = segmentRow(look, knob);
    return (
      <KnobRow key={knob} title={item.title}>
        <Segments item={item} onPick={(value) => page.choose(knob, value)} />
      </KnobRow>
    );
  };
  return (
    <View>
      <KnobRow title={palette.title}>
        <Swatches item={palette} onPick={(value) => page.choose('palette', value)} />
      </KnobRow>
      {segments('cards')}
      {segments('gradient')}
      <SliderKnob item={roundnessRow(look)} onSlide={page.slideRoundness} />
      <SliderKnob item={glowRow(look)} onSlide={page.slideGlow} />
      <MotionKnob look={look} page={page} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: row.gap, paddingVertical: row.padV, justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: row.gap },
  title: { flexShrink: 1, flexGrow: 1 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: swatch.gap },
  swatchFrame: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    borderWidth: swatch.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: swatch.size,
    height: swatch.size,
    borderRadius: swatch.size / 2,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  half: { flex: 1, alignSelf: 'stretch' },
  check: { position: 'absolute' },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: SWEET_PAGE.segment.gap },
  segment: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: row.gap + SWEET_PAGE.segment.gap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motion: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: row.gap },
});
