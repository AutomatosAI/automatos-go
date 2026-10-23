// Remove this phone and forget this server, asked first (US-006h, US-006i): the button opens a sheet
// with the question (the server removes this phone and the phone stops using it; Studio may still
// list it if the server can't be reached) and only its yes leaves, through the shell's sign-out
// (src/app-state/use-sign-out.ts → use-server-switch.ts: DELETE this phone's own device row, best
// effort, then switch.forgetServer() clears the server's cached data, workspace id, pairing and
// record and moves the current server). The gate, now connected nowhere, opens Welcome. The sheet
// closes on the yes, so a toast is seen; the button stays busy until the shell moves. On a paired
// own server only. Nothing here deletes an account or a workspace (D63).

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
