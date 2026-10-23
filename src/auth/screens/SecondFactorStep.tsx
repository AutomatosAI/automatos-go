// The second-factor step (needs_second_factor or needs_client_trust): the strategy the machine
// picked (email or text code, authenticator, backup code), its code field and Verify; Send a new
// code only where Clerk delivers the code.

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import type { SignInEvent, SignInState } from '../sign-in-machine';
import { SIGN_IN_SCREEN_COPY } from '../strings';
import { CodeEntry } from './CodeEntry';

const TITLE_LEVEL = 4;

export type SecondFactorStepProps = {
  readonly state: Extract<SignInState, { step: 'secondFactor' }>;
  readonly busy: boolean;
  readonly send: (event: SignInEvent) => void;
};

export function SecondFactorStep({ state, busy, send }: SecondFactorStepProps) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.step, { gap: spacing.space5 }]}>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {SIGN_IN_SCREEN_COPY.secondFactorTitle}
      </Text>
      <CodeEntry state={state} busy={busy} send={send} />
    </View>
  );
}

const styles = StyleSheet.create({
  step: { alignSelf: 'stretch' },
});
