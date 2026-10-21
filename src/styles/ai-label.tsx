// The AI label (D-AI-LABEL, PRD-264 EUAI-11a, EU AI Act Art. 50(1)): "Auto is an AI", or
// "{agent} is an AI" while another agent answers, beside the composer on every chat screen and on
// the voice screen. Its colours are FIXED here, never read from the tokens, a look or a theme, so
// no style can fade or hide it (this file is the lint rule's one exemption outside the tokens). A
// cream pill with ink words reads on Studio Light and Studio Dark alike (16.6:1).
//
// useAiLabelVisible() measures the label in the window whenever it is laid out or the window
// changes; while it can't be seen (ai-label-state.ts) the composer is disabled and shows
// AiLabelPaused, the web's own words (AI_LABEL_PAUSED_TEXT).

import { useCallback, useEffect, useReducer, useRef, type RefObject } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import {
  AI_LABEL_PAUSED_TEXT,
  aiLabelVisibilityReducer,
  aiLabelWords,
  initialAiLabelVisibility,
  type AiLabelAgent,
} from './ai-label-state';
import { TEXT_SCALING, typeStyle } from './type';

/** The label's own colours: the same in every style, theme and look. */
export const AI_LABEL_COLOURS = Object.freeze({
  ground: '#FAF6F0',
  ink: '#1A1714',
  border: '#564D43',
  /** The paused notice's edge (Studio Light's accent, fixed). */
  alert: '#C5461B',
});

const LABEL_FACE = typeStyle('body5', { weight: 500 });
const PAUSED_FACE = typeStyle('body4');
/** The label's box is fixed too: the web's rounded-full px-2.5 py-0.5, and the notice's px-3 py-2. */
const PILL = Object.freeze({ radius: 999, paddingX: 10, paddingY: 2 });
const NOTE = Object.freeze({ radius: 6, paddingX: 12, paddingY: 8 });

/** What AiLabel needs to report its position: pass the hook's `track` straight through. */
export type AiLabelTracking = {
  readonly ref: RefObject<View | null>;
  readonly onLayout: (event: LayoutChangeEvent) => void;
};

export type AiLabelVisible = {
  /** true once the label is laid out, big enough to read and wholly inside the window. */
  readonly visible: boolean;
  readonly track: AiLabelTracking;
};

/** Whether the label is on screen: measured on every layout and window change, hidden until then. */
export function useAiLabelVisible(): AiLabelVisible {
  const ref = useRef<View | null>(null);
  const { width, height } = useWindowDimensions();
  const [state, dispatch] = useReducer(aiLabelVisibilityReducer, { width, height }, (window) =>
    initialAiLabelVisibility(window),
  );
  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) {
      dispatch({ type: 'detach' });
      return;
    }
    node.measureInWindow((x, y, boxWidth, boxHeight) =>
      dispatch({ type: 'layout', box: { x, y, width: boxWidth, height: boxHeight } }),
    );
  }, []);
  useEffect(() => {
    dispatch({ type: 'window', window: { width, height } });
    measure();
  }, [width, height, measure]);
  return { visible: state.visible, track: { ref, onLayout: measure } };
}

export type AiLabelProps = {
  /** Who answers: Auto when omitted or null; a picked agent by name (unknown name: "This agent"). */
  readonly agent?: AiLabelAgent;
  /** From useAiLabelVisible(): the composer reads `visible` from the same hook. */
  readonly track?: AiLabelTracking;
};

export function AiLabel({ agent, track }: AiLabelProps) {
  const words = aiLabelWords(agent);
  return (
    <View ref={track?.ref} onLayout={track?.onLayout} collapsable={false} style={styles.pill}>
      <Text
        {...TEXT_SCALING}
        accessibilityRole="text"
        accessibilityLabel={words}
        style={[LABEL_FACE, styles.words]}
      >
        {words}
      </Text>
    </View>
  );
}

/** Shown in place of the send while the label can't be seen. */
export function AiLabelPaused() {
  return (
    <View style={styles.paused} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text {...TEXT_SCALING} style={[PAUSED_FACE, styles.words]}>
        {AI_LABEL_PAUSED_TEXT}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: AI_LABEL_COLOURS.border,
    backgroundColor: AI_LABEL_COLOURS.ground,
    borderRadius: PILL.radius,
    paddingHorizontal: PILL.paddingX,
    paddingVertical: PILL.paddingY,
  },
  paused: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: AI_LABEL_COLOURS.alert,
    backgroundColor: AI_LABEL_COLOURS.ground,
    borderRadius: NOTE.radius,
    paddingHorizontal: NOTE.paddingX,
    paddingVertical: NOTE.paddingY,
  },
  words: { color: AI_LABEL_COLOURS.ink },
});
