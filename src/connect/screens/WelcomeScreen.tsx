// Welcome (PRD-001 §4.5 first run): the brand mark, 'Automatos Go' and the two ways in: Sign in to
// Automatos (the hosted server, → /sign-in) and Connect to your own server (→ /connect). Sign-in
// only (D-SIGNIN): nothing here points at making an account. A build that cannot sign in to its
// hosted server says so under a disabled button (AuthRoot's not-configured state would otherwise
// replace the sign-in screen with no way back). Already signed in, the shell takes over. Thin
// wiring: welcomeView (connect-view.ts) decides.

import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuthSession } from '../../auth/AuthRoot';
import { env } from '../../lib/env';
import { routes } from '../../navigation/routes';
import { LegalLine } from '../../release/components/LegalLine';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../../release/legal-links';
import { hostedSignInConfigured } from '../../session/auth-branch';
import { useTokens } from '../../styles/theme';
import { Button, LoadingState, Screen, Text } from '../../ui';
import { BrandMark } from '../components/BrandMark';
import { WELCOME_COPY } from '../strings';
import { welcomeView } from './connect-view';

const TITLE_LEVEL = 1;
const LEAD_LEVEL = 1;
const NOTE_LEVEL = 3;

export function WelcomeScreen() {
  const { spacing } = useTokens();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuthSession();
  const view = welcomeView({ isLoaded, isSignedIn, hostedSignIn: hostedSignInConfigured(env) });
  if (view.kind === 'home') return <Redirect href={routes.home} />;
  if (view.kind === 'loading') {
    return (
      <Screen>
        <View style={styles.centre}>
          <LoadingState />
        </View>
      </Screen>
    );
  }
  return (
    <Screen scroll padding="space9">
      <View style={[styles.content, { gap: spacing.space9 }]}>
        <View style={{ gap: spacing.space5 }}>
          <BrandMark />
          <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
            {WELCOME_COPY.title}
          </Text>
          <Text level={LEAD_LEVEL} tone="muted">
            {WELCOME_COPY.lead}
          </Text>
        </View>
        <View style={{ gap: spacing.space5 }}>
          <View style={{ gap: spacing.space2 }}>
            <Button
              label={WELCOME_COPY.signIn}
              onPress={() => router.push(routes.signIn)}
              disabled={!view.signInEnabled}
              accessibilityHint={view.signInNote ?? undefined}
              fullWidth
            />
            {view.signInNote ? (
              <Text level={NOTE_LEVEL} tone="muted">
                {view.signInNote}
              </Text>
            ) : null}
          </View>
          <Button
            label={WELCOME_COPY.connect}
            onPress={() => router.push(routes.connect)}
            variant="outline"
            fullWidth
          />
        </View>
        <LegalLine privacyUrl={PRIVACY_POLICY_URL} termsUrl={TERMS_URL} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, justifyContent: 'center' },
});
