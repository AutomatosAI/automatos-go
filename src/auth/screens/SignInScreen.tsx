// The hosted sign-in screen (PRD-001 §4.5, D5, D6): email code, password or passkey, then any
// second factor the tenant asks for. Thin wiring: the steps and every word of a refusal come from
// the step machine (sign-in-machine.ts, server-words.ts) over Clerk's signals signIn, held here
// with useSyncExternalStore. Once Clerk's session is active the (auth) layout leaves for home.

import { useSignIn } from '@clerk/expo';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { LoadingState, Screen, Text } from '../../ui';
import {
  createSignInMachine,
  type SignInEvent,
  type SignInPort,
  type SignInSnapshot,
} from '../sign-in-machine';
import { SIGN_IN_SCREEN_COPY } from '../strings';
import { EmailCodeStep } from './EmailCodeStep';
import { ErrorStep } from './ErrorStep';
import { IdentifyStep } from './IdentifyStep';
import { PasswordStep } from './PasswordStep';
import { SecondFactorStep } from './SecondFactorStep';
import { isChoice } from './sign-in-view';

const TITLE_LEVEL = 2;
const LEAD_LEVEL = 1;

/** The machine over the latest useSignIn().signIn (a ref, so one machine lives for the screen). */
function useSignInMachine() {
  const { signIn } = useSignIn();
  const latest = useRef<SignInPort>(signIn);
  useEffect(() => {
    latest.current = signIn;
  }, [signIn]);
  const [machine] = useState(() => createSignInMachine(() => latest.current));
  const snapshot = useSyncExternalStore(machine.subscribe, machine.getSnapshot);
  const send = useCallback((event: SignInEvent) => void machine.send(event), [machine]);
  return { snapshot, send };
}

function Header() {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space3 }}>
      <Text variant="eyebrow">{SIGN_IN_SCREEN_COPY.eyebrow}</Text>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {SIGN_IN_SCREEN_COPY.title}
      </Text>
      <Text level={LEAD_LEVEL} tone="muted">
        {SIGN_IN_SCREEN_COPY.lead}
      </Text>
    </View>
  );
}

type StepProps = {
  readonly snapshot: SignInSnapshot;
  readonly send: (event: SignInEvent) => void;
};

function Step({ snapshot: { state, busy }, send }: StepProps) {
  if (isChoice(state)) {
    return (
      <IdentifyStep
        identifier={state.identifier}
        note={state.step === 'identify' ? state.note : undefined}
        busy={busy}
        waitingForPasskey={state.step === 'passkey'}
        send={send}
      />
    );
  }
  switch (state.step) {
    case 'password':
      return (
        <PasswordStep identifier={state.identifier} note={state.note} busy={busy} send={send} />
      );
    case 'emailCode':
      return <EmailCodeStep state={state} busy={busy} send={send} />;
    case 'secondFactor':
      return <SecondFactorStep state={state} busy={busy} send={send} />;
    case 'error':
      return <ErrorStep message={state.message} busy={busy} send={send} />;
    default:
      return <LoadingState label={SIGN_IN_SCREEN_COPY.completing} />;
  }
}

export function SignInScreen() {
  const { spacing } = useTokens();
  const { snapshot, send } = useSignInMachine();
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.space9, gap: spacing.space9 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Header />
        <Step snapshot={snapshot} send={send} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
});
