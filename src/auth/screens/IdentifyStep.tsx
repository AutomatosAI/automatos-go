// The choice: the account's address, then an email code (primary), the password, or a passkey.
// Nothing else (D5, D6): no social or Apple sign-in. The address is kept here while the passkey
// sheet is up, so a cancel comes back to it.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Divider, TextField } from '../../ui';
import type { SignInEvent, SignInNote } from '../sign-in-machine';
import { SIGN_IN_SCREEN_COPY } from '../strings';
import { PasskeyButton } from './PasskeyButton';
import { StepNote } from './StepNote';

export type IdentifyStepProps = {
  readonly identifier: string;
  readonly note?: SignInNote;
  /** A step is running (the code is being sent, or the passkey sheet is up). */
  readonly busy: boolean;
  /** The passkey sheet is up. */
  readonly waitingForPasskey: boolean;
  readonly send: (event: SignInEvent) => void;
};

export function IdentifyStep({
  identifier,
  note,
  busy,
  waitingForPasskey,
  send,
}: IdentifyStepProps) {
  const { spacing } = useTokens();
  const [email, setEmail] = useState(identifier);
  const sendCode = () => send({ type: 'sendEmailCode', identifier: email });
  return (
    <View style={[styles.step, { gap: spacing.space5 }]}>
      <TextField
        label={SIGN_IN_SCREEN_COPY.emailLabel}
        placeholder={SIGN_IN_SCREEN_COPY.emailPlaceholder}
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={sendCode}
        disabled={busy}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        keyboardType="email-address"
        returnKeyType="send"
      />
      <Button
        label={SIGN_IN_SCREEN_COPY.sendCode}
        onPress={sendCode}
        busy={busy && !waitingForPasskey}
        disabled={waitingForPasskey}
        fullWidth
      />
      <Button
        label={SIGN_IN_SCREEN_COPY.usePassword}
        onPress={() => send({ type: 'choosePassword', identifier: email })}
        variant="outline"
        disabled={busy}
        fullWidth
      />
      <Divider />
      <PasskeyButton
        onPress={() => send({ type: 'usePasskey' })}
        busy={waitingForPasskey}
        disabled={busy && !waitingForPasskey}
      />
      <StepNote note={note} />
    </View>
  );
}

const styles = StyleSheet.create({
  step: { alignSelf: 'stretch' },
});
