// Nothing more this sign-in can do (a factor the app has no screen for, a step outside sign-in, a
// failed finalize): the words, then Start again, which clears Clerk's attempt.

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Text } from '../../ui';
import type { SignInEvent } from '../sign-in-machine';
import { SIGN_IN_SCREEN_COPY } from '../strings';
import { StepNote } from './StepNote';

const TITLE_LEVEL = 4;

export type ErrorStepProps = {
  readonly message: string;
  readonly busy: boolean;
  readonly send: (event: SignInEvent) => void;
};

export function ErrorStep({ message, busy, send }: ErrorStepProps) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.step, { gap: spacing.space5 }]}>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {SIGN_IN_SCREEN_COPY.errorTitle}
      </Text>
      <StepNote note={{ tone: 'error', text: message }} />
      <Button
        label={SIGN_IN_SCREEN_COPY.startAgain}
        onPress={() => send({ type: 'startOver' })}
        busy={busy}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  step: { alignSelf: 'stretch' },
});
