// Forget this server, asked first (US-006h): the button opens a sheet with the question ('This phone
// stops using {server}. Studio still lists it until it is removed there.') and only its yes leaves,
// through the shell's sign-out (src/app-state/use-sign-out.ts → switch.forgetServer(): the server's
// cached data, workspace id, pairing and record are cleared and the current server moves). The
// gate, now connected nowhere, opens Welcome. The sheet closes on the yes, so a failure's toast is
// seen; the button stays busy until the shell moves. On a paired own server only: Remove this phone,
// the server side, is US-006i. Nothing here deletes an account or a workspace (D63).

import { useState } from 'react';

import { useSignOut } from '../../app-state/use-sign-out';
import { Button, Sheet, Text, type ButtonVariant } from '../../ui';
import { FORGET_SERVER_COPY } from '../strings';

const TITLE_LEVEL = 3;
const QUESTION_LEVEL = 1;

export type ForgetServerProps = {
  /** The question, naming the server (edges.ts). */
  readonly question: string;
  readonly variant?: ButtonVariant;
  readonly fullWidth?: boolean;
};

export function ForgetServer({
  question,
  variant = 'outline',
  fullWidth = false,
}: ForgetServerProps) {
  const { signOut, busy } = useSignOut();
  const [asking, setAsking] = useState(false);
  const close = () => setAsking(false);
  const forget = () => {
    setAsking(false);
    signOut();
  };
  return (
    <>
      <Button
        label={FORGET_SERVER_COPY.action}
        onPress={() => setAsking(true)}
        variant={variant}
        busy={busy}
        fullWidth={fullWidth}
      />
      <Sheet visible={asking} onClose={close}>
        <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
          {FORGET_SERVER_COPY.title}
        </Text>
        <Text level={QUESTION_LEVEL}>{question}</Text>
        <Button label={FORGET_SERVER_COPY.confirm} onPress={forget} fullWidth />
        <Button label={FORGET_SERVER_COPY.cancel} onPress={close} variant="ghost" fullWidth />
      </Sheet>
    </>
  );
}
