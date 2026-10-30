// The slider (KS7): ours, on react-native-gesture-handler and react-native-reanimated, as the build
// has no native one. A 4 pt track — the accent up to the thumb, the muted track after it, the part
// past maxAllowed faded — and a 28 pt thumb (square under HUD and Arcade, round elsewhere) in a
// 44 pt row. A drag or a tap moves it in whole steps on the UI thread, the thumb set on each step
// and never gliding between (Arcade's stepped motion); onChange hears each new step and
// onChangeEnd the value a drag or tap ends on. VoiceOver and TalkBack adjust it a step at a time
// (role 'adjustable', increment and decrement) and read its value, in words when given. The logic
// is slider-model.ts (pure, tested).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { useDress } from '../styles/dress/use-dress';
import type { Layout } from '../styles/registry/style-id';
import { useTokens } from '../styles/theme';
import { DISABLED_OPACITY } from './paint';
import {
  SLIDER,
  adjustValue,
  clampValue,
  isAdjustAction,
  sliderAccessibilityValue,
  sliderRange,
  sliderShape,
  touchToValue,
  trackLength,
  valueToOffset,
  type SliderRange,
} from './slider-model';

/** A drag starts once a finger moves this far sideways, and yields to a scroll this far down. */
const DRAG_START = 6;
const SCROLL_WINS = 12;
const ADJUST_ACTIONS = Object.freeze([{ name: 'increment' }, { name: 'decrement' }]);
const TRACK_TOP = (SLIDER.rowHeight - SLIDER.trackHeight) / 2;
const THUMB_TOP = (SLIDER.rowHeight - SLIDER.thumbSize) / 2;
const HALF_THUMB = SLIDER.thumbSize / 2;
/** The layouts that draw the slider square: HUD's README and Arcade's pixels round nothing. */
const SQUARE_LAYOUTS: ReadonlySet<Layout> = new Set<Layout>(['hud', 'arcade']);

export type SliderProps = {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** Whole steps from min; 1 when omitted. */
  readonly step?: number;
  /** Where the thumb stops, below max (the glow's AA cap); max when omitted. */
  readonly maxAllowed?: number;
  readonly onChange: (value: number) => void;
  /** The value a drag or tap ends on (save it then). */
  readonly onChangeEnd?: (value: number) => void;
  /** What the slider sets ('Glow'). */
  readonly accessibilityLabel: string;
  /** The value in words ('24 of 40'); the number when omitted. */
  readonly valueText?: (value: number) => string;
  readonly disabled?: boolean;
};

type GestureInput = {
  readonly range: SliderRange;
  readonly width: number;
  readonly offset: SharedValue<number>;
  readonly last: SharedValue<number>;
  readonly dragging: SharedValue<boolean>;
  readonly onChange: (value: number) => void;
  readonly onChangeEnd?: (value: number) => void;
  readonly disabled: boolean;
};

function useSliderGesture(input: GestureInput) {
  const { range, width, offset, last, dragging, onChange, onChangeEnd, disabled } = input;
  return useMemo(() => {
    const moveTo = (x: number) => {
      'worklet';
      const next = touchToValue(x, range, width);
      offset.value = valueToOffset(next, range, trackLength(width));
      if (next === last.value) return;
      last.value = next;
      runOnJS(onChange)(next);
    };
    const end = () => {
      'worklet';
      if (onChangeEnd) runOnJS(onChangeEnd)(last.value);
    };
    const pan = Gesture.Pan()
      .enabled(!disabled)
      .activeOffsetX([-DRAG_START, DRAG_START])
      .failOffsetY([-SCROLL_WINS, SCROLL_WINS])
      .onStart((event) => {
        dragging.value = true;
        moveTo(event.x);
      })
      .onUpdate((event) => moveTo(event.x))
      .onEnd(end)
      .onFinalize(() => {
        dragging.value = false;
      });
    const tap = Gesture.Tap()
      .enabled(!disabled)
      .onEnd((event) => {
        moveTo(event.x);
        end();
      });
    return Gesture.Race(pan, tap);
  }, [range, width, offset, last, dragging, onChange, onChangeEnd, disabled]);
}

export function Slider({
  value,
  min,
  max,
  step,
  maxAllowed,
  onChange,
  onChangeEnd,
  accessibilityLabel,
  valueText,
  disabled = false,
}: SliderProps) {
  const { colours } = useTokens();
  const shape = sliderShape(SQUARE_LAYOUTS.has(useDress().layout));
  const range = useMemo(
    () => sliderRange({ min, max, step, maxAllowed }),
    [min, max, step, maxAllowed],
  );
  const now = clampValue(value, range);
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);
  const last = useSharedValue(now);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (dragging.value) return;
    last.value = now;
    offset.value = valueToOffset(now, range, trackLength(width));
  }, [now, range, width, dragging, last, offset]);

  const gesture = useSliderGesture({
    range,
    width,
    offset,
    last,
    dragging,
    onChange,
    onChangeEnd,
    disabled,
  });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);
  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const { actionName } = event.nativeEvent;
      if (disabled || !isAdjustAction(actionName)) return;
      const next = adjustValue(now, range, actionName);
      if (next === now) return;
      onChange(next);
      onChangeEnd?.(next);
    },
    [disabled, now, range, onChange, onChangeEnd],
  );

  const fill = useAnimatedStyle(() => ({ width: offset.value }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const length = trackLength(width);
  const capOffset = valueToOffset(range.highest, range, length);
  const track = { height: SLIDER.trackHeight, top: TRACK_TOP, borderRadius: shape.trackRadius };

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={sliderAccessibilityValue(now, range, valueText?.(now))}
        accessibilityState={{ disabled }}
        accessibilityActions={ADJUST_ACTIONS}
        onAccessibilityAction={onAccessibilityAction}
        onLayout={onLayout}
        style={[styles.row, disabled ? styles.disabled : null]}
      >
        <View style={[styles.track, track, { backgroundColor: colours.muted }]} />
        {capOffset < length ? (
          <View
            style={[
              styles.past,
              track,
              { left: HALF_THUMB + capOffset, backgroundColor: colours.background },
            ]}
          />
        ) : null}
        <Animated.View style={[styles.fill, track, { backgroundColor: colours.primary }, fill]} />
        <Animated.View
          style={[
            styles.thumb,
            { borderRadius: shape.thumbRadius, backgroundColor: colours.primary },
            thumb,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: { height: SLIDER.rowHeight, justifyContent: 'center' },
  disabled: { opacity: DISABLED_OPACITY },
  track: { position: 'absolute', left: HALF_THUMB, right: HALF_THUMB },
  past: { position: 'absolute', right: HALF_THUMB, opacity: 1 - DISABLED_OPACITY },
  fill: { position: 'absolute', left: HALF_THUMB },
  thumb: {
    position: 'absolute',
    left: 0,
    top: THUMB_TOP,
    width: SLIDER.thumbSize,
    height: SLIDER.thumbSize,
  },
});
