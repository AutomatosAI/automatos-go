// Remove this phone on Settings → Account (US-014h, KP16), asked first, on a hosted phone with a
// push record: the button opens a sheet with the question, and only its yes removes this phone from
// the workspace's devices; the person stays signed in. Nothing here deletes an account or a
// workspace (D63). An own server shows nothing here: its way out is the connect kit's 'Remove this
// phone and forget this server'. Wiring only: use-remove-phone.ts.

import { Button, Sheet, Text } from '../../ui';
import { PUSH_ACCOUNT_COPY } from '../strings';
import { useRemovePhone } from './use-remove-phone';

const TITLE_LEVEL = 3;
const QUESTION_LEVEL = 1;

export function RemovePhone() {
  const { shown, asking, busy, ask, close, remove } = useRemovePhone();
  if (!shown && !busy) return null;
  return (
    <>
      <Button label={PUSH_ACCOUNT_COPY.removePhone} onPress={ask} variant="outline" busy={busy} />
      <Sheet visible={asking} onClose={close}>
        <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
          {PUSH_ACCOUNT_COPY.removeTitle}
        </Text>
        <Text level={QUESTION_LEVEL}>{PUSH_ACCOUNT_COPY.removeQuestion}</Text>
        <Button label={PUSH_ACCOUNT_COPY.removeConfirm} onPress={() => void remove()} fullWidth />
        <Button label={PUSH_ACCOUNT_COPY.removeCancel} onPress={close} variant="ghost" fullWidth />
      </Sheet>
    </>
  );
}
