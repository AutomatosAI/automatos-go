// The newest open suggestion, pinned directly above the composer (PRD-268 §6.12.5, US-G01): Studio's
// home (above A2's composer, in ChatFrame's keyboard lift) and Play's home (between Auto's row and
// Play's message box). The whole card while the keyboard is down, one line while it is up; nothing
// when there is none, or where discovery does not list `suggestions`. 'Started. Auto is on it.'
// takes its place for 4 s after a Start, said aloud to VoiceOver. It enters once per suggestion
// (a fade with a 4 pt rise, 180 ms; a cross-fade under Reduce Motion).

import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { useTokens } from '../styles/theme';
import type { SpaceName } from '../styles/tokens';
import { useKeyboardHeight } from '../ui/use-keyboard-height';
import { pinnedForm, suggestionView } from './model';
import { StartedLine, SuggestionCard, SuggestionLine } from './SuggestionCard';
import { SUGGESTION_COPY } from './strings';
import { useOpenSuggestions, useSuggestionActions } from './use-suggestions';

/** §6.12.3 'Motion': one entrance, a fade with a 4 pt rise over 180 ms. */
const ENTRANCE = Object.freeze({ durationMs: 180, risePt: 4 });

const RISE = FadeInDown.duration(ENTRANCE.durationMs).withInitialValues({
  transform: [{ translateY: ENTRANCE.risePt }],
});
const FADE = FadeIn.duration(ENTRANCE.durationMs);

export type PinnedSuggestionProps = {
  /** The side padding to line up with the composer (Studio's 16, Play's own). */
  readonly inset?: SpaceName;
};

export function PinnedSuggestion({ inset }: PinnedSuggestionProps) {
  const { spacing } = useTokens();
  const reduceMotion = useReducedMotion();
  const keyboard = useKeyboardHeight();
  const { offered, open } = useOpenSuggestions();
  const actions = useSuggestionActions();
  const { started } = actions;
  useEffect(() => {
    if (started) AccessibilityInfo.announceForAccessibility(SUGGESTION_COPY.started);
  }, [started]);
  if (!offered) return null;
  const newest = open[0];
  const pad = { paddingHorizontal: inset ? spacing[inset] : 0, paddingBottom: spacing.space3 };
  if (started) {
    return (
      <View style={pad}>
        <StartedLine />
      </View>
    );
  }
  if (!newest) return null;
  const view = suggestionView(newest);
  const Form = pinnedForm(keyboard) === 'line' ? SuggestionLine : SuggestionCard;
  return (
    <Animated.View key={view.id} entering={reduceMotion ? FADE : RISE} style={pad}>
      <Form view={view} actions={actions} />
    </Animated.View>
  );
}
