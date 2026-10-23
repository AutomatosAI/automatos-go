// Sign in with a passkey: the discoverable flow (no address needed), through Clerk's signIn and
// the native passkeys AuthRoot hands ClerkProvider (@clerk/expo-passkeys). Busy while the system
// sheet is up; closing the sheet comes back to the choice with no note (sign-in-machine.ts).

import KeyRound from 'lucide-react-native/icons/key-round';

import { Button } from '../../ui';
import { SIGN_IN_SCREEN_COPY } from '../strings';

export type PasskeyButtonProps = {
  readonly onPress: () => void;
  /** The passkey sheet is up. */
  readonly busy: boolean;
  /** Another step is running. */
  readonly disabled: boolean;
};

export function PasskeyButton({ onPress, busy, disabled }: PasskeyButtonProps) {
  return (
    <Button
      label={SIGN_IN_SCREEN_COPY.passkey}
      accessibilityHint={SIGN_IN_SCREEN_COPY.passkeyHint}
      icon={KeyRound}
      variant="outline"
      fullWidth
      busy={busy}
      disabled={disabled}
      onPress={onPress}
    />
  );
}
