// A question card's controls (handoff §2 'Questions'): the option buttons that answer at once, the
// own-words toggle, the field with Answer, and Dismiss, which first says what dismissing does
// (Keep the question, or Dismiss). What shows and what is enabled is controls.ts's. Wrapped rows of
// options sit 14 apart, so their slops never overlap.

import Check from 'lucide-react-native/icons/check';
import X from 'lucide-react-native/icons/x';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Text, TextField } from '../../ui';
import { QUESTIONS_COPY } from '../strings';
import { QUESTION_CONTROLS } from './chrome';
import type { DismissConfirm, QuestionControls } from './controls';
import type { QuestionCardState } from './use-questions';

type PanelProps = {
  readonly controls: QuestionControls;
  readonly card: QuestionCardState;
};

function Options({ controls, card }: PanelProps) {
  const { spacing } = useTokens();
  if (controls.options.length === 0) return null;
  return (
    <View
      style={[
        styles.wrap,
        {
          columnGap: spacing[QUESTION_CONTROLS.optionGap],
          rowGap: spacing[QUESTION_CONTROLS.optionRowGap],
        },
      ]}
    >
      {controls.options.map((option) => (
        <Button
          key={option.option}
          label={option.label}
          variant="outline"
          size="sm"
          disabled={option.disabled}
          busy={option.busy}
          onPress={() => card.choose(option.option)}
          accessibilityHint={QUESTIONS_COPY.optionHint}
        />
      ))}
    </View>
  );
}

function OwnWords({ controls, card }: PanelProps) {
  return (
    <>
      {controls.toggle ? (
        <View style={styles.start}>
          <Button
            label={controls.toggle.label}
            variant="ghost"
            size="sm"
            disabled={controls.toggle.disabled}
            onPress={card.toggleWords}
          />
        </View>
      ) : null}
      {controls.field ? (
        <TextField
          label={QUESTIONS_COPY.field.label}
          hideLabel
          placeholder={QUESTIONS_COPY.field.placeholder}
          value={card.text}
          onChangeText={card.setText}
          disabled={controls.field.disabled}
          multiline
        />
      ) : null}
    </>
  );
}

function Actions({ controls, card }: PanelProps) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.end, { gap: spacing[QUESTION_CONTROLS.actionGap] }]}>
      {controls.dismiss ? (
        <Button
          label={controls.dismiss.label}
          variant="outline"
          size="sm"
          icon={X}
          disabled={controls.dismiss.disabled}
          onPress={card.askDismiss}
        />
      ) : null}
      {controls.answer ? (
        <Button
          label={controls.answer.label}
          size="sm"
          icon={Check}
          disabled={controls.answer.disabled}
          busy={controls.answer.busy}
          onPress={card.sendWords}
          accessibilityHint={QUESTIONS_COPY.answerHint}
        />
      ) : null}
    </View>
  );
}

function Confirm({
  confirm,
  card,
}: {
  readonly confirm: DismissConfirm;
  readonly card: QuestionCardState;
}) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: QUESTION_CONTROLS.gap }}>
      <Text
        level={QUESTION_CONTROLS.effectLevel}
        tone={QUESTION_CONTROLS.effectTone}
        accessibilityLiveRegion="polite"
      >
        {confirm.effect}
      </Text>
      <View style={[styles.end, { gap: spacing[QUESTION_CONTROLS.actionGap] }]}>
        <Button
          label={confirm.keep.label}
          variant="outline"
          size="sm"
          disabled={confirm.keep.disabled}
          onPress={card.keep}
        />
        <Button
          label={confirm.dismiss.label}
          size="sm"
          icon={X}
          disabled={confirm.dismiss.disabled}
          busy={confirm.dismiss.busy}
          onPress={card.dismiss}
        />
      </View>
    </View>
  );
}

export function QuestionControlsPanel({ controls, card }: PanelProps) {
  if (controls.confirm) return <Confirm confirm={controls.confirm} card={card} />;
  return (
    <View style={{ gap: QUESTION_CONTROLS.gap }}>
      <Options controls={controls} card={card} />
      <OwnWords controls={controls} card={card} />
      <Actions controls={controls} card={card} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  start: { alignSelf: 'flex-start' },
  end: { flexDirection: 'row', justifyContent: 'flex-end' },
});
