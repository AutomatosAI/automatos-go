// A code step's controls, shared by the email-code and second-factor steps: the prompt, the code
// field (the phone offers a code from Messages or Mail), Verify, Send a new code where Clerk
// delivers one, and Start again.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Text, TextField } from '../../ui';
import type { SignInEvent } from '../sign-in-machine';
import { SIGN_IN_SCREEN_COPY } from '../strings';
import { AccountLine } from './AccountLine';
import { codeEntryFor, type CodeStepState } from './sign-in-view';
import { StepNote } from './StepNote';

const PROMPT_LEVEL = 2;

export type CodeEntryProps = {
  readonly state: CodeStepState;
  readonly busy: boolean;
  readonly send: (event: SignInEvent) => void;
};

export function CodeEntry({ state, busy, send }: CodeEntryProps) {
  const { spacing } = useTokens();
  const [code, setCode] = useState('');
  const entry = codeEntryFor(state);
  const verify = () => send({ type: 'verifyCode', code });
  return (
    <View style={[styles.step, { gap: spacing.space5 }]}>
      <AccountLine identifier={state.identifier} />
      <Text level={PROMPT_LEVEL}>{entry.prompt}</Text>
      <TextField
        label={entry.label}
        value={code}
        onChangeText={setCode}
        onSubmitEditing={verify}
        disabled={busy}
        keyboardType={entry.keyboard}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        returnKeyType="done"
        autoFocus
      />
      <Button label={SIGN_IN_SCREEN_COPY.verify} onPress={verify} busy={busy} fullWidth />
      {entry.canResend ? (
        <Button
          label={SIGN_IN_SCREEN_COPY.resend}
          onPress={() => send({ type: 'resendCode' })}
          variant="outline"
          disabled={busy}
          fullWidth
        />
      ) : null}
      <Button
        label={SIGN_IN_SCREEN_COPY.startAgain}
        onPress={() => send({ type: 'startOver' })}
        variant="ghost"
        disabled={busy}
        fullWidth
      />
      <StepNote note={state.note} />
    </View>
  );
}

const styles = StyleSheet.create({
  step: { alignSelf: 'stretch' },
});
