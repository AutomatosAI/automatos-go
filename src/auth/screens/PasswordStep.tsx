// The password step: the account's password, Sign in, and Start again back to the choice. A
// second factor, if the tenant asks for one, follows on its own step. A refused password is
// cleared from the field (and from memory) as the refusal arrives.

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, TextField } from '../../ui';
import type { SignInEvent, SignInNote } from '../sign-in-machine';
import { SIGN_IN_SCREEN_COPY } from '../strings';
import { AccountLine } from './AccountLine';
import { StepNote } from './StepNote';

export type PasswordStepProps = {
  readonly identifier: string;
  readonly note?: SignInNote;
  readonly busy: boolean;
  readonly send: (event: SignInEvent) => void;
};

export function PasswordStep({ identifier, note, busy, send }: PasswordStepProps) {
  const { spacing } = useTokens();
  const [password, setPassword] = useState('');
  // a new note object per refusal; the pending snapshot keeps the old one, so this runs once each
  useEffect(() => {
    if (note?.tone === 'error') setPassword('');
  }, [note]);
  const submit = () => send({ type: 'submitPassword', password });
  return (
    <View style={[styles.step, { gap: spacing.space5 }]}>
      <AccountLine identifier={identifier} />
      <TextField
        label={SIGN_IN_SCREEN_COPY.passwordLabel}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
        disabled={busy}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        autoFocus
      />
      <Button label={SIGN_IN_SCREEN_COPY.signIn} onPress={submit} busy={busy} fullWidth />
      <Button
        label={SIGN_IN_SCREEN_COPY.startAgain}
        onPress={() => send({ type: 'startOver' })}
        variant="ghost"
        disabled={busy}
        fullWidth
      />
      <StepNote note={note} />
    </View>
  );
}

const styles = StyleSheet.create({
  step: { alignSelf: 'stretch' },
});
