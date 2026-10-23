// Connect's fields: the server's address (a URL keyboard, nothing capitalised or corrected) and the
// pairing code (capitals, shown as XXXX-XXXX while typing), each with its refusal under it; Scan
// the code in Studio (the scanner, US-006g) and Continue, which reads the server's discovery and
// stops at the confirm card (KC8). While the server is being checked the fields are locked and
// Cancel stops the check. A failure says what to do; the hosted server's address offers Sign in
// to Automatos instead.

import QrCode from 'lucide-react-native/icons/qr-code';
import { StyleSheet, View } from 'react-native';

import { StepNote } from '../../auth/screens/StepNote';
import { useTokens } from '../../styles/theme';
import { Button, TextField } from '../../ui';
import { ADDRESS_MAX_LENGTH, PAIR_CODE_INPUT_MAX_LENGTH } from '../config';
import type { ConnectField } from '../flow';
import { CONNECT_SCREEN_COPY } from '../strings';
import type { FormView } from './connect-view';

export type ConnectFormProps = {
  readonly view: FormView;
  readonly onEdit: (field: ConnectField, value: string) => void;
  readonly onContinue: () => void;
  /** Stops the check under way and keeps what was typed. */
  readonly onCancel: () => void;
  readonly onScan: () => void;
  readonly onSignIn: () => void;
};

export function ConnectForm({
  view,
  onEdit,
  onContinue,
  onCancel,
  onScan,
  onSignIn,
}: ConnectFormProps) {
  const { spacing } = useTokens();
  const submit = () => {
    if (view.canContinue) onContinue();
  };
  return (
    <View style={[styles.form, { gap: spacing.space5 }]}>
      <TextField
        label={CONNECT_SCREEN_COPY.addressLabel}
        placeholder={CONNECT_SCREEN_COPY.addressPlaceholder}
        helper={CONNECT_SCREEN_COPY.addressHelper}
        error={view.fieldErrors.origin}
        value={view.origin}
        onChangeText={(value) => onEdit('origin', value)}
        disabled={view.checking}
        keyboardType="url"
        textContentType="URL"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        maxLength={ADDRESS_MAX_LENGTH}
      />
      <TextField
        label={CONNECT_SCREEN_COPY.codeLabel}
        placeholder={CONNECT_SCREEN_COPY.codePlaceholder}
        helper={CONNECT_SCREEN_COPY.codeHelper}
        error={view.fieldErrors.code}
        value={view.codeDisplay}
        onChangeText={(value) => onEdit('code', value)}
        onSubmitEditing={submit}
        disabled={view.checking}
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        returnKeyType="go"
        maxLength={PAIR_CODE_INPUT_MAX_LENGTH}
      />
      {view.failure ? <StepNote note={{ tone: 'error', text: view.failure }} /> : null}
      <Button
        label={CONNECT_SCREEN_COPY.continue}
        onPress={submit}
        busy={view.checking}
        disabled={!view.canContinue && !view.checking}
        accessibilityHint={view.checking ? CONNECT_SCREEN_COPY.checking : undefined}
        fullWidth
      />
      {view.offerSignIn ? (
        <Button label={CONNECT_SCREEN_COPY.signIn} onPress={onSignIn} variant="outline" fullWidth />
      ) : null}
      {view.checking ? (
        <Button label={CONNECT_SCREEN_COPY.cancel} onPress={onCancel} variant="ghost" fullWidth />
      ) : (
        <Button
          label={CONNECT_SCREEN_COPY.scan}
          onPress={onScan}
          icon={QrCode}
          variant="outline"
          fullWidth
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { alignSelf: 'stretch' },
});
