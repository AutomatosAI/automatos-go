// Connect to your own server (PRD-001 §4.5): the address and the code (ConnectForm), then the
// confirm card (ConfirmCard), over the connect flow (use-connect.ts: discovery, then POST /pair
// only on Pair, KC8). A route prefill, a scan or a link opens it with both fields and goes
// straight to checking; a new one while Connect is open starts the flow again. Opened with another
// server's address while this phone uses one (a scan, a /go/pair link, a crafted
// automatos://connect link), it first asks 'You're connected to {current}. Connect to {new}
// instead?' and checks nothing without the yes (KC8). Saving a pairing moves the current server,
// which remounts the provider tree and this screen with it: the remounted screen finds its pairing
// signed in (connectLanding) and goes home, where the shell takes over. Thin wiring:
// connect-view.ts and scanner/scan-state.ts decide what shows.

import { Redirect, useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuthSession } from '../../auth/AuthRoot';
import { env } from '../../lib/env';
import { routes, type ConnectPrefill } from '../../navigation/routes';
import { useGoBack } from '../../navigation/use-go-back';
import { hostedSignInConfigured } from '../../session/auth-branch';
import { useTokens } from '../../styles/theme';
import { IconButton, Screen, Text } from '../../ui';
import { SwitchQuestion } from '../components/SwitchQuestion';
import { hostedServer, ownServer } from '../current-server';
import { typedFields } from '../flow';
import { connectSwitchQuestion, serverInUse, type SwitchQuestionView } from '../scanner/scan-state';
import { CONFIRM_COPY, CONNECT_SCREEN_COPY } from '../strings';
import { useConnect } from '../use-connect';
import { useCurrentServer } from '../use-current-server';
import { ConfirmCard } from './ConfirmCard';
import { ConnectForm } from './ConnectForm';
import { connectLanding, connectView, prefillKey, type ConnectView } from './connect-view';

const TITLE_LEVEL = 2;
const LEAD_LEVEL = 1;

function Header({ view }: { readonly view: ConnectView }) {
  const { spacing } = useTokens();
  const words = view.screen === 'confirm' ? CONFIRM_COPY : CONNECT_SCREEN_COPY;
  return (
    <View style={{ gap: spacing.space3 }}>
      <Text variant="eyebrow">{CONNECT_SCREEN_COPY.eyebrow}</Text>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {words.title}
      </Text>
      <Text level={LEAD_LEVEL} tone="muted">
        {words.lead}
      </Text>
    </View>
  );
}

function ConnectFlow({ prefill }: { readonly prefill: ConnectPrefill }) {
  const { spacing } = useTokens();
  const router = useRouter();
  const leave = useGoBack(routes.welcome);
  const flow = useConnect(prefill);
  const view = connectView(flow.state, { hostedSignIn: hostedSignInConfigured(env) });
  if (view.screen === 'connected') return <Redirect href={routes.home} />;
  const pairing = view.screen === 'confirm' && view.pairing;
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.space9, gap: spacing.space9 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.back}>
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel={CONNECT_SCREEN_COPY.back}
            onPress={leave}
            disabled={pairing}
          />
        </View>
        <Header view={view} />
        {view.screen === 'confirm' ? (
          <ConfirmCard view={view} onConfirm={flow.confirm} onBack={flow.back} />
        ) : (
          <ConnectForm
            view={view}
            onEdit={flow.edit}
            onContinue={() => flow.submit(typedFields(flow.state))}
            onCancel={flow.back}
            onScan={() => router.push(routes.connectScan)}
            onSignIn={() => router.push(routes.signIn)}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

type EntryProps = {
  readonly prefill: ConnectPrefill;
  /** Asked first: the prefill names another server than the one in use (connectSwitchQuestion). */
  readonly question: SwitchQuestionView | null;
  /** /go/pair already asked it and the person said yes. */
  readonly answered: boolean;
};

/** The switch question when there is one, then the flow; the yes holds for this prefill only. */
function ConnectEntry({ prefill, question, answered }: EntryProps) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(answered);
  if (question && !agreed) {
    return (
      <SwitchQuestion
        question={question}
        onConnect={() => setAgreed(true)}
        onStay={() => router.replace(routes.home)}
      />
    );
  }
  return <ConnectFlow prefill={prefill} />;
}

export type ConnectScreenProps = {
  readonly prefill: ConnectPrefill;
  /**
   * The switch question was asked and answered yes in the app (/go/pair). A prop, never a route
   * param: a link anyone writes (automatos://connect?origin=…) cannot skip the question (KC8).
   */
  readonly switchAnswered?: boolean;
};

/**
 * Connect, unless the pairing it made is already this phone's signed-in server; opened with another
 * server's address while this phone uses one, it asks first (KC8).
 */
export function ConnectScreen({ prefill, switchAnswered = false }: ConnectScreenProps) {
  const { isSignedIn } = useAuthSession();
  const own = ownServer(useCurrentServer());
  if (connectLanding({ own, isSignedIn, prefill })) return <Redirect href={routes.home} />;
  const inUse = serverInUse({ own, hosted: hostedServer(), isSignedIn });
  return (
    <ConnectEntry
      key={prefillKey(prefill)}
      prefill={prefill}
      question={connectSwitchQuestion(prefill, inUse)}
      answered={switchAnswered}
    />
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  back: { alignSelf: 'flex-start' },
});
